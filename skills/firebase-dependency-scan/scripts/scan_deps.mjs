#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dependency (SCA) scanner for the firebase-dependency-scan skill.
 *
 * Strategy (mirrors the OSV-Scanner integration in
 * https://github.com/gemini-cli-extensions/security, but with no required
 * binary):
 *   1. If `osv-scanner` is on PATH, run it and normalise its JSON output.
 *   2. Otherwise parse lockfiles locally and query the public OSV.dev API
 *      (https://google.github.io/osv.dev/api/) - no install, no API key.
 *
 * Usage:
 *   node scan_deps.mjs [--root DIR] [--format json|markdown]
 *                      [--no-osv-scanner] [--include-dev] [--out FILE]
 *   node scan_deps.mjs details <VULN_ID>
 *
 * Ignoring a finding: add it to `osv-scanner.toml` at the project root
 * (the same file OSV-Scanner uses), e.g.
 *   [[IgnoredVulns]]
 *   id = "GHSA-xxxx-xxxx-xxxx"
 *   reason = "Only reachable from a dev-only script"
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OSV_API = 'https://api.osv.dev/v1';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.venv', 'venv', '__pycache__', 'Pods', '.dart_tool', '.gradle', 'vendor', '.firebase-security', '.gemini_security', 'test', 'tests', '__tests__', 'fixtures', 'testdata']);
const SEVERITY_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, MODERATE: 2, LOW: 1, UNKNOWN: 0 };

// ---------------------------------------------------------------------------
// Lockfile discovery + parsing
// ---------------------------------------------------------------------------

const LOCKFILE_PARSERS = {
  'package-lock.json': parseNpmLock,
  'npm-shrinkwrap.json': parseNpmLock,
  'yarn.lock': parseYarnLock,
  'pnpm-lock.yaml': parsePnpmLock,
  'requirements.txt': parseRequirements,
  'poetry.lock': parseTomlPackages('PyPI'),
  'Pipfile.lock': parsePipfileLock,
  'uv.lock': parseTomlPackages('PyPI'),
  'go.mod': parseGoMod,
  'pubspec.lock': parsePubspecLock,
  'Gemfile.lock': parseGemfileLock,
  'Cargo.lock': parseTomlPackages('crates.io'),
  'composer.lock': parseComposerLock,
  'gradle.lockfile': parseGradleLock,
};

export function findLockfiles(root, rel = '', out = []) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) findLockfiles(root, childRel, out);
    } else if (LOCKFILE_PARSERS[e.name]) {
      out.push(childRel);
    }
  }
  return out;
}

export function parseNpmLock(text) {
  const lock = JSON.parse(text);
  const pkgs = [];
  if (lock.packages) {
    const root = lock.packages[''] || {};
    const direct = new Set([...Object.keys(root.dependencies || {}), ...Object.keys(root.devDependencies || {}), ...Object.keys(root.optionalDependencies || {})]);
    for (const [key, entry] of Object.entries(lock.packages)) {
      if (!key || entry.link || !entry.version) continue;
      const idx = key.lastIndexOf('node_modules/');
      if (idx === -1) continue; // workspace package source dirs
      const name = entry.name || key.slice(idx + 'node_modules/'.length);
      const isTopLevel = key === `node_modules/${name}`;
      pkgs.push({ ecosystem: 'npm', name, version: entry.version, dev: !!entry.dev, direct: isTopLevel && direct.has(name) });
    }
  } else if (lock.dependencies) {
    const walk = (deps, depth) => {
      for (const [name, entry] of Object.entries(deps)) {
        if (entry.version && !entry.version.startsWith('file:')) pkgs.push({ ecosystem: 'npm', name, version: entry.version, dev: !!entry.dev, direct: depth === 0 });
        if (entry.dependencies) walk(entry.dependencies, depth + 1);
      }
    };
    walk(lock.dependencies, 0);
  }
  return pkgs;
}

function splitNameVersion(spec) {
  // "@scope/name@1.2.3" -> ["@scope/name", "1.2.3"]
  const at = spec.lastIndexOf('@');
  if (at <= 0) return [spec, ''];
  return [spec.slice(0, at), spec.slice(at + 1)];
}

