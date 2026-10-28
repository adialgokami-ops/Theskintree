#!/usr/bin/env node
/**
 * scripts/chat-latency-test.mjs
 * Rigorous Latency & Reliability Benchmark Suite for The Skin Tree AI Chatbot.
 *
 * Tracks:
 * - Cold vs Warm connection tracking reported separately
 * - Success rate split into: Primary Model / Fallback Model / Canned Fallback
 * - Time to first STATUS event vs Time to first CONTENT token (honest TTFT)
 * - Total time p50 and p95 for successful requests
 * - Slot cache toggle (--no-cache)
 * - Request spacing (--delay <ms>)
 *
 * Usage:
 *   node scripts/chat-latency-test.mjs [--url <endpoint>] [--passes 3] [--no-cache] [--delay 3000]
 */

import dns from 'node:dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const targetUrl = urlIdx !== -1 && args[urlIdx + 1] ? args[urlIdx + 1] : 'http://localhost:5173/api/chat';

const passesIdx = args.indexOf('--passes');
const PASSES = passesIdx !== -1 ? parseInt(args[passesIdx + 1], 10) || 3 : 3;

const delayIdx = args.indexOf('--delay');
const requestDelayMs = delayIdx !== -1 ? parseInt(args[delayIdx + 1], 10) || 150 : 150;

const bypassIdx = args.indexOf('--bypass');
const bypassToken = bypassIdx !== -1 ? args[bypassIdx + 1] : process.env.VERCEL_PROTECTION_BYPASS || null;

const noCache = args.includes('--no-cache');

const TEST_PROMPTS = [
  // 1 & 2: Greetings
  { id: 1, category: 'Greeting', prompt: 'Hello!' },
  { id: 2, category: 'Greeting', prompt: 'Good morning, what treatments do you offer at The Skin Tree?' },

  // 3, 4, 5: Treatment Questions
  { id: 3, category: 'Treatment', prompt: 'What treatments do you offer for stubborn acne scars?' },
  { id: 4, category: 'Treatment', prompt: 'Can you tell me about the Hydrafacial MD treatment and downtime?' },
  { id: 5, category: 'Treatment', prompt: 'Do you offer chemical peels for hyperpigmentation?' },

  // 6, 7, 8: Availability / Slots
  { id: 6, category: 'Availability', prompt: 'Are there any slots available tomorrow?' },
  { id: 7, category: 'Availability', prompt: 'What consultation times are open this Friday?' },
  { id: 8, category: 'Availability', prompt: 'Can I check doctor availability for next Monday?' },

  // 9, 10: Booking Intents
  { id: 9, category: 'Booking Intent', prompt: 'I would like to book a private consultation with Dr. Aishwarya.' },
  { id: 10, category: 'Booking Intent', prompt: 'Can I book an appointment for tomorrow at 10 AM?' }
];

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

