import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve @google/generative-ai from scripts/skill-token-counter if not in root node_modules
const requireFromTokenCounter = createRequire(
  path.join(__dirname, 'skill-token-counter', 'package.json')
);

const EXCLUDED_SKILLS = new Set([
  'developing-genkit-dart',
  'developing-genkit-go',
  'developing-genkit-js',
  'developing-genkit-python',
  'xcode-project-setup',
  'firebase-hosting-basics',
  'firebase-app-hosting-basics',
  'extension-to-functions-codebase',
]);

const EXCLUDED_FILE_PATTERNS = [/ios/i, /web/i, /flutter/i];

function shouldExcludeFile(relativePathFromSkillRoot) {
  const basename = path.basename(relativePathFromSkillRoot);
  if (basename === 'SKILL.md') return false;
  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}

function splitFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { rawFrontmatter: '', body: content };
  }
  return { rawFrontmatter: match[1], body: match[2] };
}

/**
 * Extracts top-level YAML blocks from frontmatter so we can deterministically
 * sync non-prose fields (like `metadata`, `version`, `compatibility`) without
 * needing an LLM call when only metadata changes on `main`.
 */
function parseFrontmatterBlocks(rawFrontmatter) {
  const blocks = new Map();
  let currentKey = null;
  let currentLines = [];

  for (const line of rawFrontmatter.split('\n')) {
    const topLevelMatch = line.match(/^([a-zA-Z0-9_-]+):(.*)$/);
    if (topLevelMatch) {
      if (currentKey !== null) {
        blocks.set(currentKey, currentLines.join('\n'));
      }
      currentKey = topLevelMatch[1];
      currentLines = [line];
    } else if (currentKey !== null) {
      currentLines.push(line);
    }
  }
  if (currentKey !== null) {
    blocks.set(currentKey, currentLines.join('\n'));
  }
  return blocks;
}

function mergeMetadataBlocks(mainMetadataBlock, targetMetadataBlock) {
  if (!mainMetadataBlock) return targetMetadataBlock;
  if (!targetMetadataBlock) return mainMetadataBlock;

  const parseSubKeys = (block) => {
    const map = new Map();
    for (const line of block.split('\n').slice(1)) {
      const m = line.match(/^\s+([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (m) {
        map.set(m[1], line);
      }
    }
    return map;
  };

  const mainSub = parseSubKeys(mainMetadataBlock);
  const targetSub = parseSubKeys(targetMetadataBlock);
  const merged = new Map();
  for (const [k, v] of mainSub.entries()) merged.set(k, v);
  for (const [k, v] of targetSub.entries()) {
    if (!merged.has(k)) merged.set(k, v);
  }

  return ['metadata:', ...merged.values()].join('\n');
}

/**
 * Deterministically merges frontmatter from `main` into a target `SKILL.md`,
 * preserving the target's Android-specific `description` while taking all
 * other frontmatter blocks (`name`, `version`, `compatibility`, `metadata`)
 * directly from `main` (and preserving any existing `metadata` sub-keys on target).
 */
function syncFrontmatterDeterministically(mainContent, targetContent) {
  const mainParts = splitFrontmatter(mainContent);
  const targetParts = splitFrontmatter(targetContent);
  if (!mainParts.rawFrontmatter) return targetContent;

  const mainBlocks = parseFrontmatterBlocks(mainParts.rawFrontmatter);
  const targetBlocks = parseFrontmatterBlocks(targetParts.rawFrontmatter);

  const mergedLines = [];
  for (const [key, blockText] of mainBlocks.entries()) {
    if (key === 'description' && targetBlocks.has('description')) {
      mergedLines.push(targetBlocks.get('description'));
    } else if (key === 'metadata') {
      mergedLines.push(mergeMetadataBlocks(blockText, targetBlocks.get('metadata')));
    } else {
      mergedLines.push(blockText);
    }
  }
  if (!mainBlocks.has('metadata') && targetBlocks.has('metadata')) {
    mergedLines.push(targetBlocks.get('metadata'));
  }

  return `---\n${mergedLines.join('\n')}\n---\n${targetParts.body}`;
}

function listFilesRecursive(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath, baseDir));
    } else {
      results.push(relPath);
    }
  }
  return results.sort();
}

