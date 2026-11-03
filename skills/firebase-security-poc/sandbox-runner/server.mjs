/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cloud Run sandbox runner for firebase-security-poc.
 *
 * POST /run   body: gzip tarball of the PoC dir + rules + (optionally) functions
 *             source, laid out relative to the app root.
 *             header x-poc-spec: base64(JSON {pocFile, mode, services,
 *             timeoutSec, functionsDirs, canary})
 * GET  /health   (not /healthz: Cloud Run's frontend reserves paths ending in z)
 *
 * Deploy with --no-allow-unauthenticated: only principals with
 * roles/run.invoker can submit PoCs. The host container never executes
 * uploaded code; each phase runs in a fresh Cloud Run sandbox:
 *   1. install (only if needed): egress allowed, no credentials
 *   2. run: NO egress, emulators + PoC
 * Sandboxes have no access to this container's env, secrets or the metadata
 * server (https://docs.cloud.google.com/run/docs/code-execution).
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const SANDBOX = process.env.SANDBOX_BIN || '/usr/local/gcp/bin/sandbox';
const DEMO_PROJECT_ID = 'demo-security-poc';
const MAX_UPLOAD = 50 * 1024 * 1024;
const PRESET_DEPS = new Set(['@firebase/rules-unit-testing', 'firebase']);
const POC_DIR = '.firebase-security/poc';
const CANARY = 'firebase_security_path_traversal_canary.txt';

function sandboxEnv(extra = {}) {
  const env = {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: '/tmp/home',
    NO_UPDATE_NOTIFIER: '1',
    npm_config_cache: '/tmp/npm-cache',
    npm_config_update_notifier: 'false',
    // Lockfiles generated behind a private/corp registry carry `resolved` URLs
    // the sandbox cannot reach; rewrite every registry host to one it can.
    npm_config_registry: process.env.NPM_REGISTRY || 'https://registry.npmjs.org/',
    npm_config_replace_registry_host: 'always',
    FIREBASE_EMULATORS_PATH: process.env.FIREBASE_EMULATORS_PATH || '/opt/firebase-emulators',
    GCLOUD_PROJECT: DEMO_PROJECT_ID,
    GOOGLE_CLOUD_PROJECT: DEMO_PROJECT_ID,
    FIREBASE_SECURITY_POC: '1',
    ...extra,
  };
  return Object.entries(env).flatMap(([k, v]) => ['--env', `${k}=${v}`]);
}

function sh(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** Run one phase in a fresh sandbox with the job dir bind-mounted at /work. */
function sandboxDo(workDir, script, { egress = false, timeoutSec = 300, env = {} } = {}) {
  const args = [
    'do', '--write',
    ...(process.env.SANDBOX_EXTRA_FLAGS ? process.env.SANDBOX_EXTRA_FLAGS.split(' ').filter(Boolean) : []),
    '--mount', `type=bind,source=${workDir},destination=/work`,
    ...(egress ? ['--allow-egress'] : []),
    ...sandboxEnv(env),
    '--', '/usr/bin/timeout', '--kill-after=10', String(timeoutSec), '/bin/bash', '-c', `mkdir -p /tmp/home && ${script}`,
  ];
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn(SANDBOX, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => resolve({ exitCode: -1, stdout, stderr: `${stderr}\n${e.message}`, ms: Date.now() - t0 }));
    child.on('close', (code, signal) => resolve({ exitCode: code, signal, timedOut: code === 124, stdout, stderr, ms: Date.now() - t0 }));
  });
}

function safeRel(p) {
  const n = path.posix.normalize(String(p || ''));
  if (!n || n.startsWith('/') || n.startsWith('..') || n.includes('/../')) throw new Error(`unsafe path: ${p}`);
  return n;
}

function extract(tgz, workDir) {
  const list = spawnSync('tar', ['-tzf', '-'], { input: tgz, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  if (list.status !== 0) throw new Error(`bad tarball: ${list.stderr}`);
  for (const name of list.stdout.split('\n').filter(Boolean)) safeRel(name.replace(/^\.\//, '') || '.');
  const x = spawnSync('tar', ['-xzf', '-', '-C', workDir, '--no-same-owner', '--no-same-permissions'], { input: tgz });
  if (x.status !== 0) throw new Error(`extract failed: ${x.stderr}`);
}

function parseVerdict(stdout) {
  const m = [...stdout.matchAll(/POC_RESULT:\s*(VULNERABLE|NOT_VULNERABLE)/g)].pop();
  return m ? m[1] : 'INCONCLUSIVE';
}

/** Pull the meaningful error/warn lines out of npm's debug logs (newest last). */
export function npmErrorLines(logDir, max = 60) {
  let files = [];
  try {
    files = fs.readdirSync(logDir).filter((f) => f.endsWith('.log')).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    for (const line of fs.readFileSync(path.join(logDir, f), 'utf-8').split('\n')) {
      if (/\b(error|warn)\b|ERR!|E[A-Z]{3,}\b/.test(line) && !/unfinished npm timer/.test(line)) out.push(`${f}: ${line}`);
    }
  }
  return out.slice(-max);
}

/**
 * Lockfiles generated behind a private/corp registry carry `resolved` URLs the
 * sandbox cannot reach, often with a path prefix that npm's
 * `replace-registry-host` does not strip. Rewrite each to the canonical public
 * tarball URL; `integrity` hashes are unchanged so npm still verifies content.
 */
export function rewriteLockfileRegistry(lockPath, registry = 'https://registry.npmjs.org/') {
  const lock = readJson(lockPath);
  if (!lock?.packages) return 0;
  const base = registry.endsWith('/') ? registry : `${registry}/`;
  const host = new URL(base).host;
  let n = 0;
  for (const [key, meta] of Object.entries(lock.packages)) {
    if (!key || typeof meta?.resolved !== 'string' || !/^https?:\/\//.test(meta.resolved)) continue;
    const u = new URL(meta.resolved);
    if (u.host === host || !u.pathname.endsWith('.tgz')) continue;
    const name = meta.name || key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (!name) continue;
    meta.resolved = `${base}${name}/-/${path.posix.basename(u.pathname)}`;
    n++;
  }
  if (n) fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));
  return n;
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export async function runJob(tgz, spec) {
  const id = randomUUID();
  const jobDir = path.join('/tmp/jobs', id);
  const workDir = path.join(jobDir, 'work');
  fs.mkdirSync(workDir, { recursive: true });
  fs.chmodSync(workDir, 0o777);
  const phases = [];
  try {
    extract(tgz, workDir);
    spawnSync('chmod', ['-R', 'a+rwX', workDir]);
    const pocFile = safeRel(spec.pocFile);
    if (!pocFile.startsWith(`${POC_DIR}/`)) throw new Error(`pocFile must be under ${POC_DIR}/`);
    const timeoutSec = Math.min(Number(spec.timeoutSec) || 180, 600);
    const mode = ['rules', 'endpoint', 'plain'].includes(spec.mode) ? spec.mode : 'plain';

    // ---- Phase 1: install (egress only when something must be downloaded) ----
    const installSteps = [];
    const pkg = readJson(path.join(workDir, POC_DIR, 'package.json'));
    const deps = Object.keys({ ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) });
    if (deps.every((d) => PRESET_DEPS.has(d))) {
      // Nothing (or only the preset rules-testing deps) declared: use the image's copy, no egress.
      fs.rmSync(path.join(workDir, POC_DIR, 'node_modules'), { recursive: true, force: true });
      fs.symlinkSync('/opt/poc-deps/node_modules', path.join(workDir, POC_DIR, 'node_modules'));
      phases.push({ name: 'install:poc', skipped: 'preinstalled in image' });
    } else {
      installSteps.push(`cd /work/${POC_DIR} && npm install --ignore-scripts --no-audit --no-fund --loglevel=error ${process.env.NPM_EXTRA_FLAGS || ''}`);
    }
    for (const dir of spec.functionsDirs || []) {
      const rel = safeRel(dir);
      if (!fs.existsSync(path.join(workDir, rel, 'package.json'))) continue;
      const lockPath = path.join(workDir, rel, 'package-lock.json');
      const hasLock = fs.existsSync(lockPath);
      if (hasLock) {
        const rewritten = rewriteLockfileRegistry(lockPath, process.env.NPM_REGISTRY || undefined);
        if (rewritten) phases.push({ name: `lockfile:${rel}`, rewrittenResolvedUrls: rewritten });
      }
      installSteps.push(`cd /work/${rel} && npm ${hasLock ? 'ci' : 'install'} --ignore-scripts --no-audit --no-fund --loglevel=error ${process.env.NPM_EXTRA_FLAGS || ''}`);
    }
    if (installSteps.length) {
      // npm cache + logs live on the bind mount so the host can read the real error after a failure.
      const r = await sandboxDo(workDir, `(${installSteps.join(' && ')})`, {
        egress: true,
        timeoutSec: 300,
        env: {
          npm_config_cache: '/work/.npm-cache',
          ...(process.env.SANDBOX_NODE_OPTIONS ? { NODE_OPTIONS: process.env.SANDBOX_NODE_OPTIONS } : {}),
        },
      });
      const phase = { name: 'install', egress: true, exitCode: r.exitCode, signal: r.signal, ms: r.ms, stdout: r.stdout.slice(-2000), stderr: r.stderr.slice(-2000) };
      if (r.exitCode !== 0) phase.npmErrors = npmErrorLines(path.join(workDir, '.npm-cache', '_logs'));
      phases.push(phase);
      fs.rmSync(path.join(workDir, '.npm-cache'), { recursive: true, force: true });
      if (r.exitCode !== 0) return { verdict: 'INCONCLUSIVE', phases, error: 'dependency install failed' };
    }

    // ---- Phase 2: run (no egress) ----
    if (spec.canary) fs.writeFileSync(path.join(workDir, CANARY), 'FIREBASE_SECURITY_CANARY: path traversal confirmed\n');
    const services = (spec.services || []).filter((s) => /^(firestore|storage|database|auth|functions)$/.test(s));
    const node = `node /work/${pocFile}`;
    let script;
    if (mode === 'rules' || mode === 'endpoint') {
      const cwd = mode === 'rules' ? `/work/${POC_DIR}` : '/work';
      script = `cd ${cwd} && firebase emulators:exec --only ${services.join(',')} --project ${DEMO_PROJECT_ID} ${sh(node)}`;
    } else {
      script = `cd /work/${POC_DIR} && ${node}`;
    }
    const r = await sandboxDo(workDir, script, { egress: false, timeoutSec });
    phases.push({ name: 'run', egress: false, exitCode: r.exitCode, ms: r.ms, timedOut: !!r.timedOut });
    return {
      runtime: 'cloud-run-sandbox',
      verdict: parseVerdict(r.stdout),
      exitCode: r.exitCode,
      timedOut: !!r.timedOut,
      stdout: r.stdout.slice(-12000),
      stderr: r.stderr.slice(-6000),
      phases,
    };
  } finally {
    fs.rmSync(jobDir, { recursive: true, force: true });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_UPLOAD) {
        reject(new Error('upload too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return send(200, { ok: true, sandbox: fs.existsSync(SANDBOX) });
    }
    if (req.method === 'GET' && req.url === '/health/sandbox-help') {
      const h = spawnSync(SANDBOX, ['do', '--help'], { encoding: 'utf-8' });
      return send(200, { help: `${h.stdout}${h.stderr}` });
    }
    if (req.method === 'POST' && req.url === '/run') {
      const spec = JSON.parse(Buffer.from(String(req.headers['x-poc-spec'] || ''), 'base64').toString('utf-8') || '{}');
      const body = await readBody(req);
      return send(200, await runJob(body, spec));
    }
    return send(404, { error: 'not found' });
  } catch (e) {
    return send(400, { error: e.message });
  }
});

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) server.listen(Number(process.env.PORT) || 8080);
