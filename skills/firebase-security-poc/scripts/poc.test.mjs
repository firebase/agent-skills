/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Run: node --test skills/firebase-security-poc/scripts/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initPoc, runPoc, parseVerdict, buildPocEnv, checkPocSource, emulatorPorts, classifyPoc, sandboxUploadPaths, runPocInSandbox, PATH_TRAVERSAL_CANARY } from './poc.mjs';
import http from 'node:http';
import { spawnSync } from 'node:child_process';

function tmpProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbpoc-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

test('parseVerdict takes the last POC_RESULT line', () => {
  assert.equal(parseVerdict('x\nPOC_RESULT: VULNERABLE\n'), 'VULNERABLE');
  assert.equal(parseVerdict('POC_RESULT: VULNERABLE\nPOC_RESULT: NOT_VULNERABLE'), 'NOT_VULNERABLE');
  assert.equal(parseVerdict('nothing'), 'INCONCLUSIVE');
});

test('initPoc for rules writes an isolated emulator config on a demo project', () => {
  const dir = tmpProject({
    'package.json': '{}',
    'firebase.json': JSON.stringify({ firestore: { rules: 'firestore.rules' } }),
    'firestore.rules': "rules_version = '2';",
  });
  const r = initPoc(dir, { type: 'firestore_rules', location: 'firestore.rules:3' });
  assert.match(r.pocFileName, /^poc_firestore_rules_\d+\.mjs$/);
  assert.equal(r.emulator.projectId, 'demo-security-poc');
  const cfg = JSON.parse(fs.readFileSync(path.join(r.pocDir, 'firebase.json'), 'utf-8'));
  assert.equal(cfg.emulators.firestore.port, 8181);
  assert.equal(cfg.firestore, undefined);
  assert.equal(r.emulator.rules.firestore, path.join(dir, 'firestore.rules'));
});

test('runPoc refuses files outside the PoC dir', () => {
  const dir = tmpProject({ 'package.json': '{}', 'evil.mjs': 'console.log(1)' });
  assert.throws(() => runPoc(dir, 'evil.mjs'), /Security Error/);
});

test('runPoc runs node PoCs, creates and removes the traversal canary', () => {
  const dir = tmpProject({ 'package.json': '{}' });
  const r = initPoc(dir, { type: 'path_traversal' });
  const file = path.join(r.pocDir, r.pocFileName);
  fs.writeFileSync(file, `import fs from 'node:fs';\nconst t = fs.readFileSync('../../${PATH_TRAVERSAL_CANARY}', 'utf8');\nconsole.log(t);\nconsole.log('POC_RESULT: ' + (t.includes('CANARY') ? 'VULNERABLE' : 'NOT_VULNERABLE'));\n`);
  const out = runPoc(dir, file);
  assert.equal(out.verdict, 'VULNERABLE');
  assert.equal(fs.existsSync(path.join(dir, PATH_TRAVERSAL_CANARY)), false);
});

test('buildPocEnv drops credentials and isolates HOME / gcloud / npm config', () => {
  const dir = tmpProject({ 'package.json': '{}', 'firebase.json': JSON.stringify({ emulators: { firestore: { port: 8282 } } }) });
  const env = buildPocEnv(dir, {
    realHome: '/home/dev',
    baseEnv: {
      PATH: '/usr/bin', JAVA_HOME: '/jdk', GOOGLE_APPLICATION_CREDENTIALS: '/home/dev/key.json',
      FIREBASE_TOKEN: 'tok', CLOUDSDK_CONFIG: '/home/dev/.config/gcloud', NPM_TOKEN: 'npm', AWS_SECRET_ACCESS_KEY: 'x',
    },
  });
  for (const k of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'NPM_TOKEN', 'AWS_SECRET_ACCESS_KEY']) assert.equal(env[k], undefined, k);
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.JAVA_HOME, '/jdk');
  const pocHome = path.join(dir, '.firebase-security', 'poc', '.home');
  assert.equal(env.HOME, pocHome);
  assert.ok(env.CLOUDSDK_CONFIG.startsWith(pocHome));
  assert.ok(env.npm_config_userconfig.startsWith(pocHome));
  assert.equal(fs.readFileSync(env.npm_config_userconfig, 'utf-8'), '');
  assert.equal(env.FIREBASE_EMULATORS_PATH, '/home/dev/.cache/firebase/emulators');
  assert.equal(env.GCLOUD_PROJECT, 'demo-security-poc');
  assert.equal(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8282');
  assert.equal(env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
});

