/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Run: node --test skills/firebase-dependency-scan/scripts/
 * (Offline: only lockfile parsing and scoring are tested.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNpmLock, parseYarnLock, parsePnpmLock, parseRequirements, parseGoMod,
  parsePubspecLock, cvss3BaseScore, severityOf,
} from './scan_deps.mjs';

test('parseNpmLock v3 marks direct and dev deps', () => {
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { next: '15.0.0' }, devDependencies: { vitest: '3.0.0' } },
      'node_modules/next': { version: '15.0.0' },
      'node_modules/vitest': { version: '3.0.0', dev: true },
      'node_modules/next/node_modules/postcss': { version: '8.4.31' },
      'node_modules/@firebase/app': { version: '0.10.0' },
    },
  };
  const pkgs = parseNpmLock(JSON.stringify(lock));
  const by = Object.fromEntries(pkgs.map((p) => [p.name, p]));
  assert.equal(by.next.direct, true);
  assert.equal(by.vitest.dev, true);
  assert.equal(by.postcss.direct, false);
  assert.equal(by['@firebase/app'].version, '0.10.0');
});

test('parseYarnLock v1 and berry', () => {
  const v1 = `# yarn lockfile v1\n\n"@babel/core@^7.0.0", "@babel/core@^7.1.0":\n  version "7.24.0"\n  resolved "x"\n\nlodash@^4.17.0:\n  version "4.17.20"\n`;
  assert.deepEqual(parseYarnLock(v1).map((p) => `${p.name}@${p.version}`), ['@babel/core@7.24.0', 'lodash@4.17.20']);
  const berry = `__metadata:\n  version: 6\n\n"lodash@npm:^4.17.0":\n  version: 4.17.21\n`;
  assert.deepEqual(parseYarnLock(berry).map((p) => `${p.name}@${p.version}`), ['lodash@4.17.21']);
});

test('parsePnpmLock v6 and v9 keys', () => {
  const lock = `lockfileVersion: '9.0'\n\npackages:\n\n  '@firebase/app@0.10.0':\n    resolution: {}\n\n  next@15.0.0(react@19.0.0):\n    resolution: {}\n\n  /lodash@4.17.20:\n    resolution: {}\n\nsnapshots:\n  foo@1.0.0: {}\n`;
  assert.deepEqual(parsePnpmLock(lock).map((p) => `${p.name}@${p.version}`), ['@firebase/app@0.10.0', 'next@15.0.0', 'lodash@4.17.20']);
});

test('parseRequirements only takes pinned versions', () => {
  const txt = 'flask==2.0.1\nrequests>=2.0\ngoogle-cloud-firestore[grpc]==2.11.0 ; python_version>"3.8"\n# c\n';
  assert.deepEqual(parseRequirements(txt).map((p) => `${p.name}@${p.version}`), ['flask@2.0.1', 'google-cloud-firestore@2.11.0']);
});

test('parseGoMod handles blocks, single requires and go version', () => {
  const mod = 'module x\n\ngo 1.21.0\n\nrequire firebase.google.com/go/v4 v4.14.0\n\nrequire (\n\tgolang.org/x/net v0.17.0 // indirect\n)\n';
  assert.deepEqual(parseGoMod(mod).map((p) => `${p.name}@${p.version}`), ['stdlib@1.21.0', 'firebase.google.com/go/v4@4.14.0', 'golang.org/x/net@0.17.0']);
});

test('parsePubspecLock keeps hosted packages only', () => {
  const lock = 'packages:\n  firebase_core:\n    dependency: "direct main"\n    description:\n      name: firebase_core\n    source: hosted\n    version: "2.24.0"\n  my_local:\n    dependency: "direct main"\n    source: path\n    version: "0.0.1"\n';
  assert.deepEqual(parsePubspecLock(lock).map((p) => `${p.name}@${p.version}`), ['firebase_core@2.24.0']);
});

test('cvss3BaseScore matches reference scores', () => {
  assert.equal(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'), 9.8);
  assert.equal(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N'), 6.1);
  assert.equal(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H'), 7.5);
  assert.equal(cvss3BaseScore('CVSS:4.0/AV:N'), null);
});

test('severityOf prefers database_specific label and normalises MODERATE', () => {
  assert.equal(severityOf({ database_specific: { severity: 'MODERATE' } }).label, 'MEDIUM');
  assert.equal(severityOf({ severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }] }).label, 'CRITICAL');
  assert.equal(severityOf({}).label, 'UNKNOWN');
});
