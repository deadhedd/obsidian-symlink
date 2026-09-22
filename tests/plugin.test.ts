import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { App, PluginManifest, TFile, TFolder } from 'obsidian';
import { fixture, notices, parseYaml, getFrontMatterInfo } from './obsidian.mock.mjs';
import type { Fixture, MockAbstractFile, MockApp, MockFolderModal } from './obsidian.mock.mjs';
import { parse as parseDocument } from 'yaml';
import { SymlinkManager, MAX_REDIRECTS } from '../src/SymlinkManager';
import SymlinkNotesPlugin from '../src/main';
import { FolderSuggestModal } from '../src/FolderSuggestModal';
import { runReleaseCheck } from '../scripts/release-check.mjs';

const shortcut = (path: string) => `---\nsymlink: ${JSON.stringify(path)}\n---\n`;
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const asApp = (app: MockApp): App => app as unknown as App;
const asFile = (file: MockAbstractFile | undefined): TFile => {
  assert.ok(file);
  return file as unknown as TFile;
};
const asFolder = (folder: MockAbstractFile): TFolder => folder as unknown as TFolder;
type TestPlugin = SymlinkNotesPlugin & { commands: Array<{ checkCallback(checking: boolean): boolean }> };
const createPlugin = (fixtureValue: Fixture): TestPlugin =>
  new SymlinkNotesPlugin(asApp(fixtureValue.app), {} as PluginManifest) as unknown as TestPlugin;
const repositoryFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const packageMetadata = JSON.parse(repositoryFile('package.json')) as {
  engines: { node: string };
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};
const lockMetadata = JSON.parse(repositoryFile('package-lock.json')) as {
  packages: Record<string, { engines?: { node?: string }; devDependencies?: Record<string, string>; version?: string }>;
};

test('AC-1 declares Node 22 and Node 24 as the supported development lines', () => {
  assert.equal(packageMetadata.engines.node, '^22.0.0 || ^24.0.0');
});

test('AC-2 documents the Node policy and canonical check without making it a plugin runtime requirement', () => {
  const readme = repositoryFile('README.md');
  const agents = repositoryFile('AGENTS.md');
  for (const document of [readme, agents]) {
    assert.match(document, /Node\.js 22/);
    assert.match(document, /Node\.js 24/);
    assert.match(document, /npm run check/);
    assert.match(document, /Node\.js is not part of the Obsidian plugin runtime contract/);
  }
});

test('AC-3 includes all source and test TypeScript files in strict checking', () => {
  const config = JSON.parse(repositoryFile('tsconfig.json')) as {
    compilerOptions: { strict: boolean };
    include: string[];
  };
  assert.equal(config.compilerOptions.strict, true);
  assert.deepEqual(config.include, ['src/**/*.ts', 'tests/**/*.ts']);
});

test('AC-4 uses a narrow declaration while keeping the JavaScript mock runtime boundary explicit', async () => {
  const declaration = repositoryFile('tests/obsidian.mock.d.mts');
  assert.match(declaration, /export interface MockApp/);
  assert.match(declaration, /export function fixture/);
  assert.doesNotMatch(declaration, /\bany\b/);

  const f = fixture();
  const target = f.add('Target.md', 'canonical');
  let changed = false;
  f.app.vault.on('changed', () => { changed = true; });
  f.app.vault.trigger('changed', target);
  f.app.modal = { getItems: () => [], onChooseItem: () => {} };
  assert.equal(f.app.vault.getAbstractFileByPath(target.path), target);
  assert.equal(await f.app.vault.cachedRead(target), 'canonical');
  assert.equal(changed, true);
  assert.ok(f.app.modal);
});

test('AC-5 and AC-6 use the Node 22 type baseline consistently in package metadata and the lockfile', () => {
  const root = lockMetadata.packages[''];
  const nodeTypes = lockMetadata.packages['node_modules/@types/node'];
  assert.ok(root);
  assert.ok(nodeTypes);
  assert.equal(packageMetadata.devDependencies['@types/node'], '^22.0.0');
  assert.equal(root.devDependencies?.['@types/node'], packageMetadata.devDependencies['@types/node']);
  assert.equal(root.engines?.node, packageMetadata.engines.node);
  assert.match(nodeTypes.version ?? '', /^22\./);
});

