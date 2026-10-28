/**
 * client/api/_llm.js
 * High-performance, streaming Gemini LLM adapter for The Skin Tree AI Concierge.
 *
 * Architecture:
 * - Provider: Google Gemini Only (generativelanguage.googleapis.com).
 * - Primary Key: process.env.GEMINI_API_KEY (model pinned via CHAT_MODEL).
 * - Optional Fallback Key: process.env.GEMINI_API_KEY_2 (separate Google project, model CHAT_MODEL_FALLBACK).
 * - 2-Second First-Content-Token Hedge:
 *   If GEMINI_API_KEY_2 is configured:
 *     - Primary starts immediately.
 *     - If primary emits no content token in 2000ms OR fails immediately (429/503/timeout),
 *       the second key is dispatched concurrently in a hedged race.
 *     - Whichever produces the first content token wins; the loser is aborted cleanly.
 *   If GEMINI_API_KEY_2 is NOT configured:
 *     - Logs that fallback key is absent and runs single-key Gemini without crashing.
 * - Quota & 429 Logging:
 *   - Logs the full 429 response body and headers with API keys strictly redacted.
 * - Resilience:
 *   - In case of failure, streams a polite concierge message with clinic WhatsApp (CLINIC_WHATSAPP)
 *     and marks success: false (canned fallback).
 */

import dns from 'node:dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

/**
 * Redact sensitive tokens and API keys from error bodies and headers
 */
function redactSecrets(text) {
  if (!text) return '';
  return String(text)
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/(?:key|api_key|token)=([0-9A-Za-z-_]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[0-9A-Za-z-_.]+/gi, 'Bearer [REDACTED]');
}

/**
 * Robust SSE line parser for Gemini streaming fetch responses
 */
async function parseSseStream(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          onChunk(parsed);
        } catch (_) {}
      }
    }
  }
}

/**
 * Single Gemini stream request helper
 */
async function streamSingleGeminiModel({ model, system, messages, signal, onChunkToken, apiKey, keySlot = 'primary' }) {
  const t0 = Date.now();
  const requestBody = {
    systemInstruction: {
      parts: [{ text: system }]
    },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '').slice(0, 1000) }]
    })),
    generationConfig: {
      maxOutputTokens: 350,
      temperature: 0.3,
      ...(model.includes('3.1') ? { thinkingConfig: { thinkingBudget: 0 } } : {})
    }
  };

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(requestBody),
        signal
      }
    );
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError') {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text();
    const redactedBody = redactSecrets(errText);

    if (res.status === 429) {
      console.warn(
        JSON.stringify({
          event: 'provider_429_received',
          layer: 'google_api',
          model,
          key_slot: keySlot,
          status: 429,
          headers: Object.fromEntries(
            Array.from(res.headers.entries()).map(([k, v]) => [k, redactSecrets(v)])
          ),
          body: redactedBody
        })
      );
    }

    const errorObj = new Error(`Gemini HTTP ${res.status}: ${redactedBody.slice(0, 250)}`);
    errorObj.status = res.status;
    errorObj.layer = 'google_api';
    errorObj.rawBody = redactedBody;
    errorObj.duration_ms = Date.now() - t0;
    throw errorObj;
  }

  let tokenCount = 0;
  try {
    await parseSseStream(res, (chunk) => {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        tokenCount++;
        onChunkToken(text);
      }
    });
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError') {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    throw err;
  }

  if (tokenCount === 0) {
    const emptyErr = new Error('Gemini returned an empty SSE stream.');
    emptyErr.status = 502;
    emptyErr.layer = 'google_api';
    throw emptyErr;
  }

  return { tokenCount, duration_ms: Date.now() - t0 };
}

/**
 * Universal Gemini streamChat adapter with optional secondary-key hedging
 */