/**
 * Strips links pointing to excluded iOS/Web/Flutter local reference files
 * without touching JSON/code block trailing commas.
 */
function stripExcludedLocalLinks(markdown) {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, _label, href) => {
    if (/^https?:\/\//i.test(href)) return match;
    const isExcluded = EXCLUDED_FILE_PATTERNS.some((pattern) =>
      pattern.test(href)
    );
    return isExcluded ? '' : match;
  });
}

async function rewriteSkillMdWithLLM({
  skillName,
  mainSkillMd,
  existingTargetSkillMd,
  survivingFiles,
  model,
}) {
  const precleaned = stripExcludedLocalLinks(mainSkillMd);
  const prompt = `You are maintaining the Android Studio distribution branch (\`platform/android-studio\`) of the \`firebase/agent-skills\` repository.
Your task is to adapt the upstream \`skills/${skillName}/SKILL.md\` file from \`main\` into an Android-focused \`SKILL.md\` for Android Studio.

### Surviving files in \`skills/${skillName}/\` on \`platform/android-studio\`:
${survivingFiles.map((f) => `- ${f}`).join('\n')}

### Strict Rules:
1. Preserve the YAML frontmatter keys (\`name\`, \`description\`, \`compatibility\`, \`version\`, \`metadata\`) from the upstream \`main\` file. In \`description\`, remove mentions of iOS/Xcode/Web/Flutter-only artifacts (e.g., \`GoogleService-Info.plist\`, Next.js, iOS, Flutter, Web) so it accurately describes Android and platform-agnostic capabilities.
2. Remove links to reference files that are NOT in the surviving files list above (such as iOS, Web, or Flutter setup/SDK guides).
3. Remove bullet points, table rows, or subsections that are exclusively for iOS, Web, or Flutter.
4. Rewrite sentences that list multiple client platforms so they refer to Android (and backend/admin/CLI where applicable) with natural, grammatically correct prose.
5. DO NOT alter any JSON examples, code blocks, CLI commands (other than removing iOS-only CLI flags/commands), or generic/Android instructions.
6. Output ONLY the complete markdown content of \`SKILL.md\` (starting with \`---\` and ending with the markdown body). Do not wrap the response in outer markdown code fences.

${
  existingTargetSkillMd
    ? `### Previous \`platform/android-studio\` version of \`skills/${skillName}/SKILL.md\` (for reference on how platform exclusions were previously styled):\n<<<<EXISTING\n${existingTargetSkillMd}\nEXISTING>>>>\n`
    : ''
}
### Upstream \`main\` version of \`skills/${skillName}/SKILL.md\` (with links to deleted local files stripped):
<<<<UPSTREAM
${precleaned}
UPSTREAM>>>>`;

  const result = await model.generateContent(prompt);
  let output = result.response.text();

  // Strip accidental outer ```markdown ... ``` fences if the model added them
  output = output.replace(/^```(?:markdown|yaml)?\r?\n/i, '').replace(/\r?\n```\s*$/, '');
  if (!output.endsWith('\n')) {
    output += '\n';
  }

  // Ensure non-description frontmatter blocks (metadata, version, compatibility, name) match main exactly
  return syncFrontmatterDeterministically(mainSkillMd, output);
}

/**
 * Checks if `description` or markdown `body` changed between `beforeSha` and current `mainContent`.
 * If only non-prose frontmatter fields (e.g. `metadata`, `version`, `compatibility`) changed,
 * returns false so Category 2 can deterministically sync frontmatter without calling the LLM.
 */
function didProseOrDescriptionChange(repoRoot, beforeSha, skillMdRepoPath, mainContent) {
  if (!beforeSha || /^0+$/.test(beforeSha)) return true;
  try {
    const prevContent = execFileSync(
      'git',
      ['-C', repoRoot, 'show', `${beforeSha}:${skillMdRepoPath}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const prevParts = splitFrontmatter(prevContent);
    const currParts = splitFrontmatter(mainContent);
    if (prevParts.body !== currParts.body) return true;

    const prevBlocks = parseFrontmatterBlocks(prevParts.rawFrontmatter);
    const currBlocks = parseFrontmatterBlocks(currParts.rawFrontmatter);
    return (prevBlocks.get('description') || '') !== (currBlocks.get('description') || '');
  } catch {
    // File didn't exist at beforeSha or git revision unavailable
    return true;
  }
}

