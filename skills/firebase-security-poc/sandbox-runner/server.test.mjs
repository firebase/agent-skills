/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tests the runner's orchestration with a fake `sandbox` binary that records
 * its flags and runs the script locally with /work mapped to the bind mount.
 * Run: node --test skills/firebase-security-poc/sandbox-runner/server.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fbsbx-'));
const log = path.join(tmp, 'sandbox-calls.jsonl');
const fake = path.join(tmp, 'fake-sandbox.mjs');
fs.writeFileSync(fake, `#!/usr/bin/env node
import fs from 'node:fs'; import { spawnSync } from 'node:child_process';
const a = process.argv.slice(2); const dd = a.indexOf('--');
const flags = a.slice(0, dd); const cmd = a.slice(dd + 1);
const mount = flags[flags.indexOf('--mount') + 1].match(/source=([^,]+)/)[1];
const env = {}; flags.forEach((f, i) => { if (f === '--env') { const [k, ...v] = flags[i + 1].split('='); env[k] = v.join('='); } });
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ egress: flags.includes('--allow-egress'), env, script: cmd.at(-1) }) + '\\n');
const script = cmd.at(-1).replaceAll('/work', mount).replace('mkdir -p /tmp/home', 'true');
const r = spawnSync('/bin/bash', ['-c', script], { encoding: 'utf-8', env: { PATH: process.env.PATH } });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || ''); process.exit(r.status ?? 1);
`);
fs.chmodSync(fake, 0o755);
process.env.SANDBOX_BIN = fake;
const { runJob } = await import('./server.mjs');

function tarball(files) {
  const dir = fs.mkdtempSync(path.join(tmp, 'src-'));
  for (const [rel, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), c);
  }
  return spawnSync('tar', ['-czf', '-', '-C', dir, '.']).stdout;
}

test('plain PoC runs in a no-egress sandbox with demo project env and returns the verdict', async () => {
  fs.rmSync(log, { force: true });
  const tgz = tarball({
    '.firebase-security/poc/package.json': '{"name":"p","type":"module"}',
    '.firebase-security/poc/poc_other_1.mjs': "console.log('hi from sandbox'); console.log('POC_RESULT: VULNERABLE');",
  });
  const r = await runJob(tgz, { pocFile: '.firebase-security/poc/poc_other_1.mjs', mode: 'plain' });
  assert.equal(r.verdict, 'VULNERABLE');
  assert.match(r.stdout, /hi from sandbox/);
  const calls = fs.readFileSync(log, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(calls.length, 1, 'no install phase needed');
  assert.equal(calls[0].egress, false);
  assert.equal(calls[0].env.GCLOUD_PROJECT, 'demo-security-poc');
  assert.equal(calls[0].env.GOOGLE_APPLICATION_CREDENTIALS, undefined);
});

test('rules PoC uses emulators:exec and installs extra deps in a separate egress phase', async () => {
  fs.rmSync(log, { force: true });
  const tgz = tarball({
    '.firebase-security/poc/package.json': '{"dependencies":{"left-pad":"1.3.0"}}',
    '.firebase-security/poc/poc_firestore_rules_1.mjs': "console.log('POC_RESULT: NOT_VULNERABLE')",
  });
  await runJob(tgz, { pocFile: '.firebase-security/poc/poc_firestore_rules_1.mjs', mode: 'rules', services: ['firestore', 'bogus;rm'] });
  const calls = fs.readFileSync(log, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(calls[0].egress, true);
  assert.match(calls[0].script, /npm install --ignore-scripts/);
  assert.equal(calls[1].egress, false);
  assert.match(calls[1].script, /firebase emulators:exec --only firestore --project demo-security-poc/);
  assert.doesNotMatch(calls[1].script, /bogus/);
});

test('rejects PoC files outside the PoC dir and path-traversal tarballs', async () => {
  const tgz = tarball({ '.firebase-security/poc/x.mjs': '1' });
  await assert.rejects(runJob(tgz, { pocFile: 'evil.mjs' }), /pocFile must be under/);
  await assert.rejects(runJob(tgz, { pocFile: '.firebase-security/poc/../../evil.mjs' }), /unsafe path|pocFile must be under/);
  const evilDir = fs.mkdtempSync(path.join(tmp, 'evil-'));
  fs.writeFileSync(path.join(evilDir, 'x'), 'x');
  const evil = spawnSync('tar', ['-czf', '-', '-P', '--transform', 's,^.*x$,../../escape,', '-C', evilDir, 'x']).stdout;
  await assert.rejects(runJob(evil, { pocFile: '.firebase-security/poc/x.mjs' }), /unsafe path/);
});

test('rewriteLockfileRegistry maps private-registry URLs to the public registry', async () => {
  const { rewriteLockfileRegistry } = await import('./server.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-'));
  const lock = path.join(dir, 'package-lock.json');
  fs.writeFileSync(lock, JSON.stringify({
    packages: {
      '': { name: 'fns' },
      'node_modules/yallist': { resolved: 'https://corp.example:999/npm/foundry/3p/yallist/-/yallist-4.0.0.tgz', integrity: 'sha512-x' },
      'node_modules/a/node_modules/@firebase/util': { resolved: 'https://corp.example/npm/x/@firebase/util/-/util-1.0.0.tgz' },
      'node_modules/ok': { resolved: 'https://registry.npmjs.org/ok/-/ok-1.0.0.tgz' },
    },
  }));
  assert.equal(rewriteLockfileRegistry(lock), 2);
  const out = JSON.parse(fs.readFileSync(lock, 'utf-8')).packages;
  assert.equal(out['node_modules/yallist'].resolved, 'https://registry.npmjs.org/yallist/-/yallist-4.0.0.tgz');
  assert.equal(out['node_modules/yallist'].integrity, 'sha512-x');
  assert.equal(out['node_modules/a/node_modules/@firebase/util'].resolved, 'https://registry.npmjs.org/@firebase/util/-/util-1.0.0.tgz');
});