export function parseYarnLock(text) {
  const pkgs = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    if (!line.startsWith(' ') && line.endsWith(':')) {
      const first = line.slice(0, -1).split(',')[0].trim().replace(/^"|"$/g, '');
      if (first === '__metadata') {
        current = null;
        continue;
      }
      const [name] = splitNameVersion(first.replace(/@npm:/, '@'));
      current = name;
      continue;
    }
    const m = line.match(/^\s+version:?\s+"?([^"\s]+)"?/);
    if (m && current) {
      pkgs.push({ ecosystem: 'npm', name: current, version: m[1] });
      current = null;
    }
  }
  return pkgs;
}

export function parsePnpmLock(text) {
  const pkgs = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (/^\S/.test(line)) inPackages = false;
    if (!inPackages) continue;
    const m = line.match(/^ {2}['"]?\/?(.+?)['"]?:\s*$/);
    if (!m) continue;
    let spec = m[1].replace(/\(.*\)$/, ''); // strip peer suffix
    // pnpm v5/v6 used "/name/1.2.3"
    const legacy = spec.match(/^(@[^/]+\/[^/]+|[^/@][^/]*)\/(\d[^/]*)$/);
    let name;
    let version;
    if (legacy) [, name, version] = legacy;
    else [name, version] = splitNameVersion(spec);
    if (name && /^\d/.test(version)) pkgs.push({ ecosystem: 'npm', name, version });
  }
  return pkgs;
}

export function parseRequirements(text) {
  const pkgs = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.split('#')[0].split(';')[0].trim();
    const m = line.match(/^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?\s*===?\s*([A-Za-z0-9_.\-+!]+)/);
    if (m) pkgs.push({ ecosystem: 'PyPI', name: m[1], version: m[2] });
  }
  return pkgs;
}

function parseTomlPackages(ecosystem) {
  return (text) => {
    const pkgs = [];
    for (const block of text.split(/^\[\[package\]\]\s*$/m).slice(1)) {
      const name = block.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
      const version = block.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
      const source = block.match(/^source\s*=\s*(.+)$/m)?.[1] || '';
      if (ecosystem === 'crates.io' && source && !source.includes('crates.io')) continue;
      if (name && version) pkgs.push({ ecosystem, name, version });
    }
    return pkgs;
  };
}

function parsePipfileLock(text) {
  const lock = JSON.parse(text);
  const pkgs = [];
  for (const [section, dev] of [['default', false], ['develop', true]]) {
    for (const [name, e] of Object.entries(lock[section] || {})) {
      if (e.version) pkgs.push({ ecosystem: 'PyPI', name, version: e.version.replace(/^==/, ''), dev });
    }
  }
  return pkgs;
}

export function parseGoMod(text) {
  const pkgs = [];
  let inBlock = false;
  for (let line of text.split(/\r?\n/)) {
    line = line.split('//')[0].trim();
    if (/^require\s*\($/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ')') {
      inBlock = false;
      continue;
    }
    const m = inBlock ? line.match(/^(\S+)\s+(v\S+)/) : line.match(/^require\s+(\S+)\s+(v\S+)/);
    if (m) pkgs.push({ ecosystem: 'Go', name: m[1], version: m[2].replace(/^v/, '').replace(/\+incompatible$/, '') });
    const go = line.match(/^go\s+(\d+\.\d+(?:\.\d+)?)$/);
    if (go) pkgs.push({ ecosystem: 'Go', name: 'stdlib', version: go[1] });
  }
  return pkgs;
}

export function parsePubspecLock(text) {
  const pkgs = [];
  let name = null;
  let hosted = false;
  for (const line of text.split(/\r?\n/)) {
    const n = line.match(/^ {2}([A-Za-z0-9_]+):\s*$/);
    if (n) {
      name = n[1];
      hosted = false;
      continue;
    }
    if (/^ {4}source:\s*hosted/.test(line)) hosted = true;
    const v = line.match(/^ {4}version:\s*"?([^"\s]+)"?/);
    if (v && name) {
      if (hosted) pkgs.push({ ecosystem: 'Pub', name, version: v[1] });
      name = null;
    }
  }
  return pkgs;
}