export async function streamChat({ system, messages, signal, onToken, onStatus, raceDelayMs = 2000 }) {
  const primaryApiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_KEY;
  if (!primaryApiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }

  const secondaryApiKey = process.env.GEMINI_API_KEY_2 || process.env.Gemini_Api_2key || process.env.GEMINI_API_2KEY || null;
  const primaryModel = process.env.CHAT_MODEL || 'gemini-3.1-flash-lite';
  const fallbackModel = process.env.CHAT_MODEL_FALLBACK || 'gemini-3.1-flash-lite-preview';

  const tStart = Date.now();

  // Mode A: Single-key mode (secondary key absent)
  if (!secondaryApiKey) {
    console.warn('[LLM Adapter] GEMINI_API_KEY_2 is not set; running single-key Gemini without second-key hedging.');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const onParentAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onParentAbort);

    try {
      await streamSingleGeminiModel({
        model: primaryModel,
        system,
        messages,
        signal: controller.signal,
        apiKey: primaryApiKey,
        keySlot: 'primary',
        onChunkToken: onToken
      });

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onParentAbort);

      return {
        provider: 'gemini',
        model: primaryModel,
        success: true,
        isFallback: false,
        cannedFallback: false
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onParentAbort);

      return handleFatalFallback(err, primaryModel, onToken, null, null, tStart, messages);
    }
  }

  // Mode B: Hedged race between primary key and secondary key
  let winner = null; // 'primary' | 'secondary'
  let primaryFirstToken = false;
  let secondaryFirstToken = false;
  let primaryError = null;
  let secondaryError = null;
  let raceTimer = null;

  const primaryController = new AbortController();
  const secondaryController = new AbortController();

  const onParentAbort = () => {
    primaryController.abort();
    secondaryController.abort();
  };
  if (signal) signal.addEventListener('abort', onParentAbort);

  const runPrimary = async () => {
    try {
      await streamSingleGeminiModel({
        model: primaryModel,
        system,
        messages,
        signal: primaryController.signal,
        apiKey: primaryApiKey,
        keySlot: 'primary',
        onChunkToken: (text) => {
          if (!winner) {
            winner = 'primary';
            primaryFirstToken = true;
            if (raceTimer) clearTimeout(raceTimer);
            secondaryController.abort();
          }
          if (winner === 'primary') {
            onToken(text);
          }
        }
      });
      return { success: true, model: primaryModel, isFallback: false };
    } catch (err) {
      primaryError = err;
      if (!winner && !secondaryController.signal.aborted) {
        if (raceTimer) {
          clearTimeout(raceTimer);
          triggerSecondary('primary_failed_' + (err.status || err.name));
        }
      }
      throw err;
    }
  };

  let secondaryPromise = null;
  const triggerSecondary = (reason) => {
    if (secondaryPromise || winner === 'primary') return;
    if (onStatus) onStatus("Consulting Dr. Aishwarya's schedule...");

    console.warn(
      JSON.stringify({
        event: 'gemini_secondary_key_race_triggered',
        primaryModel,
        fallbackModel,
        reason,
        elapsed_ms: Date.now() - tStart
      })
    );

    const p = (async () => {
      try {
        await streamSingleGeminiModel({
          model: fallbackModel,
          system,
          messages,
          signal: secondaryController.signal,
          apiKey: secondaryApiKey,
          keySlot: 'secondary',
          onChunkToken: (text) => {
            if (!winner) {
              winner = 'secondary';
              secondaryFirstToken = true;
              primaryController.abort();
            }
            if (winner === 'secondary') {
              onToken(text);
            }
          }
        });
        return { success: true, model: fallbackModel, isFallback: true };
      } catch (err) {
        secondaryError = err;
        throw err;
      }
    })();
    // Suppress unhandled rejection when secondary is aborted
    p.catch(() => {});
    secondaryPromise = p;
  };

  const primaryPromise = runPrimary();
  // Suppress unhandled rejection when primary is aborted
  primaryPromise.catch(() => {});

  // Race secondary key after raceDelayMs (2000ms) if primary has not produced any content token
  raceTimer = setTimeout(() => {
    if (!winner && !primaryFirstToken) {
      triggerSecondary('content_token_timeout_2s');
    }
  }, raceDelayMs);

  const maxBudgetTimer = setTimeout(() => {
    primaryController.abort();
    secondaryController.abort();
  }, 10000);

  try {
    await Promise.race([
      primaryPromise.catch((e) => {
        if (secondaryPromise) return secondaryPromise;
        throw e;
      }),
      (async () => {
        while (!winner && !primaryError) {
          await new Promise((r) => setTimeout(r, 40));
        }
        if (winner === 'secondary' && secondaryPromise) {
          return await secondaryPromise;
        }
        return await primaryPromise;
      })()
    ]);

    clearTimeout(maxBudgetTimer);
    clearTimeout(raceTimer);
    if (signal) signal.removeEventListener('abort', onParentAbort);

    if (winner === 'primary') {
      return { provider: 'gemini', model: primaryModel, success: true, isFallback: false, cannedFallback: false };
    }
    if (winner === 'secondary') {
      return { provider: 'gemini', model: fallbackModel, success: true, isFallback: true, cannedFallback: false };
    }

    throw primaryError || secondaryError || new Error('No model emitted tokens.');
  } catch (finalErr) {
    clearTimeout(maxBudgetTimer);
    clearTimeout(raceTimer);
    if (signal) signal.removeEventListener('abort', onParentAbort);

    return handleFatalFallback(finalErr, primaryModel, onToken, primaryError, secondaryError, tStart, messages);
  }
}