async function sendChatRequest(promptText, isCold) {
  const tStart = Date.now();
  let timeToFirstStatus = null;
  let timeToFirstContentToken = null;
  let totalTime = null;
  let status = 0;
  let replyText = '';
  let modelUsed = 'unknown';
  let isFallback = false;
  let isCanned = false;
  let isStream = false;
  let dbMs = 0;
  let failureReason = null;

  const headers = { 'Content-Type': 'application/json' };
  if (bypassToken) {
    headers['x-vercel-protection-bypass'] = bypassToken;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: promptText }],
        noCache
      }),
      signal: controller.signal
    });

    status = res.status;
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      isStream = true;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.replace(/^data:\s*/, ''));
              if (data.status && timeToFirstStatus === null) {
                timeToFirstStatus = Date.now() - tStart;
              }
              if (data.token) {
                if (timeToFirstContentToken === null) {
                  timeToFirstContentToken = Date.now() - tStart;
                }
                replyText += data.token;
              }
              if (data.model) modelUsed = data.model;
              if (data.isFallback !== undefined) isFallback = data.isFallback;
              if (data.cannedFallback !== undefined) isCanned = data.cannedFallback;
              if (data.done) {
                if (data.model) modelUsed = data.model;
                if (data.isFallback !== undefined) isFallback = data.isFallback;
                if (data.cannedFallback !== undefined) isCanned = data.cannedFallback;
                if (data.timings?.db_ms !== undefined) dbMs = data.timings.db_ms;
                if (data.failureReason) failureReason = data.failureReason;
              }
            } catch (_) {}
          }
        }
      }
      totalTime = Date.now() - tStart;
      if (timeToFirstContentToken === null) timeToFirstContentToken = totalTime;
    } else {
      const data = await res.json();
      totalTime = Date.now() - tStart;
      timeToFirstContentToken = data.timings?.ttft || totalTime;
      replyText = data.reply || data.error || data.message || '';
      modelUsed = data.model || 'unknown';
      isFallback = data.isFallback || false;
      isCanned = data.cannedFallback || false;
      dbMs = data.timings?.db_ms || 0;
      failureReason = data.failureReason || null;
    }
  } catch (err) {
    status = err.name === 'AbortError' ? 408 : 500;
    failureReason = err.name === 'AbortError' ? 'timeout' : 'client_fetch_error';
    totalTime = Date.now() - tStart;
    timeToFirstContentToken = totalTime;
    replyText = `Error: ${err.message}`;
  } finally {
    clearTimeout(timeoutId);
  }

  // Determine classification: Canned fallback is NOT counted as success
  let executionType = 'primary_model';
  if (isCanned || replyText.includes('concierge is experiencing a brief connection delay')) {
    executionType = 'canned_fallback';
  } else if (isFallback) {
    executionType = 'fallback_model';
  }

  const isSuccess = status === 200 && executionType !== 'canned_fallback';

  return {
    status,
    isSuccess,
    timeToFirstStatus,
    timeToFirstContentToken,
    totalTime,
    dbMs,
    failureReason,
    replyText: replyText.slice(0, 70).replace(/\n/g, ' '),
    modelUsed,
    executionType,
    isCold
  };
}