test('emulatorPorts falls back to defaults', () => {
  const dir = tmpProject({ 'package.json': '{}' });
  assert.deepEqual(emulatorPorts(dir), { firestore: 8181, storage: 9199, database: 9009, auth: 9099, functions: 5001 });
});

test('checkPocSource allows local demo PoCs and flags remote / prod / credential use', () => {
  const ok = "const BASE = 'http://127.0.0.1:5001/demo-security-poc/us-central1';\nfetch(`${BASE}/x`); fetch('http://localhost:3000');\ninitializeTestEnvironment({ projectId: 'demo-security-poc' });";
  assert.deepEqual(checkPocSource(ok), []);
  const bad = [
    ["fetch('https://myapp.web.app/api')", /non-local host 'myapp.web.app'/],
    ["initializeApp({ projectId: 'my-prod-app' })", /non-demo projectId 'my-prod-app'/],
    ['initializeApp({ credential: applicationDefault() })', /Application Default Credentials/],
    ["require('./serviceAccountKey.json')", /service-account key/],
    ['process.env.GOOGLE_APPLICATION_CREDENTIALS', /credential env var/],
    ["fs.readFileSync(os.homedir() + '/.config/gcloud/credentials.db')", /local credential file/],
  ];
  for (const [src, rx] of bad) assert.match(checkPocSource(src).join('; '), rx, src);
});

test('runPoc refuses unsafe PoCs unless --allow-unsafe', () => {
  const dir = tmpProject({ 'package.json': '{}', '.firebase-security/poc/poc_other_1.mjs': "await fetch('https://example.com');" });
  assert.throws(() => runPoc(dir, '.firebase-security/poc/poc_other_1.mjs'), /PoC refused - targets non-local host 'example.com'/);
});

