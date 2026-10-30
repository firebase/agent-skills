/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Run: node --test skills/firebase-security-review/scripts/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  shouldAudit, classifyFile, findLineNumbers, parseMarkdownReport, parseLocation,
  getFirebaseContext, getAuditScope, initSecurityDir,
} from './security_tools.mjs';

function tmpProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbsec-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

test('shouldAudit keeps Firebase config and source, drops noise', () => {
  assert.equal(shouldAudit('firestore.rules'), true);
  assert.equal(shouldAudit('database.rules.json'), true);
  assert.equal(shouldAudit('apphosting.yaml'), true);
  assert.equal(shouldAudit('.env.local'), true);
  assert.equal(shouldAudit('.env.example'), false);
  assert.equal(shouldAudit('src/app/page.tsx'), true);
  assert.equal(shouldAudit('functions/src/index.ts'), true);
  assert.equal(shouldAudit('node_modules/x/index.js'), false);
  assert.equal(shouldAudit('package-lock.json'), false);
  assert.equal(shouldAudit('src/a.test.ts'), false);
  assert.equal(shouldAudit('README.md'), false);
  assert.equal(shouldAudit('public/logo.png'), false);
});

test('classifyFile separates server, client and config', () => {
  assert.equal(classifyFile('firestore.rules'), 'firebase-config');
  assert.equal(classifyFile('functions/src/index.ts'), 'server');
  assert.equal(classifyFile('src/app/api/users/route.ts'), 'server');
  assert.equal(classifyFile('src/lib/actions.ts', "'use server';\nexport async function x(){}"), 'server');
  assert.equal(classifyFile('src/components/Bio.tsx'), 'client');
});

test('findLineNumbers finds single and multi-line snippets', () => {
  const content = 'a\n  const x = 1;\n  const y = 2;\nb\n';
  assert.deepEqual(findLineNumbers(content, 'const x = 1;'), { startLine: 2, endLine: 2 });
  assert.deepEqual(findLineNumbers(content, 'const x = 1;\nconst y = 2;'), { startLine: 2, endLine: 3 });
  assert.ok(findLineNumbers(content, 'nope').error);
});

test('parseLocation handles ranges, single lines and bare files', () => {
  assert.deepEqual(parseLocation('`firestore.rules:8-10`'), { file: 'firestore.rules', startLine: 8, endLine: 10 });
  assert.deepEqual(parseLocation('src/a.ts:5'), { file: 'src/a.ts', startLine: 5, endLine: 5 });
  assert.deepEqual(parseLocation('src/a.ts'), { file: 'src/a.ts', startLine: null, endLine: null });
});

test('parseMarkdownReport extracts structured findings', () => {
  const md = `# Report

### VULN-001: Open rules

- **ID:** VULN-001
- **Vulnerability:** Open Firestore rules
- **Vulnerability Type:** Security
- **Firebase Service:** Firestore Security Rules
- **Severity:** Critical
- **Confidence:** High
- **Phase:** inline
- **Source Location:** firestore.rules:5-6
- **Line Content:** \`allow read, write: if true;\`
- **Description:** Anyone can read and write all data.
- **Recommendation:** Restrict access.
  \`\`\`
  allow read: if request.auth.uid == userId;
  \`\`\`

### VULN-002: XSS

- **ID:** VULN-002
- **Vulnerability:** Stored XSS
- **Vulnerability Type:** Security
- **Severity:** High
- **Source Location:** src/Bio.tsx:4
- **Line Content:** \`<div dangerouslySetInnerHTML={{ __html: bio }} />\`
- **Description:** User bio rendered as HTML.
- **Recommendation:** Render as text.
`;
  const f = parseMarkdownReport(md);
  assert.equal(f.length, 2);
  assert.equal(f[0].id, 'VULN-001');
  assert.equal(f[0].severity, 'Critical');
  assert.equal(f[0].firebaseService, 'Firestore Security Rules');
  assert.equal(f[0].phase, 'inline');
  assert.deepEqual(f[0].sourceLocation, { file: 'firestore.rules', startLine: 5, endLine: 6 });
  assert.match(f[0].codeSuggestion, /request\.auth\.uid == userId/);
  assert.equal(f[1].vulnerability, 'Stored XSS');
  assert.equal(f[1].sourceLocation.startLine, 4);
});

