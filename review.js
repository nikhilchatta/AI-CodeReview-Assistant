#!/usr/bin/env node
/**
 * review.js — Terminal AI Code Review
 *
 * Usage:
 *   node review.js <file>                          # uses CODE_REVIEW_API_URL env var
 *   node review.js <file> --api-url http://EC2_IP  # explicit API URL
 *
 * Results print to terminal. Every run is logged to the IDE Extension tab
 * of the Observability dashboard automatically (source=ide).
 *
 * Set default API URL permanently:
 *   export CODE_REVIEW_API_URL=http://YOUR_EC2_IP   # Linux/Mac/Git Bash
 *   $env:CODE_REVIEW_API_URL="http://YOUR_EC2_IP"   # PowerShell
 */

import { readFileSync } from 'fs';
import { extname, basename } from 'path';

// ── Language detection ──
const EXT_LANG = {
  '.py':    'python',
  '.ts':    'typescript',
  '.tsx':   'typescript',
  '.js':    'javascript',
  '.jsx':   'javascript',
  '.scala': 'scala',
  '.sql':   'sql',
  '.tf':    'terraform',
};

// ── Terminal colours ──
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  red:    '\x1b[31m',
  orange: '\x1b[33m',
  blue:   '\x1b[34m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
};

const c = (col, txt) => `${C[col]}${txt}${C.reset}`;

function severityBadge(s) {
  const map = {
    critical: c('red',    '[CRITICAL]'),
    high:     c('orange', '[HIGH]    '),
    medium:   c('orange', '[MEDIUM]  '),
    low:      c('blue',   '[LOW]     '),
    info:     c('gray',   '[INFO]    '),
  };
  return map[(s || '').toLowerCase()] || c('gray', `[${(s||'INFO').toUpperCase()}]`);
}

// ── Argument parsing ──
const args = process.argv.slice(2);
let filePath = null;
let apiUrl   = process.env.CODE_REVIEW_API_URL || '';

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--api-url' || args[i] === '-u') && args[i + 1]) {
    apiUrl = args[++i];
  } else if (!args[i].startsWith('-')) {
    filePath = args[i];
  }
}

if (!filePath) {
  console.error(c('red', '\nUsage: node review.js <file> [--api-url http://EC2_IP]\n'));
  console.error(c('gray', 'Or set:  export CODE_REVIEW_API_URL=http://YOUR_EC2_IP\n'));
  process.exit(1);
}

if (!apiUrl) {
  console.error(c('red', '\nAPI URL not set. Use --api-url or set CODE_REVIEW_API_URL:\n'));
  console.error(c('gray', '  export CODE_REVIEW_API_URL=http://YOUR_EC2_IP\n'));
  process.exit(1);
}

// ── Read file ──
let code;
try {
  code = readFileSync(filePath, 'utf-8');
} catch (e) {
  console.error(c('red', `\nCannot read file: ${filePath}\n`));
  process.exit(1);
}

const ext      = extname(filePath).toLowerCase();
const language = EXT_LANG[ext] || 'python';
const file     = basename(filePath);

// ── Header ──
console.log('');
console.log(c('bold', c('white', `  AI Code Review — ${file}`)));
console.log(c('gray',  `  Language : ${language}`));
console.log(c('gray',  `  API      : ${apiUrl}`));
console.log(c('gray',  `  Source   : ide  →  logs to IDE Extension tab`));
console.log('');

// ── Call API ──
let result;
try {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/analyze-code`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ code, language, source: 'ide' }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(c('red', `  HTTP ${res.status} — ${text || 'No response body'}\n`));
    process.exit(1);
  }

  result = await res.json();
} catch (e) {
  console.error(c('red', `  Connection failed: ${e.message}`));
  console.error(c('gray', `  Is the backend running at ${apiUrl} ?\n`));
  process.exit(1);
}

// ── Issues ──
const issues = result.issues || [];
const critical = issues.filter(i => i.severity === 'critical').length;
const high     = issues.filter(i => i.severity === 'high').length;

console.log(c('bold', `  Issues Found: ${issues.length}`) +
  (critical > 0 ? c('red',    `  (${critical} critical)`) : '') +
  (high     > 0 ? c('orange', `  (${high} high)`)         : ''));
console.log('');

if (issues.length === 0) {
  console.log(c('green', '  No issues found.'));
} else {
  for (const issue of issues) {
    const line = issue.lineNumber ? c('gray', ` (line ${issue.lineNumber})`) : '';
    console.log(`  ${severityBadge(issue.severity)} ${issue.message}${line}`);
    if (issue.suggestion) {
      console.log(c('cyan', `              → ${issue.suggestion}`));
    }
    console.log('');
  }
}

// ── Strengths ──
if (result.strengths?.length > 0) {
  console.log(c('bold', '  Strengths:'));
  result.strengths.forEach(s => console.log(c('green', `  ✓  ${s}`)));
  console.log('');
}

// ── Recommendations ──
if (result.recommendations?.length > 0) {
  console.log(c('bold', '  Recommendations:'));
  result.recommendations.forEach(r => console.log(c('cyan', `  •  ${r}`)));
  console.log('');
}

// ── Token / cost footer ──
const t = result.tokenUsage;
if (t) {
  const total = (t.inputTokens || 0) + (t.outputTokens || 0);
  console.log(c('gray',
    `  Tokens: ${total.toLocaleString()} ` +
    `(in: ${(t.inputTokens||0).toLocaleString()} / out: ${(t.outputTokens||0).toLocaleString()}) ` +
    `| Model: ${t.model || 'unknown'}`
  ));
}

console.log(c('gray', '  Logged → Observability › IDE Extension tab'));
console.log('');
