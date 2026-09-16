import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('child_process', () => ({ execSync: vi.fn() }));
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({ countTokens: vi.fn() }))
  }))
}));

const { parseSkillMd, listFilesRecursiveLocal, GitHelper, analyzeSkill, countTokens, initModel } =
  await import('./index.js');

// ─── parseSkillMd ────────────────────────────────────────────────────────────

describe('parseSkillMd', () => {
  it('extracts frontmatter and body when both are present', () => {
    const content = '---\nname: test-skill\n---\nBody content here';
    const { frontmatter, body } = parseSkillMd(content);
    expect(frontmatter).toContain('name: test-skill');
    expect(body).toBe('Body content here');
  });

  it('returns empty frontmatter and full content when no frontmatter delimiter', () => {
    const content = 'Just plain body content';
    const { frontmatter, body } = parseSkillMd(content);
    expect(frontmatter).toBe('');
    expect(body).toBe('Just plain body content');
  });

  it('returns empty frontmatter and empty body for empty string', () => {
    const { frontmatter, body } = parseSkillMd('');
    expect(frontmatter).toBe('');
    expect(body).toBe('');
  });

  it('handles multiline frontmatter values', () => {
    const content = '---\nname: test\ndescription: >\n  a long description\n---\nBody';
    const { frontmatter, body } = parseSkillMd(content);
    expect(frontmatter).toContain('description');
    expect(body).toBe('Body');
  });

  it('body is empty string when nothing follows closing delimiter', () => {
    const content = '---\nname: test\n---\n';
    const { frontmatter, body } = parseSkillMd(content);
    expect(frontmatter).toBeTruthy();
    expect(body).toBe('');
  });

  it('does not confuse inner --- as frontmatter delimiter', () => {
    const content = '---\nname: test\n---\nBody with --- inside';
    const { body } = parseSkillMd(content);
    expect(body).toBe('Body with --- inside');
  });
});

// ─── listFilesRecursiveLocal ──────────────────────────────────────────────────

describe('listFilesRecursiveLocal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists all files in a flat directory', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.md'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'b.md'), 'content');
    const files = await listFilesRecursiveLocal(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some(f => f.endsWith('a.md'))).toBe(true);
    expect(files.some(f => f.endsWith('b.md'))).toBe(true);
  });

  it('recursively discovers files in nested subdirectories', async () => {
    const subDir = path.join(tmpDir, 'sub');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(tmpDir, 'root.md'), 'content');
    fs.writeFileSync(path.join(subDir, 'nested.md'), 'content');
    const files = await listFilesRecursiveLocal(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some(f => f.endsWith('nested.md'))).toBe(true);
  });

  it('returns empty array for a non-existent directory', async () => {
    const files = await listFilesRecursiveLocal('/does/not/exist');
    expect(files).toEqual([]);
  });

  it('returns empty array for an empty directory', async () => {
    const files = await listFilesRecursiveLocal(tmpDir);
    expect(files).toEqual([]);
  });

  it('returns full absolute paths', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.md'), 'content');
    const files = await listFilesRecursiveLocal(tmpDir);
    expect(path.isAbsolute(files[0])).toBe(true);
  });
});

// ─── GitHelper ───────────────────────────────────────────────────────────────

