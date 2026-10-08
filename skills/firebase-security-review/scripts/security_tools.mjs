#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Helper CLI for the firebase-security-review skill.
 *
 * Portions adapted from https://github.com/gemini-cli-extensions/security
 * (Apache-2.0): audit scope, file filtering, line lookup and markdown -> JSON
 * report conversion. Re-implemented here as a dependency-free script so it
 * works in every agent that can run `node` (Gemini CLI, Claude Code, Cursor,
 * Codex, Antigravity, ...), without needing an extra MCP server.
 *
 * Usage: node security_tools.mjs <command> [options]
 *
 * Commands:
 *   init                       Create the .firebase-security/ working dir.
 *   context                    Detect Firebase services, frameworks, rules
 *                              files, env/secret files and risky signals.
 *   scope [--base B --head H]  Changed files (+ untracked) to audit. Use
 *         [--diff]             --diff to print the unified diff as well.
 *   files                      All auditable files for a full-repo scan.
 *   line-count <file...>       Total line count of the given files.
 *   find-lines --file F (--snippet S | --snippet-file P)
 *                              1-based start/end line of a snippet in F.
 *   report-to-json [--in P] [--out P]
 *                              Convert a markdown findings report to JSON.
 *
 * All commands print JSON to stdout (except `scope --diff`, which prints the
 * JSON summary followed by the raw diff) and accept `--root <dir>`
 * (default: current working directory).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const SECURITY_DIR_NAME = '.firebase-security';

export const IGNORED_FOLDERS = [
  'node_modules', 'dist', 'build', 'out', 'target', 'bin', 'obj', 'vendor',
  'docs', 'documentation', 'tests', 'test', 'spec', '__tests__', '__mocks__',
  '.github', '.vscode', '.idea', '.git', 'assets', 'images',
  '.next', '.nuxt', '.svelte-kit', '.angular', '.expo', '.dart_tool',
  'bower_components', 'jspm_packages', '.firebase', '.turbo', '.vercel',
  '.npm', '.yarn', '.pnpm', 'coverage', '.cache', '.tmp', 'temp',
  'Pods', 'DerivedData', '.gradle', '.venv', 'venv', '__pycache__',
  SECURITY_DIR_NAME, '.gemini_security',
];

export const IGNORED_EXTENSIONS = [
  '.md', '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  '.mp4', '.mov', '.avi', '.wmv', '.mkv', '.mp3', '.wav', '.flac', '.ogg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.lock', '-lock.json', '.sum', '-lock.yaml',
  '.exe', '.dll', '.so', '.dylib', '.pyc', '.class', '.pyo', '.o', '.obj',
  '.jar', '.aar', '.apk', '.ipa', '.zip', '.gz', '.tgz',
  '.DS_Store', '.gitkeep', '.dockerignore', '.eslintignore', '.prettierignore',
  '.editorconfig', '.map', '.snap',
  '.test.ts', '.test.js', '.spec.ts', '.spec.js',
  '.test.tsx', '.test.jsx', '.spec.tsx', '.spec.jsx',
  '_test.go', '_test.py', '_test.dart',
];

export const IGNORED_FILES = [
  'LICENSE', 'CHANGELOG', 'CONTRIBUTING', 'CODE_OF_CONDUCT', 'SECURITY.md',
  '.gitignore', '.prettierrc', '.eslintrc', '.eslintignore', '.prettierignore',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'go.sum', 'Cargo.lock',
  'Gemfile.lock', 'composer.lock', 'pubspec.lock', 'Podfile.lock',
  'poetry.lock', 'npm-debug.log', 'yarn-debug.log', 'yarn-error.log',
  'package.json', 'requirements.txt', 'pubspec.yaml', 'Pipfile', 'go.mod',
  '.env.example', '.env.template', '.env.dist', '.env.sample',
];

/**
 * Files that are always security-relevant for Firebase apps, even if their
 * extension would otherwise be ignored. Matched against the basename.
 */
export const FIREBASE_CONFIG_PATTERNS = [
  /^firestore\.rules$/,
  /^storage\.rules$/,
  /\.rules$/,
  /^database\.rules\.json$/,
  /^firebase\.json$/,
  /^\.firebaserc$/,
  /^apphosting(\.[\w-]+)?\.yaml$/,
  /^dataconnect\.yaml$/,
  /^connector\.yaml$/,
  /\.gql$/,
  /^firestore\.indexes\.json$/,
  /^remoteconfig\.template\.json$/,
  /^google-services\.json$/,
  /^GoogleService-Info\.plist$/,
  /^firebase_options\.dart$/,
  /^\.env(\.[\w-]+)?$/,
  /^cors\.json$/,
];