test('PoC process cannot see host credentials (end-to-end)', () => {
  const realHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fbhome-'));
  fs.mkdirSync(path.join(realHome, '.config', 'gcloud'), { recursive: true });
  fs.writeFileSync(path.join(realHome, '.config', 'gcloud', 'application_default_credentials.json'), '{"secret":"ADC"}');
  const poc = [
    "import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';",
    "const adc = path.join(os.homedir(), '.con' + 'fig', 'gcl' + 'oud', 'application_default' + '_credentials.json');",
    "const leaked = { gac: process.env['GOOGLE_APPLI' + 'CATION_CREDENTIALS'] ?? null, token: process.env['FIREBASE_TO' + 'KEN'] ?? null, adcVisible: fs.existsSync(adc), home: os.homedir() };",
    'console.log(JSON.stringify(leaked));',
    "console.log('POC_RESULT: ' + (leaked.gac || leaked.token || leaked.adcVisible ? 'VULNERABLE' : 'NOT_VULNERABLE'));",
  ].join('\n');
  const dir = tmpProject({ 'package.json': '{}', '.firebase-security/poc/poc_other_2.mjs': poc });
  const saved = { HOME: process.env.HOME, G: process.env.GOOGLE_APPLICATION_CREDENTIALS, T: process.env.FIREBASE_TOKEN };
  process.env.HOME = realHome;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(realHome, 'key.json');
  process.env.FIREBASE_TOKEN = 'secret-token';
  try {
    const r = runPoc(dir, '.firebase-security/poc/poc_other_2.mjs');
    const leaked = JSON.parse(r.stdout.split('\n')[0]);
    assert.equal(leaked.gac, null);
    assert.equal(leaked.token, null);
    assert.equal(leaked.adcVisible, false);
    assert.ok(leaked.home.startsWith(dir));
    assert.equal(r.verdict, 'NOT_VULNERABLE');
  } finally {
    for (const [k, v] of [['HOME', saved.HOME], ['GOOGLE_APPLICATION_CREDENTIALS', saved.G], ['FIREBASE_TOKEN', saved.T]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('classifyPoc + sandboxUploadPaths pick the right mode and never upload the whole repo', () => {
  const dir = tmpProject({
    'package.json': '{}',
    'firebase.json': JSON.stringify({ firestore: { rules: 'firestore.rules' }, functions: [{ source: 'functions' }] }),
    'firestore.rules': "rules_version = '2';",
    'functions/index.js': '//',
    'src/secret-app-code.js': '//',
    '.firebase-security/poc/poc_firestore_rules_1.mjs': '//',
    '.firebase-security/poc/poc_http_endpoint_1.mjs': "fetch('http://127.0.0.1:5001/demo-security-poc/us-central1/f')",
  });
  const rules = classifyPoc(dir, path.join(dir, '.firebase-security/poc/poc_firestore_rules_1.mjs'));
  assert.deepEqual(rules, { mode: 'rules', services: ['firestore'], functionsDirs: [] });
  assert.deepEqual(sandboxUploadPaths(dir, rules).sort(), ['.firebase-security/poc', 'firebase.json', 'firestore.rules']);
  const ep = classifyPoc(dir, path.join(dir, '.firebase-security/poc/poc_http_endpoint_1.mjs'));
  assert.equal(ep.mode, 'endpoint');
  assert.deepEqual(ep.services, ['functions', 'firestore', 'auth']);
  assert.ok(sandboxUploadPaths(dir, ep).includes('functions'));
  assert.ok(!sandboxUploadPaths(dir, ep).includes('src'));
});

test('runPocInSandbox uploads a tarball with spec + bearer token and returns the runner verdict', async () => {
  const dir = tmpProject({
    'package.json': '{}',
    'firestore.rules': "rules_version = '2';",
    '.firebase-security/poc/poc_firestore_rules_1.mjs': "import '@firebase/rules-unit-testing'; // projectId: 'demo-security-poc'",
    '.firebase-security/poc/node_modules/big/index.js': 'x'.repeat(1000),
  });
  let seen;
  const srv = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      seen = {
        auth: req.headers.authorization,
        spec: JSON.parse(Buffer.from(req.headers['x-poc-spec'], 'base64').toString()),
        files: spawnSync('tar', ['-tzf', '-'], { input: body, encoding: 'utf-8' }).stdout,
      };
      res.end(JSON.stringify({ verdict: 'VULNERABLE', stdout: 'POC_RESULT: VULNERABLE' }));
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const r = await runPocInSandbox(dir, '.firebase-security/poc/poc_firestore_rules_1.mjs', { url: `http://127.0.0.1:${srv.address().port}`, token: 'tok123' });
    assert.equal(r.verdict, 'VULNERABLE');
    assert.equal(r.runtime, 'cloud-run-sandbox');
    assert.equal(seen.auth, 'Bearer tok123');
    assert.equal(seen.spec.mode, 'rules');
    assert.equal(seen.spec.pocFile, '.firebase-security/poc/poc_firestore_rules_1.mjs');
    assert.match(seen.files, /firestore\.rules/);
    assert.doesNotMatch(seen.files, /node_modules/);
  } finally {
    srv.close();
  }
});

test('runPocInSandbox applies the same source guard before uploading', async () => {
  const dir = tmpProject({ 'package.json': '{}', '.firebase-security/poc/poc_other_9.mjs': "fetch('https://prod.example.com')" });
  await assert.rejects(runPocInSandbox(dir, '.firebase-security/poc/poc_other_9.mjs', { url: 'http://127.0.0.1:1', token: 't' }), /PoC refused/);
});

test('shellQuote quotes for POSIX sh and Windows cmd/MSVCRT', async () => {
  const { shellQuote } = await import('./poc.mjs');
  assert.equal(shellQuote("it's", 'linux'), `'it'\\''s'`);
  assert.equal(shellQuote('C:\\a b\\poc.mjs', 'win32'), '"C:\\a b\\poc.mjs"');
  assert.equal(shellQuote('say "hi"', 'win32'), '"say \\"hi\\""');
  assert.equal(shellQuote('dir\\', 'win32'), '"dir\\\\"');
});