describe('GitHelper', () => {
  let execSync;

  beforeEach(async () => {
    const childProcess = await import('child_process');
    execSync = childProcess.execSync;
    vi.clearAllMocks();
  });

  it('detects a git repository and stores root path', () => {
    execSync.mockReturnValue(Buffer.from('/path/to/repo\n'));
    const helper = new GitHelper();
    expect(helper.isGitRepo()).toBe(true);
    expect(helper.root).toBe('/path/to/repo');
  });

  it('sets root to null when not inside a git repository', () => {
    execSync.mockImplementation(() => { throw new Error('not a git repo'); });
    const helper = new GitHelper();
    expect(helper.isGitRepo()).toBe(false);
    expect(helper.root).toBeNull();
  });

  it('getRepoRelativePath returns path relative to repo root', () => {
    execSync.mockReturnValue(Buffer.from('/repo\n'));
    const helper = new GitHelper();
    expect(helper.getRepoRelativePath('/repo/skills/my-skill')).toBe('skills/my-skill');
  });

  it('getFileContent returns file content from a git ref', () => {
    execSync
      .mockReturnValueOnce(Buffer.from('/repo\n'))
      .mockReturnValueOnce(Buffer.from('file content'));
    const helper = new GitHelper();
    expect(helper.getFileContent('main', 'skills/test/SKILL.md')).toBe('file content');
  });

  it('getFileContent returns null when file does not exist in ref', () => {
    execSync
      .mockReturnValueOnce(Buffer.from('/repo\n'))
      .mockImplementationOnce(() => { throw new Error('path not found'); });
    const helper = new GitHelper();
    expect(helper.getFileContent('main', 'skills/missing/SKILL.md')).toBeNull();
  });

  it('listReferenceFiles returns filtered non-empty paths', () => {
    execSync
      .mockReturnValueOnce(Buffer.from('/repo\n'))
      .mockReturnValueOnce(Buffer.from('skills/test/references/a.md\nskills/test/references/b.md\n'));
    const helper = new GitHelper();
    const files = helper.listReferenceFiles('main', 'skills/test/references');
    expect(files).toEqual([
      'skills/test/references/a.md',
      'skills/test/references/b.md'
    ]);
  });

  it('listReferenceFiles returns empty array on error', () => {
    execSync
      .mockReturnValueOnce(Buffer.from('/repo\n'))
      .mockImplementationOnce(() => { throw new Error('git error'); });
    const helper = new GitHelper();
    expect(helper.listReferenceFiles('main', 'skills/test/references')).toEqual([]);
  });

  it('listSkills extracts unique skill directories from SKILL.md paths', () => {
    execSync
      .mockReturnValueOnce(Buffer.from('/repo\n'))
      .mockReturnValueOnce(
        Buffer.from(
          'skills/skill-a/SKILL.md\nskills/skill-b/SKILL.md\nskills/skill-b/references/ref.md\n'
        )
      );
    const helper = new GitHelper();
    const skills = helper.listSkills('main', 'skills');
    expect(skills).toHaveLength(2);
    expect(skills).toContain('skills/skill-a');
    expect(skills).toContain('skills/skill-b');
  });

  it('listSkills returns empty array when no SKILL.md files found', () => {
    execSync
      .mockReturnValueOnce(Buffer.from('/repo\n'))
      .mockReturnValueOnce(Buffer.from('skills/skill-a/references/guide.md\n'));
    const helper = new GitHelper();
    expect(helper.listSkills('main', 'skills')).toEqual([]);
  });
});

// ─── countTokens ─────────────────────────────────────────────────────────────

describe('countTokens', () => {
  let mockCountTokens;

  beforeEach(async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    mockCountTokens = vi.fn();
    GoogleGenerativeAI.mockReturnValue({
      getGenerativeModel: vi.fn(() => ({ countTokens: mockCountTokens }))
    });
    initModel('fake-api-key');
  });

  it('returns totalTokens from the model response', async () => {
    mockCountTokens.mockResolvedValue({ totalTokens: 42 });
    expect(await countTokens('some text')).toBe(42);
  });

  it('returns 0 for empty string without calling the model', async () => {
    expect(await countTokens('')).toBe(0);
    expect(mockCountTokens).not.toHaveBeenCalled();
  });

  it('returns 0 for whitespace-only string without calling the model', async () => {
    expect(await countTokens('   \n\t  ')).toBe(0);
    expect(mockCountTokens).not.toHaveBeenCalled();
  });

  it('returns 0 and logs error when model throws', async () => {
    mockCountTokens.mockRejectedValue(new Error('API error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await countTokens('text')).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error counting tokens'), 'API error');
    consoleSpy.mockRestore();
  });

  it('returns 0 and logs error when called before initModel', async () => {
    // Reset the module-level model by calling initModel with a value that produces null model,
    // then overwrite _model via a fresh import cycle — simplest: spy on the module state
    // by calling initModel with a mock that produces no model, then reset
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    GoogleGenerativeAI.mockReturnValue({ getGenerativeModel: vi.fn(() => null) });
    initModel('fake-key'); // _model = null (mock returns null from getGenerativeModel)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await countTokens('some text')).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not been initialized'));
    consoleSpy.mockRestore();
  });
});