const SOURCE_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.vue',
  '.svelte', '.astro', '.html', '.htm', '.py', '.go', '.dart', '.kt', '.kts',
  '.java', '.swift', '.m', '.rb', '.php', '.cs', '.rs', '.sql', '.gql',
  '.graphql', '.yaml', '.yml', '.json', '.rules', '.toml', '.xml', '.plist',
  '.sh', '.ps1', '.tf',
]);

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function git(args, cwd) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: res.status === 0, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() };
}

function isGitRepo(cwd) {
  return git(['rev-parse', '--is-inside-work-tree'], cwd).stdout === 'true';
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

export function isFirebaseConfigFile(relPath) {
  const base = path.basename(relPath);
  return FIREBASE_CONFIG_PATTERNS.some((rx) => rx.test(base));
}

/**
 * Decides whether a repo-relative path should be included in an audit.
 * Firebase config / rules / env files are always included.
 */
export function shouldAudit(relPath) {
  const posix = toPosix(relPath);
  const parts = posix.split('/');
  const fileName = parts[parts.length - 1] || '';
  const lower = fileName.toLowerCase();

  if (parts.slice(0, -1).some((p) => IGNORED_FOLDERS.includes(p))) return false;
  if (isFirebaseConfigFile(posix)) {
    // Example/template env files are intentionally non-secret.
    return !IGNORED_FILES.some((f) => f.toLowerCase() === lower);
  }
  if (IGNORED_FILES.some((f) => f.toLowerCase() === lower)) return false;
  if (IGNORED_EXTENSIONS.some((ext) => lower.endsWith(ext.toLowerCase()))) return false;
  const ext = path.extname(lower);
  if (ext && !SOURCE_EXTENSIONS.has(ext)) return false;
  if (!ext && !['dockerfile', 'procfile', 'makefile'].includes(lower)) return false;
  return true;
}

/**
 * Coarse classification used to prioritise review order and to decide which
 * checklist applies (e.g. secrets in client bundles vs. server code).
 */
export function classifyFile(relPath, content = '') {
  const posix = toPosix(relPath);
  if (isFirebaseConfigFile(posix)) return 'firebase-config';
  const head = content.slice(0, 400);
  if (/^\s*['"]use server['"]/m.test(head)) return 'server';
  if (/^\s*['"]use client['"]/m.test(head)) return 'client';
  if (/(^|\/)(functions|server|api|backend|cloud-functions|genkit)(\/|$)/.test(posix)) return 'server';
  if (/(^|\/)app\/.*\/route\.(t|j)sx?$/.test(posix) || /(^|\/)pages\/api\//.test(posix)) return 'server';
  if (/(^|\/)middleware\.(t|j)s$/.test(posix) || /\.server\.(t|j)sx?$/.test(posix)) return 'server';
  if (/(^|\/)(components|pages|app|src|public|lib\/client|hooks|views)(\/|$)/.test(posix)) return 'client';
  if (/\.(dart|swift|kt|java|m)$/.test(posix)) return 'client';
  return 'other';
}

function walk(root, rel = '', out = []) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (IGNORED_FOLDERS.includes(e.name)) continue;
      walk(root, childRel, out);
    } else if (e.isFile()) {
      out.push(childRel);
    }
  }
  return out;
}

export function listAllFiles(root) {
  if (isGitRepo(root)) {
    const tracked = git(['ls-files'], root).stdout.split('\n');
    const untracked = git(['ls-files', '--others', '--exclude-standard'], root).stdout.split('\n');
    return [...new Set([...tracked, ...untracked].filter(Boolean))];
  }
  return walk(root);
}

export function getLineCount(files, root = process.cwd()) {
  let total = 0;
  for (const f of files) {
    const text = readText(path.resolve(root, f));
    if (text != null) total += (text.match(/\n/g) || []).length + (text.endsWith('\n') || text === '' ? 0 : 1);
  }
  return total;
}

function summarizeFiles(files, root) {
  const groups = { 'firebase-config': [], server: [], client: [], other: [] };
  for (const f of files) {
    const content = readText(path.join(root, f)) || '';
    groups[classifyFile(f, content)].push(f);
  }
  return {
    totalFiles: files.length,
    totalLines: getLineCount(files, root),
    // Review order: config/rules first (highest leverage for Firebase apps),
    // then server code (trust boundary), then client code.
    reviewOrder: [...groups['firebase-config'], ...groups.server, ...groups.client, ...groups.other],
    groups,
  };
}

// ---------------------------------------------------------------------------
// scope / files
// ---------------------------------------------------------------------------

/**
 * Returns the set of changed files to audit. Unlike a plain `git diff`, this
 * also includes untracked files (new files created by an agent are very often
 * untracked) and handles repos without remotes or without any commits.
 */
export function getAuditScope(root, { base, head } = {}) {
  if (!isGitRepo(root)) {
    return { mode: 'no-git', note: 'Not a git repository; falling back to a full scan.', files: listAllFiles(root), diff: '' };
  }
  let diffArgs;
  let mode;
  const hasHead = git(['rev-parse', '--verify', 'HEAD'], root).ok;
  if (base && head) {
    diffArgs = [base, head];
    mode = `range ${base}..${head}`;
  } else if (base) {
    diffArgs = ['--merge-base', base];
    mode = `merge-base ${base} + working tree`;
  } else if (git(['rev-parse', '--verify', 'origin/HEAD'], root).ok && hasHead) {
    diffArgs = ['--merge-base', 'origin/HEAD'];
    mode = 'merge-base origin/HEAD + working tree';
  } else if (hasHead) {
    diffArgs = ['HEAD'];
    mode = 'uncommitted changes vs HEAD';
  } else {
    return { mode: 'no-commits', note: 'Repository has no commits; falling back to a full scan.', files: listAllFiles(root), diff: '' };
  }
  const names = git(['diff', '--name-only', '--diff-filter=ACMR', ...diffArgs], root).stdout.split('\n').filter(Boolean);
  const diff = git(['diff', ...diffArgs], root).stdout;
  let untracked = [];
  if (!(base && head)) {
    untracked = git(['ls-files', '--others', '--exclude-standard'], root).stdout.split('\n').filter(Boolean);
  }
  const files = [...new Set([...names, ...untracked])];
  return { mode, files, untracked, diff };
}

// ---------------------------------------------------------------------------
// context: Firebase-aware project fingerprint
// ---------------------------------------------------------------------------

function safeJson(text) {
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    // firebase.json / rules json may contain comments in some projects.
    try {
      return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
    } catch {
      return null;
    }
  }
}

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

const RISK_SIGNALS = [
  // [id, file matcher, regex, hint]
  ['rules-allow-if-true', /\.rules$/, /allow\s+[\w\s,]+:\s*if\s+true\s*;/, 'Rules grant access unconditionally (`if true`).'],
  ['rules-allow-no-condition', /\.rules$/, /allow\s+(read|write|get|list|create|update|delete)(\s*,\s*\w+)*\s*;/, 'Rules `allow` statement without a condition (always true).'],
  ['rules-test-mode-expiry', /\.rules$/, /request\.time\s*<\s*timestamp\.date\(/, 'Rules still in "test mode" (time-boxed open access).'],
  ['rules-auth-only', /\.rules$/, /allow\s+[\w\s,]+:\s*if\s+request\.auth\s*!=\s*null\s*;/, 'Any signed-in user can access (no ownership check) - verify intent.'],
  ['rules-recursive-wildcard', /\.rules$/, /match\s+\/\{[^}]*=\*\*\}/, 'Recursive wildcard match - check it is not combined with a permissive allow.'],
  ['rtdb-public', /database\.rules\.json$/, /"\.(read|write)"\s*:\s*(true|"true")/, 'Realtime Database path is publicly readable/writable.'],
  ['service-account-key', /\.json$/, /"type"\s*:\s*"service_account"[\s\S]*"private_key"/, 'Service account private key file present in the repo.'],
  ['private-key-pem', /./, /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'PEM private key material present.'],
  ['admin-sdk-in-client', /\.(jsx?|tsx?|vue|svelte)$/, /from\s+['"]firebase-admin|require\(['"]firebase-admin/, 'firebase-admin imported - make sure this file never ships to the browser.'],
  ['public-env-secret', /\.(env(\.[\w-]+)?|jsx?|tsx?)$/, /(NEXT_PUBLIC|VITE|EXPO_PUBLIC|REACT_APP|PUBLIC)_[A-Z0-9_]*(SECRET|PRIVATE|SERVICE_ACCOUNT|ADMIN|STRIPE_SK|OPENAI|ANTHROPIC|GEMINI_API|PASSWORD)[A-Z0-9_]*\s*[=:]/, 'Secret-looking variable exposed via a client-public env prefix.'],
  ['gemini-key-in-client', /\.(jsx?|tsx?|vue|svelte|dart|swift|kt)$/, /AIza[0-9A-Za-z_-]{35}[\s\S]{0,200}(generativelanguage|GoogleGenerativeAI|GoogleGenAI)|(GoogleGenerativeAI|GoogleGenAI)\([^)]*AIza[0-9A-Za-z_-]{35}/, 'Gemini Developer API key used directly in client code (use Firebase AI Logic + App Check, or a server proxy).'],
  ['stripe-secret', /./, /sk_(live|test)_[0-9a-zA-Z]{16,}/, 'Stripe secret key literal.'],
  ['openai-key', /./, /sk-(proj-)?[A-Za-z0-9_-]{32,}/, 'OpenAI-style secret key literal.'],
  ['onrequest-cors-any', /\.(jsx?|tsx?)$/, /onRequest\(\s*\{[^}]*cors\s*:\s*true/, 'HTTPS function allows any CORS origin - verify it also authenticates callers.'],
  ['oncall-no-appcheck', /\.(jsx?|tsx?)$/, /onCall\(\s*(async\s*)?\(/, 'Callable function without options object - App Check enforcement likely off; verify auth checks inside.'],
  ['dangerously-set-inner-html', /\.(jsx|tsx)$/, /dangerouslySetInnerHTML/, 'React raw HTML sink.'],
  ['eval-sink', /\.(jsx?|tsx?|py)$/, /\beval\(|new Function\(|['"](node:)?child_process['"]|(?<![.\w])exec(Sync)?\(|\bos\.system\(|subprocess\.(run|call|Popen)\([^)]*shell\s*=\s*True/, 'Code/command execution sink.'],
  ['dataconnect-public', /\.gql$/, /@auth\(\s*level\s*:\s*PUBLIC/, 'Data Connect operation callable by anyone (`@auth(level: PUBLIC)`).'],
  ['apphosting-plain-secret', /^apphosting(\.[\w-]+)?\.yaml$/, /variable:\s*\S*(SECRET|KEY|TOKEN|PASSWORD)\S*\s*\n\s*value:/i, 'Secret-looking App Hosting env var set with `value:` instead of `secret:`.'],
];

/** Signals that only matter when the file ships to browsers/devices. */
const CLIENT_ONLY_SIGNALS = new Set(['admin-sdk-in-client', 'gemini-key-in-client']);

export function getFirebaseContext(root) {
  const ctx = {
    root,
    git: isGitRepo(root),
    firebaseProject: null,
    services: {},
    rulesFiles: [],
    frameworks: [],
    sdks: [],
    envFiles: [],
    secretsInGit: [],
    signals: [],
    notes: [],
  };

  const rc = safeJson(readText(path.join(root, '.firebaserc')));
  if (rc?.projects) ctx.firebaseProject = rc.projects;

  const fj = safeJson(readText(path.join(root, 'firebase.json')));
  if (fj) {
    if (fj.firestore) ctx.services.firestore = asArray(fj.firestore).map((f) => ({ rules: f.rules || null, database: f.database || '(default)' }));
    if (fj.storage) ctx.services.storage = asArray(fj.storage).map((s) => ({ rules: s.rules || null, bucket: s.bucket || '(default)' }));
    if (fj.database) ctx.services.database = asArray(fj.database).map((d) => ({ rules: d.rules || null, instance: d.instance || '(default)' }));
    if (fj.functions) ctx.services.functions = asArray(fj.functions).map((f) => ({ source: f.source || 'functions', codebase: f.codebase || 'default' }));
    if (fj.hosting) {
      ctx.services.hosting = asArray(fj.hosting).map((h) => ({
        public: h.public || null,
        site: h.site || h.target || null,
        hasSecurityHeaders: JSON.stringify(h.headers || []).match(/Content-Security-Policy|Strict-Transport-Security|X-Frame-Options/i) != null,
        rewritesToFunctions: JSON.stringify(h.rewrites || []).includes('"function"'),
      }));
    }
    if (fj.apphosting) ctx.services.apphosting = asArray(fj.apphosting);
    if (fj.dataconnect) ctx.services.dataconnect = asArray(fj.dataconnect);
    if (fj.emulators) ctx.services.emulators = Object.keys(fj.emulators);
  } else {
    ctx.notes.push('No firebase.json found at root; Firebase services inferred from code only.');
  }

  const files = listAllFiles(root);

  // Rules files (declared or discovered).
  const declared = new Set();
  for (const svc of ['firestore', 'storage', 'database']) {
    for (const entry of ctx.services[svc] || []) if (entry.rules) declared.add(entry.rules);
  }
  for (const f of files) {
    if (/(^|\/)(firestore|storage)\.rules$|\.rules$|(^|\/)database\.rules\.json$/.test(f) && !f.includes('node_modules')) declared.add(f);
  }
  ctx.rulesFiles = [...declared].map((f) => ({ path: f, exists: exists(path.join(root, f)) }));

  // Frameworks and SDKs from every package.json / pubspec / requirements.
  const pkgFiles = files.filter((f) => /(^|\/)package\.json$/.test(f) && !f.includes('node_modules'));
  const fw = new Set();
  const sdks = new Set();
  for (const pf of pkgFiles) {
    const pkg = safeJson(readText(path.join(root, pf))) || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [name, label] of [
      ['next', 'Next.js'], ['react', 'React'], ['vite', 'Vite'], ['@angular/core', 'Angular'],
      ['vue', 'Vue'], ['nuxt', 'Nuxt'], ['svelte', 'Svelte'], ['@sveltejs/kit', 'SvelteKit'],
      ['astro', 'Astro'], ['express', 'Express'], ['expo', 'Expo'], ['react-native', 'React Native'],
      ['@remix-run/react', 'Remix'],
    ]) if (deps[name]) fw.add(label);
    for (const name of Object.keys(deps)) {
      if (/^(firebase|firebase-admin|firebase-functions|@firebase\/|genkit|@genkit-ai\/|@google\/generative-ai|@google\/genai|reactfire|@angular\/fire|openai|@anthropic-ai\/sdk|stripe)/.test(name)) {
        sdks.add(`${name}@${deps[name]}${pf === 'package.json' ? '' : ` (${pf})`}`);
      }
    }
  }
  if (files.some((f) => /(^|\/)pubspec\.yaml$/.test(f))) fw.add('Flutter');
  if (files.some((f) => /\.xcodeproj\//.test(f) || /(^|\/)Podfile$/.test(f))) fw.add('iOS');
  if (files.some((f) => /(^|\/)build\.gradle(\.kts)?$/.test(f))) fw.add('Android');
  ctx.frameworks = [...fw];
  ctx.sdks = [...sdks];

  // Env files and whether they are tracked by git (= leaked).
  for (const f of files) {
    const base = path.basename(f);
    if (/^\.env(\.[\w-]+)?$/.test(base) && !IGNORED_FILES.includes(base)) {
      let tracked = false;
      if (ctx.git) tracked = git(['ls-files', '--error-unmatch', f], root).ok;
      ctx.envFiles.push({ path: f, trackedByGit: tracked });
      if (tracked) ctx.secretsInGit.push(f);
    }
  }

  // Lightweight signals: NOT findings. They are leads for the Recon pass.
  for (const f of files) {
    if (!shouldAudit(f) && !/\.json$/.test(f)) continue;
    if (f.includes('node_modules')) continue;
    const full = path.join(root, f);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.size > 512 * 1024) continue;
    const text = readText(full);
    if (text == null) continue;
    const base = path.basename(f);
    const kind = classifyFile(f, text);
    for (const [id, fileRx, rx, hint] of RISK_SIGNALS) {
      if (!(fileRx.test(base) || fileRx.test(f))) continue;
      if (CLIENT_ONLY_SIGNALS.has(id) && kind === 'server') continue;
      const m = rx.exec(text);
      if (!m) continue;
      const line = text.slice(0, m.index).split('\n').length;
      ctx.signals.push({ id, file: f, line, hint });
      if (id === 'service-account-key' && ctx.git && git(['ls-files', '--error-unmatch', f], root).ok) ctx.secretsInGit.push(f);
    }
  }

  // Note: Firebase Web API keys (AIza...) in firebaseConfig are identifiers,
  // not secrets. They are intentionally NOT reported as signals.
  ctx.notes.push('Firebase web config apiKey values are public identifiers, not secrets - do not report them unless the key is used for a non-Firebase API (e.g. Gemini Developer API) or lacks API restrictions.');
  return ctx;
}

// ---------------------------------------------------------------------------
// find-lines
// ---------------------------------------------------------------------------

export function findLineNumbers(fileContent, snippet) {
  const lines = fileContent.split(/\r?\n/);
  const snippetLines = snippet.split(/\r?\n/).map((l) => l.trim()).filter((l, i, arr) => !(l === '' && (i === 0 || i === arr.length - 1)));
  if (snippetLines.length === 0) return { error: 'Empty snippet.' };
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(snippetLines[0]) && lines[i].trim() !== snippetLines[0]) continue;
    let ok = true;
    for (let j = 1; j < snippetLines.length; j++) {
      if (i + j >= lines.length || lines[i + j].trim() !== snippetLines[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return { startLine: i + 1, endLine: i + snippetLines.length };
  }
  return { error: 'Snippet was not found.' };
}

// ---------------------------------------------------------------------------
// report-to-json (port of parser.ts from gemini-cli-extensions/security)
// ---------------------------------------------------------------------------

const FIELD_NAMES = [
  'ID', 'Vulnerability', 'Vulnerability Type', 'Severity', 'Confidence', 'Source Location',
  'Sink Location', 'Source', 'Sink', 'Data Type', 'Data', 'Line Content', 'Line',
  'Description', 'Recommendation', 'Phase', 'Firebase Service',
].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

function extractField(section, label, bold = false) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Bold reports (`- **Field**: value`) only treat bold labels as field
  // boundaries, so a description line like "Data: ..." does not truncate it.
  const b = bold ? '\\*\\*' : '';
  const item = bold ? '(?:[-*]\\s+)?' : '';
  const rx = new RegExp(`(?:^|\\n)\\s*${item}${b}${escaped}${b}:\\s*([\\s\\S]*?)(?=\\n\\s*${item}${b}(?:${FIELD_NAMES})${b}:|$)`, 'i');
  const m = section.match(rx);
  if (!m) return null;
  return (bold ? m[1].replace(/^\s*[*-]\s+/gm, '').replace(/\*\*/g, '') : m[1]).trim();
}

export function parseLocation(str) {
  if (!str) return { file: null, startLine: null, endLine: null };
  const clean = str.replace(/`/g, '').trim();
  const m = clean.match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);
  if (!m) return { file: clean, startLine: null, endLine: null };
  const start = m[2] ? parseInt(m[2], 10) : null;
  const end = m[3] ? parseInt(m[3], 10) : start;
  return { file: m[1].trim(), startLine: start, endLine: end };
}

export function parseMarkdownReport(content) {
  const bold = new RegExp(`\\*\\*(?:${FIELD_NAMES})\\*\\*:`, 'i').test(content);
  // Loose mode (plain `Field:` lines) strips list markers and bold up front.
  const clean = bold ? content : content.replace(/^\s*[*-]\s+/gm, '').replace(/\*\*/g, '');
  let sections;
  if (/^#{1,6} /m.test(clean)) sections = clean.split(/\n(?=#{1,6} )/);
  else if (/^\s*(?:[-*]\s+)?(?:\*\*)?ID(?:\*\*)?:/m.test(clean)) sections = clean.split(/\n(?=\s*(?:[-*]\s+)?(?:\*\*)?ID(?:\*\*)?:)/);
  else sections = clean.split(/\n(?=\s*(?:[-*]\s+)?(?:\*\*)?Vulnerability(?:\*\*)?:)/);
  const field = (section, label) => extractField(section, label, bold);
  const findings = [];
  for (let section of sections) {
    section = section.trim();
    if (!/(^|\n)\s*(?:[-*]\s+)?(?:\*\*)?Vulnerability(?:\*\*)?:/i.test(section)) continue;
    let lineContent = field(section, 'Line Content');
    if (lineContent) lineContent = lineContent.replace(/^```[\w-]*\n?|```$/gm, '').trim();
    let recommendation = field(section, 'Recommendation');
    let codeSuggestion = null;
    if (recommendation) {
      const cm = recommendation.match(/```[^\n`]*\n?([\s\S]*?)```/);
      if (cm) {
        codeSuggestion = cm[1].trim();
        recommendation = recommendation.replace(cm[0], '').trim();
      }
    }
    findings.push({
      id: field(section, 'ID'),
      vulnerability: field(section, 'Vulnerability'),
      vulnerabilityType: field(section, 'Vulnerability Type'),
      severity: field(section, 'Severity'),
      confidence: field(section, 'Confidence'),
      firebaseService: field(section, 'Firebase Service'),
      phase: field(section, 'Phase'),
      dataType: field(section, 'Data Type'),
      sourceLocation: parseLocation(field(section, 'Source Location')),
      sinkLocation: parseLocation(field(section, 'Sink Location')),
      lineContent,
      description: field(section, 'Description'),
      recommendation,
      codeSuggestion,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

export function initSecurityDir(root) {
  const dir = path.join(root, SECURITY_DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });
  const gi = path.join(dir, '.gitignore');
  if (!exists(gi)) {
    // Keep the allowlist + final reports (useful to commit); ignore scratch.
    fs.writeFileSync(gi, ['# Scratch files created by the firebase-security-review skill', 'SECURITY_ANALYSIS_TODO.md', 'DRAFT_SECURITY_REPORT.md', 'poc/', ''].join('\n'));
  }
  const allow = path.join(dir, 'vuln_allowlist.txt');
  return {
    dir,
    allowlist: exists(allow) ? allow : null,
    allowlistContent: exists(allow) ? readText(allow) : null,
    existingReport: exists(path.join(dir, 'SECURITY_REPORT.md')) ? path.join(dir, 'SECURITY_REPORT.md') : null,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) opts[key] = true;
      else {
        opts[key] = next;
        i++;
      }
    } else opts._.push(a);
  }
  return opts;
}

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

export function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;
  const opts = parseArgs(rest);
  const root = path.resolve(opts.root || process.cwd());

  switch (cmd) {
    case 'init':
      print(initSecurityDir(root));
      return 0;
    case 'context':
      print(getFirebaseContext(root));
      return 0;
    case 'scope': {
      const s = getAuditScope(root, { base: opts.base, head: opts.head });
      const auditable = s.files.filter(shouldAudit);
      const summary = summarizeFiles(auditable, root);
      print({ mode: s.mode, note: s.note, changedFiles: s.files.length, skipped: s.files.filter((f) => !shouldAudit(f)), ...summary });
      if (opts.diff && s.diff) process.stdout.write(`\n----- DIFF -----\n${s.diff}\n`);
      return 0;
    }
    case 'files': {
      const all = listAllFiles(root).filter(shouldAudit);
      print(summarizeFiles(all, root));
      return 0;
    }
    case 'line-count':
      print({ totalLines: getLineCount(opts._, root) });
      return 0;
    case 'find-lines': {
      if (!opts.file || (!opts.snippet && !opts['snippet-file'])) {
        print({ error: 'Usage: find-lines --file F (--snippet S | --snippet-file P)' });
        return 2;
      }
      const content = readText(path.resolve(root, opts.file));
      if (content == null) {
        print({ error: `Cannot read ${opts.file}` });
        return 1;
      }
      const snippet = opts.snippet || readText(path.resolve(root, opts['snippet-file'])) || '';
      print(findLineNumbers(content, String(snippet)));
      return 0;
    }
    case 'report-to-json': {
      const inPath = path.resolve(root, opts.in || path.join(SECURITY_DIR_NAME, 'SECURITY_REPORT.md'));
      const outPath = path.resolve(root, opts.out || path.join(SECURITY_DIR_NAME, 'security_report.json'));
      const md = readText(inPath);
      if (md == null) {
        print({ error: `Cannot read ${inPath}` });
        return 1;
      }
      const findings = parseMarkdownReport(md);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2)}\n`);
      print({ ok: true, out: outPath, findings: findings.length });
      return 0;
    }
    default:
      process.stderr.write('Usage: security_tools.mjs <init|context|scope|files|line-count|find-lines|report-to-json> [--root DIR]\n');
      return 2;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) process.exitCode = main();