function parseGemfileLock(text) {
  const pkgs = [];
  let inSpecs = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^ {2}specs:/.test(line)) {
      inSpecs = true;
      continue;
    }
    if (/^\S/.test(line)) inSpecs = false;
    const m = inSpecs && line.match(/^ {4}([A-Za-z0-9_.\-]+) \(([^)\s]+)\)$/);
    if (m) pkgs.push({ ecosystem: 'RubyGems', name: m[1], version: m[2] });
  }
  return pkgs;
}

function parseComposerLock(text) {
  const lock = JSON.parse(text);
  return [...(lock.packages || []), ...(lock['packages-dev'] || []).map((p) => ({ ...p, dev: true }))].map((p) => ({ ecosystem: 'Packagist', name: p.name, version: String(p.version).replace(/^v/, ''), dev: !!p.dev }));
}

function parseGradleLock(text) {
  const pkgs = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#:\s]+):([^:\s]+):([^=\s]+)=/);
    if (m) pkgs.push({ ecosystem: 'Maven', name: `${m[1]}:${m[2]}`, version: m[3] });
  }
  return pkgs;
}

// ---------------------------------------------------------------------------
// CVSS v3.x base score (for prioritisation when no textual severity exists)
// ---------------------------------------------------------------------------

export function cvss3BaseScore(vector) {
  if (!/^CVSS:3\.[01]\//.test(vector)) return null;
  const m = Object.fromEntries(vector.split('/').slice(1).map((kv) => kv.split(':')));
  const W = {
    AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
    AC: { L: 0.77, H: 0.44 },
    UI: { N: 0.85, R: 0.62 },
    CIA: { H: 0.56, L: 0.22, N: 0 },
  };
  const scopeChanged = m.S === 'C';
  const PR = { N: 0.85, L: scopeChanged ? 0.68 : 0.62, H: scopeChanged ? 0.5 : 0.27 }[m.PR];
  const iss = 1 - (1 - W.CIA[m.C]) * (1 - W.CIA[m.I]) * (1 - W.CIA[m.A]);
  const impact = scopeChanged ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss;
  const exploit = 8.22 * W.AV[m.AV] * W.AC[m.AC] * PR * W.UI[m.UI];
  if ([impact, exploit].some((x) => Number.isNaN(x))) return null;
  if (impact <= 0) return 0;
  const roundUp = (x) => Math.ceil(x * 10 - 1e-9) / 10;
  return roundUp(Math.min(scopeChanged ? 1.08 * (impact + exploit) : impact + exploit, 10));
}

function scoreToSeverity(score) {
  if (score == null) return 'UNKNOWN';
  if (score >= 9) return 'CRITICAL';
  if (score >= 7) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  if (score > 0) return 'LOW';
  return 'UNKNOWN';
}

export function severityOf(vuln) {
  const ds = vuln.database_specific?.severity;
  let score = null;
  for (const s of vuln.severity || []) {
    if (s.type === 'CVSS_V3') score = cvss3BaseScore(s.score);
    if (score != null) break;
  }
  if (score == null) {
    for (const a of vuln.affected || []) {
      for (const s of a.severity || []) if (s.type === 'CVSS_V3') score = cvss3BaseScore(s.score) ?? score;
    }
  }
  let label = ds ? String(ds).toUpperCase() : scoreToSeverity(score);
  if (label === 'MODERATE') label = 'MEDIUM';
  return { label, score };
}

function fixedVersionsFor(vuln, pkg) {
  const fixed = new Set();
  for (const a of vuln.affected || []) {
    if (a.package?.name !== pkg.name) continue;
    for (const r of a.ranges || []) for (const ev of r.events || []) if (ev.fixed) fixed.add(ev.fixed);
  }
  return [...fixed];
}

// ---------------------------------------------------------------------------
// Ignore list (osv-scanner.toml)
// ---------------------------------------------------------------------------

export function readIgnored(root) {
  const ids = new Set();
  try {
    const text = fs.readFileSync(path.join(root, 'osv-scanner.toml'), 'utf-8');
    for (const m of text.matchAll(/^\s*id\s*=\s*"([^"]+)"/gm)) ids.add(m[1]);
  } catch {
    /* no ignore file */
  }
  return ids;
}

// ---------------------------------------------------------------------------
// OSV.dev API
// ---------------------------------------------------------------------------

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function getVuln(id, cache) {
  if (cache.has(id)) return cache.get(id);
  const p = fetch(`${OSV_API}/vulns/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : { id }));
  cache.set(id, p);
  return p;
}

async function scanWithApi(root, lockfiles, { includeDev }) {
  const packages = [];
  const errors = [];
  for (const lf of lockfiles) {
    try {
      const parsed = LOCKFILE_PARSERS[path.basename(lf)](fs.readFileSync(path.join(root, lf), 'utf-8'));
      for (const p of parsed) packages.push({ ...p, lockfile: lf });
    } catch (e) {
      errors.push({ lockfile: lf, error: e.message });
    }
  }
  const unique = new Map();
  for (const p of packages) {
    if (!includeDev && p.dev) continue;
    const key = `${p.ecosystem}|${p.name}|${p.version}`;
    if (!unique.has(key)) unique.set(key, { ...p, lockfiles: new Set([p.lockfile]) });
    else {
      const u = unique.get(key);
      u.lockfiles.add(p.lockfile);
      u.direct = u.direct || p.direct;
    }
  }
  const list = [...unique.values()];
  const results = [];
  for (let i = 0; i < list.length; i += 1000) {
    const chunk = list.slice(i, i + 1000);
    const body = { queries: chunk.map((p) => ({ package: { ecosystem: p.ecosystem, name: p.name }, version: p.version })) };
    const resp = await postJson(`${OSV_API}/querybatch`, body);
    resp.results.forEach((r, j) => {
      if (r.vulns?.length) results.push({ pkg: chunk[j], ids: r.vulns.map((v) => v.id) });
    });
  }
  const cache = new Map();
  const findings = [];
  for (const { pkg, ids } of results) {
    const vulns = await Promise.all(ids.map((id) => getVuln(id, cache)));
    for (const v of vulns) findings.push(toFinding(v, pkg, [...pkg.lockfiles]));
  }
  return { packagesScanned: list.length, findings, errors };
}

function toFinding(v, pkg, lockfiles) {
  const sev = severityOf(v);
  return {
    id: v.id,
    aliases: v.aliases || [],
    summary: v.summary || (v.details || '').split('\n')[0].slice(0, 200),
    severity: sev.label,
    cvss: sev.score,
    package: pkg.name,
    version: pkg.version,
    ecosystem: pkg.ecosystem,
    direct: pkg.direct ?? null,
    dev: pkg.dev ?? false,
    fixedIn: fixedVersionsFor(v, pkg),
    lockfiles,
    url: `https://osv.dev/vulnerability/${v.id}`,
  };
}

// ---------------------------------------------------------------------------
// osv-scanner binary (preferred when available)
// ---------------------------------------------------------------------------

function hasOsvScanner() {
  const r = spawnSync('osv-scanner', ['--version'], { encoding: 'utf-8' });
  return r.status === 0;
}

function scanWithBinary(root) {
  // v2 syntax first, then v1.
  for (const args of [['scan', 'source', '-r', '--format', 'json', root], ['--format', 'json', '-r', root]]) {
    const r = spawnSync('osv-scanner', args, { encoding: 'utf-8', maxBuffer: 128 * 1024 * 1024 });
    if (!r.stdout || !r.stdout.trim().startsWith('{')) continue;
    const out = JSON.parse(r.stdout);
    const findings = [];
    let packagesScanned = 0;
    for (const res of out.results || []) {
      const lf = path.relative(root, res.source?.path || '');
      for (const p of res.packages || []) {
        packagesScanned++;
        const pkg = { name: p.package.name, version: p.package.version, ecosystem: p.package.ecosystem };
        for (const v of p.vulnerabilities || []) findings.push(toFinding(v, pkg, [lf]));
      }
    }
    return { packagesScanned, findings, errors: [] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function dedupeAndSort(findings, ignored) {
  const seen = new Map();
  for (const f of findings) {
    if (ignored.has(f.id) || f.aliases.some((a) => ignored.has(a))) continue;
    const key = `${f.id}|${f.package}|${f.version}`;
    if (!seen.has(key)) seen.set(key, f);
  }
  // Collapse aliases (e.g. GHSA + CVE for the same advisory on same package).
  const byAlias = new Map();
  for (const f of seen.values()) {
    const group = [f.id, ...f.aliases].sort()[0] + `|${f.package}|${f.version}`;
    const prev = byAlias.get(group);
    if (!prev || (SEVERITY_ORDER[f.severity] || 0) > (SEVERITY_ORDER[prev.severity] || 0)) byAlias.set(group, f);
  }
  return [...byAlias.values()].sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0) || (b.cvss || 0) - (a.cvss || 0) || Number(b.direct) - Number(a.direct));
}

function toMarkdown(report) {
  const lines = [];
  lines.push(`# Dependency scan (${report.scanner})`, '');
  lines.push(`Lockfiles: ${report.lockfiles.join(', ') || 'none found'}  `);
  lines.push(`Packages scanned: ${report.packagesScanned}  `);
  const counts = report.summary;
  lines.push(`Findings: ${report.findings.length} (critical ${counts.CRITICAL}, high ${counts.HIGH}, medium ${counts.MEDIUM}, low ${counts.LOW}, unknown ${counts.UNKNOWN})`, '');
  if (report.findings.length) {
    lines.push('| Severity | Package | Version | Direct | Fixed in | Advisory | Summary |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const f of report.findings) {
      lines.push(`| ${f.severity}${f.cvss != null ? ` (${f.cvss})` : ''} | ${f.package} | ${f.version} | ${f.direct == null ? '?' : f.direct ? 'yes' : 'no'} | ${f.fixedIn.join(', ') || 'no fix'} | [${f.id}](${f.url}) | ${f.summary.replace(/\|/g, '\\|')} |`);
    }
  }
  if (report.errors.length) lines.push('', 'Parse errors:', ...report.errors.map((e) => `- ${e.lockfile}: ${e.error}`));
  return lines.join('\n');
}

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const n = argv[i + 1];
      if (n === undefined || n.startsWith('--')) o[k] = true;
      else {
        o[k] = n;
        i++;
      }
    } else o._.push(a);
  }
  return o;
}