/**
 * Handle fatal failure and emit friendly concierge fallback message
 */
function handleFatalFallback(err, primaryModel, onToken, primaryError = null, secondaryError = null, tStart = 0, messages = []) {
  let failureReason = 'unknown';
  if (err.name === 'AbortError' || err.message?.includes('aborted')) {
    failureReason = 'timeout';
  } else if (err.status === 429 || primaryError?.status === 429 || secondaryError?.status === 429) {
    failureReason = '429';
  } else if (err.status === 503 || primaryError?.status === 503 || secondaryError?.status === 503) {
    failureReason = '503';
  } else if (err.status || primaryError?.status || secondaryError?.status) {
    failureReason = String(err.status || primaryError?.status || secondaryError?.status);
  }

  const failureBody = err.rawBody || primaryError?.rawBody || secondaryError?.rawBody || null;

  console.error(
    JSON.stringify({
      event: 'gemini_all_attempts_failed',
      provider: 'gemini',
      primaryModel,
      failure_reason: failureReason,
      failure_body: failureBody ? failureBody.slice(0, 300) : null,
      error: err.message
    })
  );

  const waNum = process.env.CLINIC_WHATSAPP;
  if (!waNum) {
    console.error('🚨 [CRITICAL CONFIG WARNING] CLINIC_WHATSAPP environment variable is not configured!');
  }

  // Smart Contextual Fallback: Answer common patient clinic questions directly even if upstream Google API is unavailable
  const lastUserMsg = (messages.slice().reverse().find(m => m.role === 'user')?.content || '').toLowerCase();
  let intelligentAnswer = null;

  if (lastUserMsg.includes('time') || lastUserMsg.includes('timing') || lastUserMsg.includes('open') || lastUserMsg.includes('hours') || lastUserMsg.includes('sunday')) {
    intelligentAnswer = "The Skin Tree is open Monday through Saturday from 09:00 to 16:00 IST (closed on Sundays). Would you like to select an available consultation slot below?";
  } else if (lastUserMsg.includes('where') || lastUserMsg.includes('location') || lastUserMsg.includes('address') || lastUserMsg.includes('bandra') || lastUserMsg.includes('clinic located')) {
    intelligentAnswer = "The Skin Tree sanctuary is located in Bandra West, Mumbai (123 Serenity Lane). In-person clinical consultations with Dr. Aishwarya Agarwal are available by advance booking.";
  } else if (lastUserMsg.includes('doctor') || lastUserMsg.includes('aishwarya') || lastUserMsg.includes('founder') || lastUserMsg.includes('qualification') || lastUserMsg.includes('who')) {
    intelligentAnswer = "Dr. Aishwarya Agarwal (MBBS, MD Dermatology) is our medical director and founder, with over 15 years of specialised clinical dermatology and aesthetic artistry experience.";
  } else if (lastUserMsg.includes('treatment') || lastUserMsg.includes('service') || lastUserMsg.includes('acne') || lastUserMsg.includes('glow') || lastUserMsg.includes('peel') || lastUserMsg.includes('facial') || lastUserMsg.includes('laser') || lastUserMsg.includes('scar') || lastUserMsg.includes('wrinkle') || lastUserMsg.includes('pigmentation')) {
    intelligentAnswer = "Dr. Aishwarya provides evidence-based treatments including Chemical Peels, HydraFacial protocols, Fractional Lasers, Acne/Scar Rejuvenation, and Anti-Ageing therapies. You can book an initial consultation below.";
  } else if (lastUserMsg.includes('book') || lastUserMsg.includes('slot') || lastUserMsg.includes('appointment') || lastUserMsg.includes('consultation') || lastUserMsg.includes('schedule') || lastUserMsg.includes('tomorrow') || lastUserMsg.includes('today')) {
    intelligentAnswer = "Dr. Aishwarya's consultation availability is shown below. Please choose your preferred date and time to submit an appointment request.";
  }

  const responseText = intelligentAnswer || (waNum
    ? `Hello! Dr. Aishwarya’s booking concierge is experiencing a brief connection delay. Please feel free to select a consultation slot below or reach our clinic directly on WhatsApp at ${waNum}.`
    : 'Hello! Dr. Aishwarya’s booking concierge is experiencing a brief connection delay. Please feel free to select a consultation slot below or contact our clinic concierge.');

  onToken(responseText);

  return {
    provider: 'gemini',
    model: 'canned-fallback',
    fallbackUsed: true,
    isFallback: true,
    cannedFallback: true,
    success: false,
    failureReason,
    failureLayer: 'google_api',
    failureBody,
    error: err.message
  };
}

export default streamChat;