test('AC-7 keeps the canonical check sequence and an independently safe build', () => {
  assert.equal(packageMetadata.scripts.typecheck, 'tsc --noEmit');
  assert.equal(packageMetadata.scripts.test, 'node tests/run.mjs');
  assert.equal(packageMetadata.scripts.build, 'npm run typecheck && node esbuild.config.mjs');
  assert.equal(packageMetadata.scripts.check, 'npm run typecheck && npm test && npm run build');
});

const releaseFixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'symlink-notes-release-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'symlink-notes', version: '0.1.1' }));
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({ id: 'symlink-notes', version: '0.1.1', minAppVersion: '1.5.7' }));
  writeFileSync(join(root, 'versions.json'), JSON.stringify({ '0.1.1': '1.5.7' }));
  writeFileSync(join(root, 'main.js'), 'built plugin');
  return root;
};

test('AC-1 registers the repository owned release command and ignores its output', () => {
  assert.equal(packageMetadata.scripts['release:check'], 'node scripts/release-check.mjs');
  assert.match(repositoryFile('.gitignore'), /^release\/$/m);
});

test('AC-1 rejects unexpected command arguments before starting the release check', () => {
  const result = spawnSync(process.execPath, ['scripts/release-check.mjs', 'unexpected'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release:check does not accept arguments/);
});

test('AC-3, AC-4, AC-5, AC-6, and AC-8 build the exact artifact and report its hashes', () => {
  const root = releaseFixture();
  try {
    const versionsBefore = readFileSync(join(root, 'versions.json'), 'utf8');
    let checked = false;
    const logs: string[] = [];
    const report = runReleaseCheck({ root, runCheck: () => { checked = true; }, log: text => logs.push(text) });
    assert.equal(checked, true);
    assert.deepEqual(readdirSync(join(root, 'release')), ['main.js', 'manifest.json']);
    assert.equal(readFileSync(join(root, 'release', 'main.js'), 'utf8'), 'built plugin');
    assert.equal(readFileSync(join(root, 'release', 'manifest.json'), 'utf8'), readFileSync(join(root, 'manifest.json'), 'utf8'));
    const expectedHash = createHash('sha256').update('built plugin').digest('hex');
    assert.equal(report.hashes['main.js'], expectedHash);
    assert.equal(report.hashes['manifest.json'], createHash('sha256').update(readFileSync(join(root, 'manifest.json'))).digest('hex'));
    assert.equal(readFileSync(join(root, 'versions.json'), 'utf8'), versionsBefore);
    assert.match(logs[0] ?? '', /Release version: 0\.1\.1/);
    assert.match(logs[0] ?? '', /Output directory: release\//);
    assert.match(logs[0] ?? '', new RegExp(`main\.js: ${expectedHash}`));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-5 rejects a current compatibility history mismatch before copying release files', () => {
  const root = releaseFixture();
  try {
    writeFileSync(join(root, 'versions.json'), JSON.stringify({ '0.1.1': '1.5.6' }));
    assert.throws(() => runReleaseCheck({ root, runCheck: () => {}, log: () => {} }), /versions\.json entry for 0\.1\.1/);
    assert.equal(existsSync(join(root, 'release')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-4 rejects a package and manifest version mismatch before copying release files', () => {
  const root = releaseFixture();
  try {
    writeFileSync(join(root, 'manifest.json'), JSON.stringify({ id: 'symlink-notes', version: '0.1.0', minAppVersion: '1.5.7' }));
    assert.throws(() => runReleaseCheck({ root, runCheck: () => {}, log: () => {} }), /package\.json version 0\.1\.1 does not match manifest\.json version 0\.1\.0/);
    assert.equal(existsSync(join(root, 'release')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-4 and AC-5 reject mismatched metadata before copying release files', () => {
  const root = releaseFixture();
  try {
    writeFileSync(join(root, 'manifest.json'), JSON.stringify({ id: 'wrong-id', version: '0.1.1', minAppVersion: '1.5.7' }));
    let checked = false;
    assert.throws(() => runReleaseCheck({ root, runCheck: () => { checked = true; }, log: () => {} }), /does not match manifest\.json id/);
    assert.equal(checked, true);
    assert.equal(existsSync(join(root, 'release')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-7 refuses an unexpected release path without deleting it', () => {
  const root = releaseFixture();
  const unexpected = join(root, 'release', 'keep.txt');
  try {
    mkdirSync(join(root, 'release'));
    writeFileSync(unexpected, 'keep me');
    let checked = false;
    assert.throws(() => runReleaseCheck({ root, runCheck: () => { checked = true; }, log: () => {} }), /Unexpected path in release output: keep\.txt/);
    assert.equal(checked, false);
    assert.equal(readFileSync(unexpected, 'utf8'), 'keep me');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-6 and AC-7 reject a release path that is not a directory', () => {
  const root = releaseFixture();
  try {
    writeFileSync(join(root, 'release'), 'not a directory');
    assert.throws(() => runReleaseCheck({ root, runCheck: () => {}, log: () => {} }), /Release output path is not a directory/);
    assert.equal(readFileSync(join(root, 'release'), 'utf8'), 'not a directory');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-6 and AC-7 reject an allowed artifact path that is not a regular file', () => {
  const root = releaseFixture();
  try {
    mkdirSync(join(root, 'release'));
    mkdirSync(join(root, 'release', 'main.js'));
    assert.throws(() => runReleaseCheck({ root, runCheck: () => {}, log: () => {} }), /Release artifact path is not a regular file: main\.js/);
    assert.equal(existsSync(join(root, 'release', 'main.js')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-3 leaves an existing artifact unchanged when the canonical check fails', () => {
  const root = releaseFixture();
  try {
    mkdirSync(join(root, 'release'));
    writeFileSync(join(root, 'release', 'main.js'), 'old artifact');
    writeFileSync(join(root, 'release', 'manifest.json'), 'old metadata');
    assert.throws(() => runReleaseCheck({ root, runCheck: () => { throw new Error('check failed'); }, log: () => {} }), /check failed/);
    assert.equal(readFileSync(join(root, 'release', 'main.js'), 'utf8'), 'old artifact');
    assert.equal(readFileSync(join(root, 'release', 'manifest.json'), 'utf8'), 'old metadata');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-3 and AC-6 reject missing production output without creating release files', () => {
  const root = releaseFixture();
  try {
    rmSync(join(root, 'main.js'));
    assert.throws(() => runReleaseCheck({ root, runCheck: () => {}, log: () => {} }), /Production output is missing/);
    assert.equal(existsSync(join(root, 'release')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-3 and AC-6 reject non regular production output without creating release files', () => {
  const root = releaseFixture();
  try {
    rmSync(join(root, 'main.js'));
    mkdirSync(join(root, 'main.js'));
    assert.throws(() => runReleaseCheck({ root, runCheck: () => {}, log: () => {} }), /Production output is missing/);
    assert.equal(existsSync(join(root, 'release')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('AC-8, AC-9, and AC-10 define an enforcing read only Node matrix in CI', () => {
  const workflowSource = repositoryFile('.github/workflows/ci.yml');
  const workflow = parseDocument(workflowSource) as {
    on: { pull_request: { branches: string[] }; push: { branches: string[] } };
    permissions: { contents: string };
    jobs: {
      check: {
        strategy: {
          'fail-fast': boolean;
          matrix: { 'node-version': string[] };
        };
        steps: Array<{ run?: string; uses?: string }>;
      };
    };
  };
  assert.deepEqual(workflow.on.pull_request.branches, ['main']);
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.jobs.check.strategy['fail-fast'], false);
  assert.deepEqual(workflow.jobs.check.strategy.matrix['node-version'], ['22.x', '24.x']);
  const actionSteps = workflow.jobs.check.steps.filter(step => step.uses);
  assert.deepEqual(actionSteps.map(step => step.uses), ['actions/checkout@v7', 'actions/setup-node@v7']);
  assert.deepEqual(workflow.jobs.check.steps.filter(step => step.run).map(step => step.run), ['npm ci', 'npm run check']);
  assert.doesNotMatch(workflowSource, /continue-on-error|concurrency:|secrets:/);
});

test('basic and folder targets, chains, and ordinary notes resolve without rewriting content', async () => {
  const f = fixture();
  const target = f.add('Problems/Target.md', '# Canonical content');
  const b = f.add('B.md', shortcut(target.path));
  const a = f.add('A.md', shortcut(b.path));
  const manager = new SymlinkManager(asApp(f.app));
  assert.equal(await manager.resolveTarget(asFile(a)), target);
  assert.equal(await manager.resolveTarget(asFile(b)), target);
  assert.equal(await manager.resolveTarget(asFile(target)), target);
  assert.equal(f.contents.get(a), shortcut('B.md'));
  assert.deepEqual(f.writes, []);
});

test('missing and deleted targets leave shortcut content intact', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut(target.path));
  f.remove(target);
  const manager = new SymlinkManager(asApp(f.app));
  assert.equal(await manager.resolveTarget(asFile(link)), null);
  assert.match(notices.at(-1)!, /target not found:\nTarget.md/);
  assert.equal(f.contents.get(link), shortcut('Target.md'));
});

test('rejects attachments, folders, absolute paths, URLs and relative traversal', async () => {
  const f = fixture();
  f.add('Image.png');
  f.folder('Folder');
  const manager = new SymlinkManager(asApp(f.app));
  for (const path of ['Image.png', 'Folder', '/Target.md', '../Target.md', './Target.md', 'A/../Target.md', 'https://example.com/A.md', 'C:\\A.md']) {
    const link = f.add('Shortcut.md', shortcut(path));
    assert.equal(await manager.resolveTarget(asFile(link)), null, path);
    assert.match(notices.at(-1)!, /not a Markdown|Invalid symlink/);
  }
});

test('empty, non-string, wrong-case and malformed frontmatter behave as ordinary notes', async () => {
  const f = fixture();
  const manager = new SymlinkManager(asApp(f.app));
  for (const yaml of ['symlink:', 'symlink: "  "', 'symlink: 42', 'symlink: [Target.md]', 'Symlink: Target.md', 'target: Target.md', 'symlink: [unclosed']) {
    const file = f.add('Note.md', `---\n${yaml}\n---\nBody`);
    assert.equal(await manager.resolveTarget(asFile(file)), file, yaml);
  }
  assert.equal(notices.length, 0);
});

test('detects self-links and circular chains', async () => {
  const f = fixture();
  const a = f.add('A.md', shortcut('B.md'));
  const b = f.add('B.md', shortcut('A.md'));
  const self = f.add('Self.md', shortcut('Self.md'));
  const manager = new SymlinkManager(asApp(f.app));
  for (const file of [a, b, self]) {
    assert.equal(await manager.resolveTarget(asFile(file)), null);
    assert.match(notices.at(-1)!, /Circular symlink/);
  }
});

test('allows exactly 20 redirects and rejects longer chains', async () => {
  const f = fixture();
  const target = f.add(`${MAX_REDIRECTS}.md`);
  for (let i = MAX_REDIRECTS - 1; i >= 0; i--) f.add(`${i}.md`, shortcut(`${i + 1}.md`));
  const manager = new SymlinkManager(asApp(f.app));
  assert.equal(await manager.resolveTarget(asFile(f.files.get('0.md'))), target);
  const extra = f.add('Extra.md', shortcut('0.md'));
  assert.equal(await manager.resolveTarget(asFile(extra)), null);
  assert.match(notices.at(-1)!, /exceeds 20/);
});

test('creates a safely quoted shortcut in a folder and in the root without copying the target', async () => {
  const f = fixture();
  const target = f.add('Problems/Target: # "quoted".md', '# Never copy this');
  const destination = f.folder('Household');
  const manager = new SymlinkManager(asApp(f.app));
  await manager.createSymlink(asFile(target), asFolder(destination));
  await manager.createSymlink(asFile(target), asFolder(f.app.vault.getRoot()));
  for (const path of [`Household/${target.name}`, target.name]) {
    const file = f.files.get(path);
    assert.ok(file);
    assert.equal(await manager.getTargetPath(asFile(file)), target.path);
    const content = f.contents.get(file);
    assert.ok(content);
    assert.doesNotMatch(content, /Never copy this/);
  }
});

test('creation refuses collisions, including the target itself and concurrent creates', async () => {
  const f = fixture();
  const target = f.add('Target.md', 'original');
  const folder = f.folder('Household');
  const collision = f.add('Household/Target.md', 'precious');
  const manager = new SymlinkManager(asApp(f.app));
  await manager.createSymlink(asFile(target), asFolder(folder));
  await manager.createSymlink(asFile(target), asFolder(f.app.vault.getRoot()));
  assert.equal(f.contents.get(collision), 'precious');
  assert.equal(f.contents.get(target), 'original');
  const destination = f.folder('Other');
  await Promise.allSettled([manager.createSymlink(asFile(target), asFolder(destination)), manager.createSymlink(asFile(target), asFolder(destination))]);
  assert.equal([...f.files.keys()].filter(path => path === 'Other/Target.md').length, 1);
});

test('rename and move update only the symlink property, preserving body and other metadata', async () => {
  const f = fixture();
  const target = f.add('Problems/Target.md', '# Original');
  const link = f.add('Shortcut.md', '---\nsymlink: Problems/Target.md\ntags: [one, two]\ncreated: "2026-09-16"\n---\nBody mentions Problems/Target.md\n');
  const ordinary = f.add('Ordinary.md', 'Problems/Target.md');
  const manager = new SymlinkManager(asApp(f.app));
  await manager.rebuildIndex();
  for (const path of ['Problems/Renamed.md', 'Archive/Target.md']) {
    const old = f.rename(target, path);
    await manager.handleRename(old, path, false);
    assert.equal(await manager.getTargetPath(asFile(link)), path);
  }
  const result = f.contents.get(link);
  assert.ok(result);
  const parsed = parseYaml(getFrontMatterInfo(result).frontmatter);
  assert.deepEqual(parsed.tags, ['one', 'two']);
  assert.equal(parsed.created, '2026-09-16');
  assert.ok(result.endsWith('Body mentions Problems/Target.md\n'));
  assert.equal(f.contents.get(target), '# Original');
  assert.equal(f.contents.get(ordinary), 'Problems/Target.md');
});

test('moving a shortcut leaves its target unchanged and later target renames find it', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const link = f.add('Household/Target.md', shortcut(target.path));
  const manager = new SymlinkManager(asApp(f.app));
  await manager.rebuildIndex();
  const oldLink = f.rename(link, 'Household/Network/Target.md');
  await manager.handleRename(oldLink, link.path, false);
  assert.equal(f.contents.get(link), shortcut('Target.md'));
  const oldTarget = f.rename(target, 'Renamed.md');
  await manager.handleRename(oldTarget, target.path, false);
  assert.equal(await manager.getTargetPath(asFile(link)), 'Renamed.md');
});

test('folder moves update descendants and relocated shortcuts without prefix collisions', async () => {
  const f = fixture();
  const folder = f.folder('Projects');
  const target = f.add('Projects/Target.md');
  const inside = f.add('Projects/Shortcut.md', shortcut(target.path));
  const outside = f.add('Shortcut.md', shortcut(target.path));
  const unrelated = f.add('Other.md', shortcut('Projects-old/Target.md'));
  const manager = new SymlinkManager(asApp(f.app));
  await manager.rebuildIndex();
  f.rename(folder, 'Archive');
  await manager.handleRename('Projects', 'Archive', true);
  assert.equal(await manager.getTargetPath(asFile(inside)), 'Archive/Target.md');
  assert.equal(await manager.getTargetPath(asFile(outside)), 'Archive/Target.md');
  assert.equal(await manager.getTargetPath(asFile(unrelated)), 'Projects-old/Target.md');
});

test('rename does not overwrite a symlink target edited since indexing', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut(target.path));
  const manager = new SymlinkManager(asApp(f.app));
  await manager.rebuildIndex();
  f.edit(link, shortcut('Different.md'));
  f.rename(target, 'Renamed.md');
  await manager.handleRename('Target.md', 'Renamed.md', false);
  assert.equal(await manager.getTargetPath(asFile(link)), 'Different.md');
  assert.deepEqual(f.writes, []);
});

test('a fresh manager recovers shortcuts from Markdown, including uncached files', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut(target.path));
  f.app.metadataCache.getFileCache = () => null;
  const manager = new SymlinkManager(asApp(f.app));
  await manager.rebuildIndex();
  assert.equal(await manager.resolveTarget(asFile(link)), target);
  f.rename(target, 'Renamed.md');
  await manager.handleRename('Target.md', 'Renamed.md', false);
  assert.equal(await manager.getTargetPath(asFile(link)), 'Renamed.md');
});

test('plugin redirects within existing foreground/background leaves and preserves editor mode', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut(target.path));
  const foreground = f.leaf(f.add('Unrelated.md'));
  const background = f.leaf(link, false);
  const plugin = createPlugin(f);
  plugin.onload();
  f.app.workspace.ready();
  await settle();
  assert.equal(background.view.file, target);
  assert.equal(f.app.workspace.activeLeaf, foreground);
  assert.equal(f.leaves.length, 2);
  const opened = background.opened[0];
  assert.ok(opened);
  assert.deepEqual(opened.options, { active: false, state: { mode: 'source' } });
  assert.equal(foreground.opened.length, 0);
  plugin.onunload();
});

test('async resolution does not hijack subsequent navigation or a closed leaf', async () => {
  for (const close of [false, true]) {
    const f = fixture();
    f.add('Target.md');
    const link = f.add('Shortcut.md', shortcut('Target.md'));
    const other = f.add('Other.md');
    const leaf = f.leaf(link);
    const plugin = createPlugin(f);
    plugin.onload();
    f.app.workspace.trigger('file-open', link);
    if (close) f.leaves.splice(0, 1);
    else leaf.view.file = other;
    await settle();
    assert.equal(leaf.opened.length, 0);
    plugin.onunload();
  }
});

test('broken shortcuts stay editable without repeated notices on layout changes', async () => {
  const f = fixture();
  const link = f.add('Shortcut.md', shortcut('Missing.md'));
  const leaf = f.leaf(link);
  const plugin = createPlugin(f);
  plugin.onload();
  f.app.workspace.ready();
  await settle();
  for (let i = 0; i < 5; i++) f.app.workspace.trigger('layout-change');
  await settle();
  assert.equal(notices.length, 1);
  assert.equal(leaf.view.file, link);
  assert.equal(leaf.opened.length, 0);
  plugin.onunload();
});

test('command offers existing folders and root and creates without navigation', async () => {
  const f = fixture();
  const target = f.add('Problems/Target.md');
  const folder = f.folder('Household');
  const leaf = f.leaf(target);
  const plugin = createPlugin(f);
  plugin.onload();
  const command = plugin.commands[0];
  assert.ok(command);
  assert.equal(command.checkCallback(true), true);
  command.checkCallback(false);
  const modal = f.app.modal;
  assert.ok(modal);
  assert.ok(modal instanceof FolderSuggestModal);
  const testModal = modal as unknown as MockFolderModal;
  assert.deepEqual(testModal.getItems(), [f.app.vault.getRoot(), folder]);
  testModal.onChooseItem(folder);
  await settle();
  assert.ok(f.files.has('Household/Target.md'));
  assert.equal(leaf.view.file, target);
  assert.equal(leaf.opened.length, 0);
  f.app.workspace.activeLeaf = null;
  assert.equal(command.checkCallback(true), false);
  plugin.onunload();
});

test('lifecycle events maintain the index for created, edited, deleted and rapidly renamed files', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const plugin = createPlugin(f);
  plugin.onload();
  f.app.workspace.ready();
  await settle();
  const created = f.add('Created.md', shortcut('Target.md'));
  const edited = f.add('Edited.md', 'ordinary');
  f.edit(edited, shortcut('Target.md'));
  const deleted = f.add('Deleted.md', shortcut('Target.md'));
  await settle();
  f.remove(deleted);
  f.rename(target, 'First.md');
  f.rename(target, 'Second.md');
  await settle();
  const createdContent = f.contents.get(created);
  const editedContent = f.contents.get(edited);
  assert.ok(createdContent);
  assert.ok(editedContent);
  assert.match(createdContent, /Second.md/);
  assert.match(editedContent, /Second.md/);
  assert.equal(f.writes.includes('Deleted.md'), false);
  plugin.onunload();
});

test('unloading during resolution prevents delayed navigation', async () => {
  const f = fixture();
  f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut('Target.md'));
  const leaf = f.leaf(link);
  const plugin = createPlugin(f);
  plugin.onload();
  f.app.workspace.trigger('file-open', link);
  plugin.onunload();
  await settle();
  assert.equal(leaf.opened.length, 0);
});


test('rapid folder moves preserve targets even when shortcuts move with the folder', async () => {
  const f = fixture();
  const folder = f.folder('Projects');
  f.add('Projects/Target.md');
  const link = f.add('Projects/Shortcut.md', shortcut('Projects/Target.md'));
  const outside = f.add('Outside.md', shortcut('Projects/Target.md'));
  const plugin = createPlugin(f);
  plugin.onload();
  f.app.workspace.ready();
  await settle();
  f.rename(folder, 'First');
  f.rename(folder, 'Final');
  await settle();
  assert.equal(link.path, 'Final/Shortcut.md');
  const linkContent = f.contents.get(link);
  const outsideContent = f.contents.get(outside);
  assert.ok(linkContent);
  assert.ok(outsideContent);
  assert.match(linkContent, /symlink: Final\/Target.md/);
  assert.match(outsideContent, /symlink: Final\/Target.md/);
  plugin.onunload();
});

test('navigation uses current content despite stale metadata and never scans the vault', async () => {
  const f = fixture();
  const target = f.add('New.md');
  const link = f.add('Shortcut.md', shortcut('New.md'));
  f.app.metadataCache.getFileCache = () => ({ frontmatter: { symlink: 'Old.md' } });
  f.app.vault.getMarkdownFiles = () => { throw new Error('Unexpected vault scan'); };
  const manager = new SymlinkManager(asApp(f.app));
  assert.equal(await manager.resolveTarget(asFile(link)), target);
});

test('a failed rename write reports the error and still updates other shortcuts', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const failed = f.add('Failed.md', shortcut('Target.md'));
  const good = f.add('Good.md', shortcut('Target.md'));
  const manager = new SymlinkManager(asApp(f.app));
  await manager.rebuildIndex();
  const process = f.app.fileManager.processFrontMatter;
  f.app.fileManager.processFrontMatter = async (file, update) => {
    if (file === failed) throw new Error('Write denied');
    return process(file, update);
  };
  f.rename(target, 'Renamed.md');
  const originalError = console.error;
  console.error = () => {};
  try { await manager.handleRename('Target.md', 'Renamed.md', false); }
  finally { console.error = originalError; }
  assert.equal(await manager.getTargetPath(asFile(failed)), 'Target.md');
  assert.equal(await manager.getTargetPath(asFile(good)), 'Renamed.md');
  assert.match(notices.at(-1)!, /Could not update symlink Failed.md.*Write denied/);
});
