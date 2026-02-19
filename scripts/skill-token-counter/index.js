import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY environment variable is missing.');
  process.exit(1);
}

const modelName = "gemini-3-pro-preview";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelName });

async function countTokens(text) {
  if (!text || text.trim().length === 0) return 0;
  try {
    const response = await model.countTokens(text);
    return response.totalTokens;
  } catch (err) {
    console.error(`Error counting tokens:`, err.message);
    return 0;
  }
}

function parseSkillMd(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const fullMatch = match[0];
    const frontmatter = fullMatch;
    const body = content.slice(fullMatch.length);
    return { frontmatter, body };
  } else {
    return { frontmatter: '', body: content };
  }
}

async function listFilesRecursiveLocal(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(await listFilesRecursiveLocal(filePath));
      } else {
        results.push(filePath);
      }
    }
  } catch (e) {
    // Directory might not exist or be accessible
  }
  return results;
}

class GitHelper {
  constructor() {
    try {
      this.root = execSync('git rev-parse --show-toplevel', { stdio: 'pipe' }).toString().trim();
    } catch {
      this.root = null;
    }
  }

  isGitRepo() {
    return this.root !== null;
  }

  getRepoRelativePath(absolutePath) {
    return path.relative(this.root, absolutePath);
  }

  getFileContent(ref, relativePath) {
    try {
      return execSync(`git show ${ref}:"${relativePath}"`, { stdio: 'pipe', cwd: this.root }).toString('utf8');
    } catch {
      return null;
    }
  }

  listReferenceFiles(ref, dirRelativePath) {
    try {
      // Use bash behavior to catch errors if folder doesn't exist
      const out = execSync(`git ls-tree -r --name-only ${ref} "${dirRelativePath}" 2>/dev/null || true`, { stdio: 'pipe', cwd: this.root }).toString();
      return out.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  listSkills(ref, targetRelativePath) {
    try {
      const out = execSync(`git ls-tree -r --name-only ${ref} "${targetRelativePath}" 2>/dev/null || true`, { stdio: 'pipe', cwd: this.root }).toString();
      const files = out.split('\n').filter(Boolean);
      const skillDirs = new Set();
      for (const file of files) {
        if (file.endsWith('/SKILL.md') || file === 'SKILL.md') {
          skillDirs.add(path.dirname(file));
        }
      }
      return Array.from(skillDirs);
    } catch {
      return [];
    }
  }
}

async function analyzeSkill(skillFolderPath, ref = null, gitHelper = null) {
  let totalTokens = 0;
  let breakdown = [];
  const skillName = path.basename(skillFolderPath);

  const getFile = (p) => {
    if (ref && gitHelper) {
      return gitHelper.getFileContent(ref, gitHelper.getRepoRelativePath(p));
    }
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  };

  const getRefFiles = async (p) => {
    if (ref && gitHelper) {
      const rels = gitHelper.listReferenceFiles(ref, gitHelper.getRepoRelativePath(p));
      return rels.map(r => path.join(gitHelper.root, r));
    }
    return await listFilesRecursiveLocal(p);
  };

  // 1. Process SKILL.md
  const skillMdPath = path.join(skillFolderPath, 'SKILL.md');
  const skillMdContent = getFile(skillMdPath);

  if (skillMdContent) {
    const { frontmatter, body } = parseSkillMd(skillMdContent);

    if (frontmatter) {
      const fmTokens = await countTokens(frontmatter);
      breakdown.push({ Entity: 'SKILL.md (Frontmatter)', Tokens: fmTokens, Type: 'Frontmatter' });
      totalTokens += fmTokens;
    }

    if (body) {
      const bodyTokens = await countTokens(body);
      breakdown.push({ Entity: 'SKILL.md (Body)', Tokens: bodyTokens, Type: 'Body' });
      totalTokens += bodyTokens;
    }
  } else {
    if (!ref) {
      console.warn(`Warning: SKILL.md not found in ${skillFolderPath}`);
    }
  }

  // 2. Process references
  const referencesPath = path.join(skillFolderPath, 'references');
  const referenceFiles = await getRefFiles(referencesPath);
  for (const refFile of referenceFiles) {
    const relativePath = path.relative(skillFolderPath, refFile);
    const fileContent = getFile(refFile);
    if (fileContent) {
      const fileTokens = await countTokens(fileContent);
      breakdown.push({ Entity: relativePath, Tokens: fileTokens, Type: 'Reference' });
      totalTokens += fileTokens;
    }
  }

  return { skillName, totalTokens, breakdown };
}

async function main() {
  const args = process.argv.slice(2);
  let compareRef = null;
  let isJson = false;
  let targetParams = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--compare') {
      compareRef = args[i + 1] || 'main';
      i++;
    } else if (args[i] === '--json') {
      isJson = true;
    } else {
      targetParams.push(args[i]);
    }
  }

  const log = (...logArgs) => { if (!isJson) console.log(...logArgs); };
  const warn = (...logArgs) => { if (!isJson) console.warn(...logArgs); };
  const table = (data) => { if (!isJson) console.table(data); };

  const targetParam = targetParams[0] || '../../skills';
  const resolvedPath = path.resolve(targetParam);

  const gitHelper = new GitHelper();

  if (compareRef && !gitHelper.isGitRepo()) {
    console.error('Error: --compare used but not in a git repository.');
    process.exit(1);
  }

  const localSkillsToProcess = new Set();
  const refSkillsToProcess = new Set();

