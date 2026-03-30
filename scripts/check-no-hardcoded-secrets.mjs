#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { execSync } from 'node:child_process';

const allowedExtensions = new Set([
  '.md', '.txt', '.yaml', '.yml', '.env', '.example',
  '.json', '.ts', '.js', '.mjs', '.cjs', '.sh', '.ps1'
]);

const includeExplicit = new Set(['.env.example']);
const excludedPrefixes = ['node_modules/', '.git/', '.pnpm-store/', 'dist/', 'coverage/'];

const envSecretKeys = new Set([
  'OPENAI_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'FINNHUB_API_KEY',
  'FMP_API_KEY',
  'ALPHA_VANTAGE_API_KEY',
  'LANGSMITH_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'JWT_SECRET',
  'SAXO_CLIENT_SECRET'
]);

const tokenRegexes = [
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g
];

function shouldScan(file) {
  if (includeExplicit.has(file)) {
    return true;
  }
  for (const prefix of excludedPrefixes) {
    if (file.startsWith(prefix)) {
      return false;
    }
  }
  return allowedExtensions.has(extname(file));
}

function getTrackedFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean);
}

function isPlaceholderValue(value) {
  const v = value.trim().replace(/^['"]|['"]$/g, '');
  if (v.length === 0) return true;
  if (v.startsWith('<') || v.includes('<') || v.includes('>')) return true;
  if (v.startsWith('${') || v.startsWith('$')) return true;
  if (/^your[_-]/i.test(v) || /\byour\b/i.test(v)) return true;
  return false;
}

function findingsForLine(file, lineText, lineNumber) {
  const findings = [];

  for (const regex of tokenRegexes) {
    regex.lastIndex = 0;
    const match = regex.exec(lineText);
    if (match) {
      findings.push({ file, line: lineNumber, rule: 'Known token prefix', snippet: match[0] });
    }
  }

  const envMatch = lineText.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (envMatch) {
    const key = envMatch[1];
    const rawValue = envMatch[2].split('#')[0].trim();

    if (envSecretKeys.has(key) && !isPlaceholderValue(rawValue)) {
      findings.push({ file, line: lineNumber, rule: 'Hardcoded secret env assignment', snippet: `${key}=${rawValue}` });
    }

    if (key === 'DATABASE_URL') {
      const v = rawValue.replace(/^['"]|['"]$/g, '');
      if (/^postgresql:\/\//i.test(v) && v.includes(':') && v.includes('@')) {
        if (!(v.includes('<') || v.includes('>') || v.includes('${') || /your|example/i.test(v))) {
          findings.push({ file, line: lineNumber, rule: 'Hardcoded postgres credentials in URL', snippet: `${key}=${rawValue}` });
        }
      }
    }
  }

  const pwdMatch = lineText.match(/(?:"|')password(?:"|')\s*:\s*(?:"|')([^"']+)(?:"|')/i);
  if (pwdMatch) {
    const value = pwdMatch[1].trim();
    if (!(value.startsWith('<') || value.startsWith('$') || /your-password/i.test(value))) {
      findings.push({ file, line: lineNumber, rule: 'Hardcoded password literal', snippet: lineText.trim().slice(0, 180) });
    }
  }

  return findings;
}

const findings = [];
for (const file of getTrackedFiles()) {
  if (!shouldScan(file)) continue;

  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    findings.push(...findingsForLine(file, line, index + 1));
  });
}

if (findings.length > 0) {
  console.error('Secret policy violations detected:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.snippet}`);
  }
  process.exit(1);
}

console.log('Secret policy check passed.');
