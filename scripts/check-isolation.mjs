#!/usr/bin/env node
/**
 * scripts/check-isolation.mjs
 * Security Boundary & Isolation Scanner
 *
 * Rules:
 * 1. client/ must NOT contain "ADMIN_", "CLINICAL", "clinical.", "clinical_", or any import from admin/.
 * 2. In admin/, the string "CLINICAL" must NOT appear outside admin/server/clinical/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const adminDir = path.join(rootDir, 'admin');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.vercel']);
const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.eot']);

let clientViolations = [];
let adminViolations = [];

function scanClient(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        scanClient(fullPath);
      }
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) continue;
    if (entry.name.endsWith('.lock') || entry.name === 'package-lock.json') continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // 1. ADMIN_
      if (line.includes('ADMIN_')) {
        clientViolations.push({
          file: path.relative(rootDir, fullPath),
          line: idx + 1,
          rule: 'Contains "ADMIN_"',
          snippet: line.trim()
        });
      }

      // 2. CLINICAL
      if (line.includes('CLINICAL')) {
        clientViolations.push({
          file: path.relative(rootDir, fullPath),
          line: idx + 1,
          rule: 'Contains "CLINICAL"',
          snippet: line.trim()
        });
      }

      // 3. clinical.
      if (line.includes('clinical.')) {
        clientViolations.push({
          file: path.relative(rootDir, fullPath),
          line: idx + 1,
          rule: 'Contains "clinical."',
          snippet: line.trim()
        });
      }

      // 4. clinical_
      if (line.includes('clinical_')) {
        clientViolations.push({
          file: path.relative(rootDir, fullPath),
          line: idx + 1,
          rule: 'Contains "clinical_"',
          snippet: line.trim()
        });
      }

      // 5. Imports from admin
      if (/from\s+['"][^'"]*admin[^'"]*['"]/.test(line) || /require\(['"][^'"]*admin[^'"]*['"]\)/.test(line)) {
        clientViolations.push({
          file: path.relative(rootDir, fullPath),
          line: idx + 1,
          rule: 'Imports from admin/',
          snippet: line.trim()
        });
      }
    });
  }
}

function scanAdmin(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        scanAdmin(fullPath);
      }
      continue;
    }

    // Skip .env files in root of admin/
    if (entry.name.startsWith('.env')) continue;

    const relToAdmin = path.relative(adminDir, fullPath).replace(/\\/g, '/');
    // Allowed inside admin/server/clinical/
    if (relToAdmin.startsWith('server/clinical/')) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) continue;
    if (entry.name.endsWith('.lock') || entry.name === 'package-lock.json') continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      if (line.includes('CLINICAL')) {
        adminViolations.push({
          file: path.relative(rootDir, fullPath),
          line: idx + 1,
          rule: 'String "CLINICAL" outside admin/server/clinical/',
          snippet: line.trim()
        });
      }
    });
  }
}

console.log('🔍 Running isolation security checks...');
scanClient(clientDir);
scanAdmin(adminDir);

let hasError = false;

if (clientViolations.length > 0) {
  hasError = true;
  console.error('\n❌ ISOLATION VIOLATIONS DETECTED IN client/:');
  clientViolations.forEach((v) => {
    console.error(`  - ${v.file}:${v.line} [${v.rule}]: ${v.snippet}`);
  });
} else {
  console.log('✅ Client Check Passed: No ADMIN_, CLINICAL, clinical., clinical_, or admin/ imports in client/.');
}

if (adminViolations.length > 0) {
  hasError = true;
  console.error('\n❌ ISOLATION VIOLATIONS DETECTED IN admin/:');
  adminViolations.forEach((v) => {
    console.error(`  - ${v.file}:${v.line} [${v.rule}]: ${v.snippet}`);
  });
} else {
  console.log('✅ Admin Check Passed: String "CLINICAL" appears ONLY inside admin/server/clinical/.');
}

if (hasError) {
  process.exit(1);
} else {
  console.log('🎉 ALL ISOLATION BOUNDARIES 100% VERIFIED!\n');
  process.exit(0);
}