/**
 * Local Android Studio SKILL.md adapter (authored via Jetski so local runs
 * do not require an external GEMINI_API_KEY HTTP call).
 */
function adaptSkillMdLocally(skillName, mainSkillMd) {
  let out = mainSkillMd;

  if (skillName === 'firebase-remote-config-basics') {
    out = out.replace(/\(Android,\s*iOS\)/g, '(Android)');
    out = out.replace(/^[ \t]*[*-][ \t]+\*\*iOS\*\*:[ \t]*\[ios_setup\.md\]\(references\/ios_setup\.md\)\r?\n?/gm, '');
  } else if (skillName === 'firebase-auth-basics') {
    out = out.replace(/\*\*Web\*\*[\s\n]+See \[references\/client_sdk_web\.md\]\(references\/client_sdk_web\.md\)\.\r?\n\r?\n?/g, '');
    out = out.replace(/\*\*Flutter\*\*[\s\n]+See \[references\/flutter_setup\.md\]\(references\/flutter_setup\.md\)\.\r?\n\r?\n?/g, '');
    out = out.replace(/\*\*iOS \(Swift\)\*\*[\s\n]+See \[references\/ios_setup\.md\]\(references\/ios_setup\.md\)\.\r?\n\r?\n?/g, '');
  } else if (skillName === 'firebase-basics') {
    out = out.replace(/`google-services\.json`,\s*`GoogleService-Info\.plist`/g, '`google-services.json`');
    out = out.replace(/[\s\n]+or[\s\n]+`GoogleService-Info\.plist`/g, '');
    out = out.replace(/When setting up[\s\n]+iOS[\s\n]+or[\s\n]+Android[\s\n]+apps/g, 'When setting up Android apps');
    out = out.replace(
      /^[ \t]*[-*1.]+[ \t]+For iOS:[ \t\r\n]+`npx -y firebase-tools@latest apps:sdkconfig IOS <APP_ID> --project <PROJECT_ID>`\r?\n/gm,
      ''
    );
    out = out.replace(
      /,[\s\n]+or[\s\n]+a[\s\n]+path[\s\n]+to[\s\n]+be[\s\n]+linked[\s\n]+by[\s\n]+`xcode-project-setup`[\s\n]+for[\s\n]+iOS/g,
      ''
    );
    out = out.replace(/^[ \t]*[-*][ \t]+\*\*Web\*\*:[ \t]*See \[references\/web_setup\.md\]\(references\/web_setup\.md\)\r?\n/gm, '');
    out = out.replace(/^[ \t]*[-*][ \t]+\*\*iOS\*\*:[ \t]*See \[references\/ios_setup\.md\]\(references\/ios_setup\.md\)\r?\n/gm, '');
    out = out.replace(/^[ \t]*[-*][ \t]+\*\*Flutter\*\*:[ \t]*See \[references\/flutter_setup\.md\]\(references\/flutter_setup\.md\)\r?\n/gm, '');
  } else if (skillName === 'firebase-crashlytics') {
    out = out.replace(/^[ \t]*[*-][ \t]+\*\*iOS\*\*:[ \t]*\[ios_setup\.md\]\(references\/ios_setup\.md\)\r?\n/gm, '');
    out = out.replace(/^[ \t]*[*-][ \t]+\*\*iOS\*\*:[ \t]*\[Customize Crash Reports for Apple Platforms\]\([^)]+\)\r?\n/gm, '');
  } else if (skillName === 'firebase-data-connect-basics') {
    out = out.replace(
      /  javascriptSdk:\r?\n    outputDir: "\.\.\/web-app\/src\/lib\/dataconnect"\r?\n    package: "@movie-app\/dataconnect"\r?\n/g,
      ''
    );
    out = out.replace(
      /  swiftSdk:\r?\n    outputDir: "\.\.\/ios-app\/DataConnect"(?:\r?\n    package: "DataConnectGenerated")?\r?\n/g,
      ''
    );
    out = out.replace(/^[ \t]*[*-][ \t]+\*\*Web \(TypeScript\)\*\*:[ \t]*\[reference\/sdk_web\.md\]\(reference\/sdk_web\.md\)\r?\n/gm, '');
    out = out.replace(/^[ \t]*[*-][ \t]+\*\*iOS \(Swift\)\*\*:[ \t]*\[reference\/sdk_ios\.md\]\(reference\/sdk_ios\.md\)\r?\n/gm, '');
    out = out.replace(/^[ \t]*[*-][ \t]+\*\*Flutter \(Dart\)\*\*:[ \t]*\[reference\/sdk_flutter\.md\]\(reference\/sdk_flutter\.md\)\r?\n/gm, '');
  } else if (skillName === 'firebase-firestore') {
    out = out.replace(/\(Web,\s*Python,\s*iOS,\s*Android,\s*Flutter\)/g, '(Android, Python)');
    out = out.replace(
      /Read \[web_sdk_usage\.md\]\(references\/standard\/web_sdk_usage\.md\),[\s\n]+\[android_sdk_usage\.md\]\(references\/standard\/android_sdk_usage\.md\),[\s\n]+\[ios_setup\.md\]\(references\/standard\/ios_setup\.md\),[\s\n]+or[\s\n]+\[flutter_setup\.md\]\(references\/standard\/flutter_setup\.md\)/g,
      'Read [android_sdk_usage.md](references/standard/android_sdk_usage.md)'
    );
    out = out.replace(
      /Read \[web_sdk_usage\.md\]\(references\/enterprise\/web_sdk_usage\.md\),[\s\n]+\[python_sdk_usage\.md\]\(references\/enterprise\/python_sdk_usage\.md\),[\s\n]+\[android_sdk_usage\.md\]\(references\/enterprise\/android_sdk_usage\.md\),[\s\n]+\[ios_setup\.md\]\(references\/enterprise\/ios_setup\.md\),[\s\n]+or[\s\n]+\[flutter_setup\.md\]\(references\/enterprise\/flutter_setup\.md\)/g,
      'Read [python_sdk_usage.md](references/enterprise/python_sdk_usage.md) or [android_sdk_usage.md](references/enterprise/android_sdk_usage.md)'
    );
  } else if (skillName === 'firebase-ai-logic-basics') {
    out = out.replace(/into web applications/g, 'into Android applications');
    out = out.replace(
      /The library is part of the standard Firebase Web SDK\.\r?\n\r?\n`npm install firebase@latest`\r?\n\r?\n/g,
      ''
    );
    out = out.replace(
      /See[\s\n]+\[App Check with reCAPTCHA Enterprise\]\(https:\/\/firebase\.google\.com\/docs\/app-check\/web\/recaptcha-enterprise-provider\.md\.txt\)[\s\n]+for setup instructions\.\r?\n\r?\n/g,
      ''
    );
    out = out.replace(
      /^[ \t]*[*-][ \t]+\*\*Web\*\*:[ \t]*Set `self\.FIREBASE_APPCHECK_DEBUG_TOKEN = true;` before[\s\n]+initializing App Check\.\r?\n/gm,
      ''
    );
    out = out.replace(
      /^[ \t]*[*-][ \t]+\*\*iOS\*\*:[ \t]*Set provider factory to `AppCheckDebugProviderFactory\(\)`\.\r?\n/gm,
      ''
    );
    // Replace Initialization Code References table or list with Android-only entry
    out = out.replace(
      /\| Language,[\s\S]*?\[flutter_setup\.md\]\(references\/flutter_setup\.md\)\s*\|\r?\n(?::[^\n]*\r?\n)*/g,
      '| Language, Framework, Platform | Gemini API provider | Context URL |\n| :--- | :--- | :--- |\n| Android (Kotlin) | Gemini Developer API | [usage_patterns_android.md](references/usage_patterns_android.md) |\n'
    );
    out = out.replace(
      /-[ \t]+\*\*Web Modular API\*\*[\s\n]+-[ \t]+Provider: Gemini Developer API[\s\n]+-[ \t]+Reference: \[usage_patterns_web\.md\]\(references\/usage_patterns_web\.md\)\r?\n/g,
      ''
    );
    out = out.replace(
      /-[ \t]+\*\*iOS \(Swift\)\*\*[\s\n]+-[ \t]+Provider: Gemini Developer API[\s\n]+-[ \t]+Reference: \[ios_setup\.md\]\(references\/ios_setup\.md\)\r?\n/g,
      ''
    );
    out = out.replace(
      /-[ \t]+\*\*Flutter \(Dart\)\*\*[\s\n]+-[ \t]+Provider: Gemini Developer API[\s\n]+-[ \t]+Reference: \[flutter_setup\.md\]\(references\/flutter_setup\.md\)\r?\n/g,
      ''
    );
    out = out.replace(/\[Web SDK code examples and usage patterns\]\(references\/usage_patterns_web\.md\)\r?\n/g, '');
    out = out.replace(/\[iOS SDK code examples and usage patterns\]\(references\/ios_setup\.md\)\r?\n/g, '');
    out = out.replace(/\[Flutter SDK code examples and usage patterns\]\(references\/flutter_setup\.md\)\r?\n/g, '');
  }

  return stripExcludedLocalLinks(out);
}