test('getFirebaseContext detects services, signals and tracked secrets', () => {
  const dir = tmpProject({
    'firebase.json': JSON.stringify({ firestore: { rules: 'firestore.rules' }, functions: { source: 'functions' }, hosting: { public: 'dist' } }),
    'firestore.rules': "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{db}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}\n",
    'package.json': JSON.stringify({ dependencies: { firebase: '^11.0.0', next: '15.0.0' } }),
    '.env': 'STRIPE_SECRET=sk_live_abcdefghijklmnop1234\n',
    'src/lib/firebase.ts': "export const firebaseConfig = { apiKey: 'AIzaSyA-not-a-secret-xxxxxxxxxxxxxxxxxxx' };\n",
  });
  spawnSync('git', ['init', '-q'], { cwd: dir });
  spawnSync('git', ['add', '-A'], { cwd: dir });
  const ctx = getFirebaseContext(dir);
  assert.ok(ctx.services.firestore);
  assert.ok(ctx.services.functions);
  assert.ok(ctx.frameworks.includes('Next.js'));
  assert.ok(ctx.signals.some((s) => s.id === 'rules-allow-if-true' && s.line === 5));
  assert.ok(ctx.signals.some((s) => s.id === 'stripe-secret'));
  assert.deepEqual(ctx.secretsInGit, ['.env']);
  // Firebase web apiKey must not be flagged.
  assert.ok(!ctx.signals.some((s) => s.file === 'src/lib/firebase.ts'));
});

test('getAuditScope includes untracked files and handles no-commit repos', () => {
  const dir = tmpProject({ 'a.js': 'x', 'b.js': 'y' });
  spawnSync('git', ['init', '-q'], { cwd: dir });
  assert.equal(getAuditScope(dir).mode, 'no-commits');
  spawnSync('git', ['add', 'a.js'], { cwd: dir });
  spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'a.js'), 'changed');
  const s = getAuditScope(dir);
  assert.equal(s.mode, 'uncommitted changes vs HEAD');
  assert.deepEqual(s.files.sort(), ['a.js', 'b.js']);
});

test('initSecurityDir creates dir with scratch gitignore', () => {
  const dir = tmpProject({});
  const r = initSecurityDir(dir);
  assert.ok(fs.existsSync(path.join(r.dir, '.gitignore')));
  assert.equal(r.allowlist, null);
});

test('parseMarkdownReport (bold labels) does not truncate on field-like words in prose', () => {
  const md = [
    '### VULN-001: Open rules',
    '',
    '- **ID**: VULN-001',
    '- **Vulnerability**: Anyone can read user profiles',
    '- **Severity**: High',
    '- **Source Location**: `firestore.rules:8-10`',
    '- **Description**: The rule allows reads without auth.',
    '  Data: email and phone numbers are exposed.',
    '  Source: any unauthenticated client.',
    '- **Recommendation**: Require `request.auth.uid == userId`.',
  ].join('\n');
  const [f] = parseMarkdownReport(md);
  assert.equal(f.id, 'VULN-001');
  assert.equal(f.severity, 'High');
  assert.match(f.description, /Data: email and phone numbers are exposed\./);
  assert.match(f.description, /Source: any unauthenticated client\./);
  assert.deepEqual(f.sourceLocation, { file: 'firestore.rules', startLine: 8, endLine: 10 });
  assert.match(f.recommendation, /request\.auth\.uid/);
});

test('parseMarkdownReport still parses plain `Field:` reports', () => {
  const md = 'ID: V1\nVulnerability: XSS\nSeverity: Medium\nSink Location: src/a.tsx:5\nDescription: bad\n';
  const [f] = parseMarkdownReport(md);
  assert.equal(f.id, 'V1');
  assert.equal(f.severity, 'Medium');
  assert.deepEqual(f.sinkLocation, { file: 'src/a.tsx', startLine: 5, endLine: 5 });
});