  // Find local skills
  if (fs.existsSync(resolvedPath)) {
    const isSingleSkill = fs.existsSync(path.join(resolvedPath, 'SKILL.md'));
    if (isSingleSkill) {
      localSkillsToProcess.add(resolvedPath);
    } else {
      const entries = fs.readdirSync(resolvedPath);
      for (const entry of entries) {
        const entryPath = path.join(resolvedPath, entry);
        if (fs.statSync(entryPath).isDirectory() && fs.existsSync(path.join(entryPath, 'SKILL.md'))) {
          localSkillsToProcess.add(entryPath);
        }
      }
    }
  }

  // Find remote skills if comparing
  if (compareRef) {
    const relativeTarget = gitHelper.getRepoRelativePath(resolvedPath);
    const isSingleRef = !!gitHelper.getFileContent(compareRef, path.join(relativeTarget, 'SKILL.md'));
    if (isSingleRef) {
      refSkillsToProcess.add(resolvedPath);
    } else {
      const refSkillDirs = gitHelper.listSkills(compareRef, relativeTarget);
      for (const dir of refSkillDirs) {
        refSkillsToProcess.add(path.join(gitHelper.root, dir));
      }
    }
  }

  const allSkillPaths = new Set([...localSkillsToProcess, ...refSkillsToProcess]);

  if (allSkillPaths.size === 0) {
    if (!isJson) console.error(`No skills found in ${resolvedPath} (local${compareRef ? ` or ${compareRef}` : ''})`);
    process.exit(1);
  }

  log(`Analyzing ${allSkillPaths.size} skill(s)${compareRef ? ` and comparing with [${compareRef}]` : ''}...\n`);

  let grandTotalLocal = 0;
  let grandTotalRef = 0;
  let allSkillsSummary = [];
  let jsonOutput = { skills: {}, summary: [] };

  // Sort paths to have a consistent output
  const sortedPaths = Array.from(allSkillPaths).sort();

  for (const skillPath of sortedPaths) {
    const skillName = path.basename(skillPath);

    // Calculate local
    const localStats = await analyzeSkill(skillPath, null, null);
    grandTotalLocal += localStats.totalTokens;
    jsonOutput.skills[skillName] = { localTotal: localStats.totalTokens, breakdown: [] };

    // Calculate ref if checking
    let refTokens = 0;
    if (compareRef) {
      const refStats = await analyzeSkill(skillPath, compareRef, gitHelper);
      refTokens = refStats.totalTokens;
      grandTotalRef += refTokens;
      jsonOutput.skills[skillName].refTotal = refTokens;

      const combinedBreakdown = {};

      for (const item of localStats.breakdown) {
        combinedBreakdown[item.Entity] = {
          Type: item.Type,
          Local: item.Tokens,
          [compareRef]: 0,
          Delta: `+${item.Tokens}`
        };
      }

      for (const item of refStats.breakdown) {
        if (!combinedBreakdown[item.Entity]) {
          combinedBreakdown[item.Entity] = {
            Type: item.Type,
            Local: 0,
            [compareRef]: item.Tokens,
            Delta: `-${item.Tokens}`
          };
        } else {
          combinedBreakdown[item.Entity][compareRef] = item.Tokens;
          const delta = combinedBreakdown[item.Entity].Local - item.Tokens;
          combinedBreakdown[item.Entity].Delta = delta > 0 ? `+${delta}` : delta.toString();
        }
      }

      const tableData = Object.keys(combinedBreakdown).map(entity => ({
        Entity: entity,
        ...combinedBreakdown[entity]
      }));

      const typeOrder = { 'Frontmatter': 0, 'Body': 1, 'Reference': 2 };
      tableData.sort((a, b) => {
        if (typeOrder[a.Type] !== typeOrder[b.Type]) {
          return typeOrder[a.Type] - typeOrder[b.Type];
        }
        return a.Entity.localeCompare(b.Entity);
      });

      jsonOutput.skills[skillName].breakdown = tableData;

      log(`\n--- Token Breakdown for ${skillName} ---`);
      table(tableData);

    } else {
      jsonOutput.skills[skillName].breakdown = localStats.breakdown;

      log(`\n--- Local Token Breakdown for ${skillName} ---`);
      table(localStats.breakdown);
    }

    if (compareRef) {
      const delta = localStats.totalTokens - refTokens;
      const deltaStr = delta > 0 ? `+${delta}` : delta.toString();
      allSkillsSummary.push({
        Skill: skillName,
        Local: localStats.totalTokens,
        [compareRef]: refTokens,
        Delta: deltaStr
      });
    } else {
      allSkillsSummary.push({
        Skill: skillName,
        Tokens: localStats.totalTokens
      });
    }
  }

  jsonOutput.summary = allSkillsSummary;
  jsonOutput.grandTotalLocal = grandTotalLocal;

  log('\n=========================================');
  log('--- Overall Skills Token Summary ---');
  table(allSkillsSummary);

  if (compareRef) {
    const grandDelta = grandTotalLocal - grandTotalRef;
    const grandDeltaStr = grandDelta > 0 ? `+${grandDelta}` : grandDelta.toString();
    jsonOutput.grandTotalRef = grandTotalRef;
    jsonOutput.grandDelta = grandDeltaStr;

    log(`\nGrand Total (Local): ${grandTotalLocal}`);
    log(`Grand Total ([${compareRef}]): ${grandTotalRef}`);
    log(`Grand Delta: ${grandDeltaStr}`);
  } else {
    log(`\nGrand Total Tokens: ${grandTotalLocal}`);
  }
  log('=========================================');

  if (isJson) {
    console.log(JSON.stringify(jsonOutput, null, 2));
  }
}

main().catch(console.error);
