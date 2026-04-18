import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const ignoreDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.vercel',
  '.cursor',
  'coverage',
]);
const allowedFiles = new Set([
  '.env.example',
]);
const allowedExt = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf', '.lock',
]);

const secretPatterns = [
  { name: 'Supabase service role key', regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Generic API key assignment', regex: /(API_KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*["'][^"']{8,}["']/i },
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Private key block', regex: /-----BEGIN (?:RSA|EC|OPENSSH|DSA|PRIVATE) KEY-----/ },
  { name: 'Connection string with credentials', regex: /\b(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^/\s:@]+:[^/\s@]+@/i },
];

function shouldSkip(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  if (allowedFiles.has(path.basename(filePath))) return true;
  if (allowedExt.has(path.extname(filePath).toLowerCase())) return true;
  return rel.startsWith('sales-mgmt/package-lock.json') || rel === 'package-lock.json';
}

function trackedFiles() {
  try {
    const out = execSync('git ls-files', { cwd: root, encoding: 'utf8' });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((rel) => path.join(root, rel));
  } catch {
    return [];
  }
}

function checkFile(filePath) {
  if (shouldSkip(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const findings = [];
  for (const p of secretPatterns) {
    if (p.regex.test(content)) findings.push(p.name);
  }
  return findings;
}

const files = trackedFiles();
const hits = [];
for (const file of files) {
  try {
    const matches = checkFile(file);
    if (matches.length) {
      hits.push({ file: path.relative(root, file), matches });
    }
  } catch {
    // Skip binary/unreadable files safely.
  }
}

if (hits.length) {
  console.error('Potential secrets detected:');
  for (const hit of hits) {
    console.error(`- ${hit.file}: ${hit.matches.join(', ')}`);
  }
  process.exit(1);
}

console.log('Secret scan passed.');