async function runBenchmark() {
  console.log('⚡ The Skin Tree: Rigorous AI Chatbot Benchmark');
  console.log(`   Endpoint:    ${targetUrl}`);
  console.log(`   Provider:    Google Gemini Only`);
  console.log(`   Spacing:     ${requestDelayMs}ms between requests`);
  console.log(`   Slot Cache:  ${noCache ? 'DISABLED (testing cold DB performance)' : 'ENABLED (20s TTL)'}`);
  console.log(`   Total Tests: ${PASSES * TEST_PROMPTS.length} requests (${PASSES} passes x 10 prompts)\n`);

  const allResults = [];
  let isCold = true;

  for (let pass = 1; pass <= PASSES; pass++) {
    console.log(`--- Starting Pass ${pass} of ${PASSES} ---`);
    for (const item of TEST_PROMPTS) {
      process.stdout.write(`  [#${item.id}] "${item.prompt.slice(0, 35)}..." `);
      const res = await sendChatRequest(item.prompt, isCold);
      isCold = false; // subsequent requests are warm

      allResults.push({ ...item, pass, ...res });

      const ok = res.status === 200;
      const icon = ok ? '✅' : '❌';
      const typeBadge = res.executionType === 'primary_model' ? '[PRIMARY]' :
                        res.executionType === 'fallback_model' ? '[FALLBACK_MODEL]' : '[CANNED]';
      console.log(
        `${icon} ${res.status} | First Content: ${res.timeToFirstContentToken}ms | Total: ${res.totalTime}ms ${typeBadge}`
      );

      // Delay between requests
      await new Promise(r => setTimeout(r, requestDelayMs));
    }
  }

  // Summary Computations
  const totalRequests = allResults.length;
  // Strictly count only actual LLM completions as successful (canned fallbacks are failures)
  const successfulRequests = allResults.filter(r => r.isSuccess);
  const failedRequests = allResults.filter(r => !r.isSuccess);

  const primaryCount = allResults.filter(r => r.executionType === 'primary_model' && r.isSuccess).length;
  const fallbackModelCount = allResults.filter(r => r.executionType === 'fallback_model' && r.isSuccess).length;
  const cannedCount = allResults.filter(r => r.executionType === 'canned_fallback').length;

  const coldResults = successfulRequests.filter(r => r.isCold);
  const warmResults = successfulRequests.filter(r => !r.isCold);

  const contentTokens = successfulRequests.map(r => r.timeToFirstContentToken);
  const totalTimes = successfulRequests.map(r => r.totalTime);
  const dbTimes = allResults.map(r => r.dbMs || 0).filter(ms => ms > 0);

  const warmContentTokens = warmResults.map(r => r.timeToFirstContentToken);
  const warmTotalTimes = warmResults.map(r => r.totalTime);

  console.log('\n================================================================');
  console.log('📊 BENCHMARK HONESTY REPORT (Canned Fallback = Failure)');
  console.log('================================================================');
  console.log(`Target:                     ${targetUrl}`);
  console.log(`Total Requests:             ${totalRequests}`);
  console.log(`True Success Rate:          ${((successfulRequests.length / totalRequests) * 100).toFixed(1)}% (${successfulRequests.length}/${totalRequests})`);
  console.log(`  - Primary Model Success:  ${primaryCount} (${((primaryCount / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  - Fallback Model Success: ${fallbackModelCount} (${((fallbackModelCount / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  - Canned Fallbacks:       ${cannedCount} (${((cannedCount / totalRequests) * 100).toFixed(1)}%) [Counted as Failure]`);
  console.log(`Total Failures:             ${failedRequests.length}`);

  console.log('\n⏱️ LATENCY METRICS (Successful LLM Completions Only):');
  console.log(`Time-to-First CONTENT Token p50: ${percentile(contentTokens, 50)} ms`);
  console.log(`Time-to-First CONTENT Token p95: ${percentile(contentTokens, 95)} ms`);
  console.log(`Total Response Time p50:         ${percentile(totalTimes, 50)} ms`);
  console.log(`Total Response Time p95:         ${percentile(totalTimes, 95)} ms`);
  if (dbTimes.length > 0) {
    console.log(`DB Query Time (db_ms) p50:       ${percentile(dbTimes, 50)} ms (p95: ${percentile(dbTimes, 95)} ms)`);
  }

  if (coldResults.length > 0) {
    console.log('\n❄️ COLD INVOCATION:');
    console.log(`  Cold TTFT Content Token:       ${coldResults[0].timeToFirstContentToken} ms`);
    console.log(`  Cold Total Response Time:      ${coldResults[0].totalTime} ms`);
  }

  if (warmResults.length > 0) {
    console.log('\n🔥 WARM INVOCATIONS:');
    console.log(`  Warm TTFT Content Token p50:   ${percentile(warmContentTokens, 50)} ms`);
    console.log(`  Warm TTFT Content Token p95:   ${percentile(warmContentTokens, 95)} ms`);
    console.log(`  Warm Total Response Time p50:  ${percentile(warmTotalTimes, 50)} ms`);
    console.log(`  Warm Total Response Time p95:  ${percentile(warmTotalTimes, 95)} ms`);
  }
  console.log('================================================================\n');

  return {
    totalRequests,
    successRate: (successfulRequests.length / totalRequests) * 100,
    primaryCount,
    fallbackModelCount,
    cannedCount,
    ttftContentP50: percentile(contentTokens, 50),
    ttftContentP95: percentile(contentTokens, 95),
    totalP50: percentile(totalTimes, 50),
    totalP95: percentile(totalTimes, 95),
    dbMsP50: percentile(dbTimes, 50),
    dbMsP95: percentile(dbTimes, 95),
    coldTotal: coldResults[0]?.totalTime || null,
    warmTotalP50: percentile(warmTotalTimes, 50)
  };
}

runBenchmark().catch(err => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