// ─── analyzeSkill ─────────────────────────────────────────────────────────────

describe('analyzeSkill', () => {
  let tmpDir;
  let mockCountFn;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-analyze-'));
    mockCountFn = vi.fn().mockResolvedValue(10);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns skill name from directory basename', async () => {
    fs.writeFileSync(path.join(tmpDir, 'SKILL.md'), '---\nname: t\n---\nBody');
    const result = await analyzeSkill(tmpDir, null, null, mockCountFn);
    expect(result.skillName).toBe(path.basename(tmpDir));
  });

  it('splits SKILL.md into frontmatter and body entries', async () => {
    fs.writeFileSync(path.join(tmpDir, 'SKILL.md'), '---\nname: test\n---\nBody text');
    mockCountFn.mockResolvedValueOnce(5).mockResolvedValueOnce(15);
    const result = await analyzeSkill(tmpDir, null, null, mockCountFn);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0]).toMatchObject({ Type: 'Frontmatter', Tokens: 5 });
    expect(result.breakdown[1]).toMatchObject({ Type: 'Body', Tokens: 15 });
    expect(result.totalTokens).toBe(20);
  });

  it('includes reference files in the breakdown', async () => {
    fs.writeFileSync(path.join(tmpDir, 'SKILL.md'), '---\nname: t\n---\nBody');
    const refDir = path.join(tmpDir, 'references');
    fs.mkdirSync(refDir);
    fs.writeFileSync(path.join(refDir, 'guide.md'), 'Guide content');
    mockCountFn.mockResolvedValue(10);
    const result = await analyzeSkill(tmpDir, null, null, mockCountFn);
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown.some(b => b.Type === 'Reference')).toBe(true);
  });

  it('returns zero tokens and empty breakdown when SKILL.md is absent', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await analyzeSkill(tmpDir, null, null, mockCountFn);
    expect(result.totalTokens).toBe(0);
    expect(result.breakdown).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('skips body entry when body is empty string', async () => {
    fs.writeFileSync(path.join(tmpDir, 'SKILL.md'), '---\nname: t\n---\n');
    mockCountFn.mockResolvedValue(5);
    const result = await analyzeSkill(tmpDir, null, null, mockCountFn);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].Type).toBe('Frontmatter');
  });

  it('accumulates tokens from all sources into totalTokens', async () => {
    fs.writeFileSync(path.join(tmpDir, 'SKILL.md'), '---\nname: t\n---\nBody');
    const refDir = path.join(tmpDir, 'references');
    fs.mkdirSync(refDir);
    fs.writeFileSync(path.join(refDir, 'ref.md'), 'Reference content');
    // frontmatter=3, body=7, reference=11
    mockCountFn
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(11);
    const result = await analyzeSkill(tmpDir, null, null, mockCountFn);
    expect(result.totalTokens).toBe(21);
  });

  it('uses gitHelper to read files when ref is provided', async () => {
    const mockGitHelper = {
      root: '/repo',
      getRepoRelativePath: vi.fn(p => path.relative('/repo', p)),
      getFileContent: vi.fn((ref, p) => {
        if (p.endsWith('SKILL.md')) return '---\nname: t\n---\nBody';
        return null;
      }),
      listReferenceFiles: vi.fn(() => [])
    };
    mockCountFn.mockResolvedValue(5);
    const result = await analyzeSkill(tmpDir, 'main', mockGitHelper, mockCountFn);
    expect(mockGitHelper.getFileContent).toHaveBeenCalled();
    expect(result.totalTokens).toBe(10);
  });
});