async function main() {
  const args = process.argv.slice(2);
  let sourceDir = path.resolve(__dirname, '../skills');
  let targetDir = path.resolve(__dirname, '../android-skills');
  let fullResync = false;
  let localMode = false;
  let changedFilesArg = '';
  let beforeSha = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source-dir') {
      sourceDir = path.resolve(args[++i]);
    } else if (args[i] === '--target-dir') {
      targetDir = path.resolve(args[++i]);
    } else if (args[i] === '--full') {
      fullResync = true;
    } else if (args[i] === '--local') {
      localMode = true;
    } else if (args[i] === '--changed-files') {
      changedFilesArg = args[++i] || '';
    } else if (args[i] === '--before-sha') {
      beforeSha = args[++i] || '';
    }
  }

  const repoRoot = path.resolve(sourceDir, '..');
  const changedFiles = new Set(
    changedFilesArg
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );

  // Lazy-initialize Gemini model only if a Category 3 (SKILL.md body) LLM rewrite is needed
  let geminiModel = null;
  const getGeminiModel = async () => {
    if (geminiModel) return geminiModel;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is required when SKILL.md prose changes require LLM adaptation.'
      );
    }
    const { GoogleGenerativeAI } = requireFromTokenCounter('@google/generative-ai');
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    geminiModel = genAI.getGenerativeModel({ model: modelName });
    return geminiModel;
  };

  fs.mkdirSync(targetDir, { recursive: true });

  // Category 1a: Remove excluded skills or skills deleted from main
  const sourceSkills = new Set(
    fs
      .readdirSync(sourceDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  );

  for (const existing of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (
      existing.isDirectory() &&
      (!sourceSkills.has(existing.name) || EXCLUDED_SKILLS.has(existing.name))
    ) {
      console.log(`[Category 1] Removing excluded/deleted skill: ${existing.name}`);
      fs.rmSync(path.join(targetDir, existing.name), { recursive: true, force: true });
    }
  }

  for (const skill of Array.from(sourceSkills).sort()) {
    if (EXCLUDED_SKILLS.has(skill)) {
      console.log(`[Category 1] Skipping excluded skill: ${skill}`);
      continue;
    }

    const srcSkillDir = path.join(sourceDir, skill);
    const destSkillDir = path.join(targetDir, skill);
    fs.mkdirSync(destSkillDir, { recursive: true });

    const allSrcFiles = listFilesRecursive(srcSkillDir);
    const survivingFiles = [];

    // Category 1b & Category 2: Filter excluded reference files, copy surviving non-SKILL.md files 1:1
    for (const relFile of allSrcFiles) {
      if (shouldExcludeFile(relFile)) {
        const destFile = path.join(destSkillDir, relFile);
        if (fs.existsSync(destFile)) {
          console.log(`[Category 1] Removing excluded file: ${skill}/${relFile}`);
          fs.rmSync(destFile, { force: true });
        }
        continue;
      }

      survivingFiles.push(relFile);
      if (relFile === 'SKILL.md') continue;

      const srcFile = path.join(srcSkillDir, relFile);
      const destFile = path.join(destSkillDir, relFile);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);
    }

    // Prune any stale files in destSkillDir that no longer exist in srcSkillDir
    for (const destRelFile of listFilesRecursive(destSkillDir)) {
      if (destRelFile === 'SKILL.md') continue;
      if (!survivingFiles.includes(destRelFile)) {
        console.log(`[Category 1] Pruning deleted upstream file: ${skill}/${destRelFile}`);
        fs.rmSync(path.join(destSkillDir, destRelFile), { force: true });
      }
    }

    // Category 2 vs Category 3 for SKILL.md
    const srcSkillMdPath = path.join(srcSkillDir, 'SKILL.md');
    const destSkillMdPath = path.join(destSkillDir, 'SKILL.md');
    if (!fs.existsSync(srcSkillMdPath)) continue;

    const mainSkillMd = fs.readFileSync(srcSkillMdPath, 'utf8');
    const existingTargetSkillMd = fs.existsSync(destSkillMdPath)
      ? fs.readFileSync(destSkillMdPath, 'utf8')
      : null;

    const skillMdRepoPath = `skills/${skill}/SKILL.md`;
    const fileInChangedSet =
      fullResync ||
      !existingTargetSkillMd ||
      changedFiles.size === 0 ||
      changedFiles.has(skillMdRepoPath);

    const needsLlmRewrite =
      fullResync ||
      !existingTargetSkillMd ||
      (fileInChangedSet &&
        didProseOrDescriptionChange(repoRoot, beforeSha, skillMdRepoPath, mainSkillMd));

    if (!needsLlmRewrite && existingTargetSkillMd) {
      const synced = syncFrontmatterDeterministically(mainSkillMd, existingTargetSkillMd);
      if (synced !== existingTargetSkillMd) {
        console.log(`[Category 2] Deterministically synced frontmatter for ${skill}/SKILL.md`);
        fs.writeFileSync(destSkillMdPath, synced, 'utf8');
      } else {
        console.log(`[Category 2] Keeping existing ${skill}/SKILL.md (unchanged)`);
      }
      continue;
    }

    if (localMode) {
      console.log(`[Category 3] Adapting ${skill}/SKILL.md locally...`);
      let adaptedSkillMd = adaptSkillMdLocally(skill, mainSkillMd);
      if (existingTargetSkillMd) {
        const adaptedParts = splitFrontmatter(adaptedSkillMd);
        const existingParts = splitFrontmatter(existingTargetSkillMd);
        const adaptedBlocks = parseFrontmatterBlocks(adaptedParts.rawFrontmatter);
        const existingBlocks = parseFrontmatterBlocks(existingParts.rawFrontmatter);
        if (existingBlocks.has('metadata')) {
          adaptedBlocks.set(
            'metadata',
            mergeMetadataBlocks(adaptedBlocks.get('metadata'), existingBlocks.get('metadata'))
          );
          adaptedSkillMd = `---\n${Array.from(adaptedBlocks.values()).join('\n')}\n---\n${adaptedParts.body}`;
        }
      }
      fs.writeFileSync(destSkillMdPath, adaptedSkillMd, 'utf8');
    } else {
      console.log(`[Category 3] Adapting ${skill}/SKILL.md with Gemini...`);
      const model = await getGeminiModel();
      const adaptedSkillMd = await rewriteSkillMdWithLLM({
        skillName: skill,
        mainSkillMd,
        existingTargetSkillMd,
        survivingFiles,
        model,
      });
      fs.writeFileSync(destSkillMdPath, adaptedSkillMd, 'utf8');
    }
  }

  console.log('Sync complete!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