export async function main(argv = process.argv.slice(2)) {
  const o = parseArgs(argv);
  if (o._[0] === 'details') {
    const v = await getVuln(o._[1], new Map());
    process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
    return 0;
  }
  const root = path.resolve(o.root || process.cwd());
  const lockfiles = findLockfiles(root);
  const ignored = readIgnored(root);
  let scanner = 'osv.dev-api';
  let result = null;
  if (!o['no-osv-scanner'] && hasOsvScanner()) {
    result = scanWithBinary(root);
    if (result) scanner = 'osv-scanner';
  }
  if (!result) {
    if (lockfiles.length === 0) {
      const hint = fs.existsSync(path.join(root, 'package.json')) ? ' Found package.json without a lockfile: run `npm install --package-lock-only` first so exact versions can be checked.' : '';
      process.stdout.write(`${JSON.stringify({ scanner, lockfiles: [], findings: [], note: `No supported lockfiles found.${hint}` }, null, 2)}\n`);
      return 0;
    }
    result = await scanWithApi(root, lockfiles, { includeDev: !!o['include-dev'] });
  }
  const findings = dedupeAndSort(result.findings, ignored);
  const summary = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  for (const f of findings) summary[f.severity in summary ? f.severity : 'UNKNOWN']++;
  const report = { scanner, scannedAt: new Date().toISOString(), lockfiles, packagesScanned: result.packagesScanned, ignored: [...ignored], summary, findings, errors: result.errors };
  const text = o.format === 'markdown' ? toMarkdown(report) : JSON.stringify(report, null, 2);
  if (o.out) fs.writeFileSync(path.resolve(root, o.out), `${text}\n`);
  process.stdout.write(`${text}\n`);
  return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  main().then((code) => (process.exitCode = code)).catch((e) => {
    process.stderr.write(`scan_deps failed: ${e.message}\n`);
    process.exitCode = 1;
  });
}
