import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, notices, parseYaml, getFrontMatterInfo } from './obsidian.mock.mjs';
import { SymlinkManager, MAX_REDIRECTS } from '../src/SymlinkManager';
import SymlinkNotesPlugin from '../src/main';
import { FolderSuggestModal } from '../src/FolderSuggestModal';

const shortcut = (path: string) => `---\nsymlink: ${JSON.stringify(path)}\n---\n`;
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

test('basic and folder targets, chains, and ordinary notes resolve without rewriting content', async () => {
  const f = fixture();
  const target = f.add('Problems/Target.md', '# Canonical content');
  const b = f.add('B.md', shortcut(target.path));
  const a = f.add('A.md', shortcut(b.path));
  const manager = new SymlinkManager(f.app);
  assert.equal(await manager.resolveTarget(a), target);
  assert.equal(await manager.resolveTarget(b), target);
  assert.equal(await manager.resolveTarget(target), target);
  assert.equal(f.contents.get(a), shortcut('B.md'));
  assert.deepEqual(f.writes, []);
});

test('missing and deleted targets leave shortcut content intact', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut(target.path));
  f.remove(target);
  const manager = new SymlinkManager(f.app);
  assert.equal(await manager.resolveTarget(link), null);
  assert.match(notices.at(-1), /target not found:\nTarget.md/);
  assert.equal(f.contents.get(link), shortcut('Target.md'));
});

test('rejects attachments, folders, absolute paths, URLs and relative traversal', async () => {
  const f = fixture();
  f.add('Image.png');
  f.folder('Folder');
  const manager = new SymlinkManager(f.app);
  for (const path of ['Image.png', 'Folder', '/Target.md', '../Target.md', './Target.md', 'A/../Target.md', 'https://example.com/A.md', 'C:\\A.md']) {
    const link = f.add('Shortcut.md', shortcut(path));
    assert.equal(await manager.resolveTarget(link), null, path);
    assert.match(notices.at(-1), /not a Markdown|Invalid symlink/);
  }
});

test('empty, non-string, wrong-case and malformed frontmatter behave as ordinary notes', async () => {
  const f = fixture();
  const manager = new SymlinkManager(f.app);
  for (const yaml of ['symlink:', 'symlink: "  "', 'symlink: 42', 'symlink: [Target.md]', 'Symlink: Target.md', 'target: Target.md', 'symlink: [unclosed']) {
    const file = f.add('Note.md', `---\n${yaml}\n---\nBody`);
    assert.equal(await manager.resolveTarget(file), file, yaml);
  }
  assert.equal(notices.length, 0);
});

test('detects self-links and circular chains', async () => {
  const f = fixture();
  const a = f.add('A.md', shortcut('B.md'));
  const b = f.add('B.md', shortcut('A.md'));
  const self = f.add('Self.md', shortcut('Self.md'));
  const manager = new SymlinkManager(f.app);
  for (const file of [a, b, self]) {
    assert.equal(await manager.resolveTarget(file), null);
    assert.match(notices.at(-1), /Circular symlink/);
  }
});

test('allows exactly 20 redirects and rejects longer chains', async () => {
  const f = fixture();
  const target = f.add(`${MAX_REDIRECTS}.md`);
  for (let i = MAX_REDIRECTS - 1; i >= 0; i--) f.add(`${i}.md`, shortcut(`${i + 1}.md`));
  const manager = new SymlinkManager(f.app);
  assert.equal(await manager.resolveTarget(f.files.get('0.md')), target);
  const extra = f.add('Extra.md', shortcut('0.md'));
  assert.equal(await manager.resolveTarget(extra), null);
  assert.match(notices.at(-1), /exceeds 20/);
});

test('creates a safely quoted shortcut in a folder and in the root without copying the target', async () => {
  const f = fixture();
  const target = f.add('Problems/Target: # "quoted".md', '# Never copy this');
  const destination = f.folder('Household');
  const manager = new SymlinkManager(f.app);
  await manager.createSymlink(target, destination);
  await manager.createSymlink(target, f.app.vault.getRoot());
  for (const path of [`Household/${target.name}`, target.name]) {
    const file = f.files.get(path);
    assert.equal(await manager.getTargetPath(file), target.path);
    assert.doesNotMatch(f.contents.get(file), /Never copy this/);
  }
});

test('creation refuses collisions, including the target itself and concurrent creates', async () => {
  const f = fixture();
  const target = f.add('Target.md', 'original');
  const folder = f.folder('Household');
  const collision = f.add('Household/Target.md', 'precious');
  const manager = new SymlinkManager(f.app);
  await manager.createSymlink(target, folder);
  await manager.createSymlink(target, f.app.vault.getRoot());
  assert.equal(f.contents.get(collision), 'precious');
  assert.equal(f.contents.get(target), 'original');
  const destination = f.folder('Other');
  await Promise.allSettled([manager.createSymlink(target, destination), manager.createSymlink(target, destination)]);
  assert.equal([...f.files.keys()].filter(path => path === 'Other/Target.md').length, 1);
});

test('rename and move update only the symlink property, preserving body and other metadata', async () => {
  const f = fixture();
  const target = f.add('Problems/Target.md', '# Original');
  const link = f.add('Shortcut.md', '---\nsymlink: Problems/Target.md\ntags: [one, two]\ncreated: "2026-09-16"\n---\nBody mentions Problems/Target.md\n');
  const ordinary = f.add('Ordinary.md', 'Problems/Target.md');
  const manager = new SymlinkManager(f.app);
  await manager.rebuildIndex();
  for (const path of ['Problems/Renamed.md', 'Archive/Target.md']) {
    const old = f.rename(target, path);
    await manager.handleRename(old, path, false);
    assert.equal(await manager.getTargetPath(link), path);
  }
  const result = f.contents.get(link);
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
  const manager = new SymlinkManager(f.app);
  await manager.rebuildIndex();
  const oldLink = f.rename(link, 'Household/Network/Target.md');
  await manager.handleRename(oldLink, link.path, false);
  assert.equal(f.contents.get(link), shortcut('Target.md'));
  const oldTarget = f.rename(target, 'Renamed.md');
  await manager.handleRename(oldTarget, target.path, false);
  assert.equal(await manager.getTargetPath(link), 'Renamed.md');
});

test('folder moves update descendants and relocated shortcuts without prefix collisions', async () => {
  const f = fixture();
  const folder = f.folder('Projects');
  const target = f.add('Projects/Target.md');
  const inside = f.add('Projects/Shortcut.md', shortcut(target.path));
  const outside = f.add('Shortcut.md', shortcut(target.path));
  const unrelated = f.add('Other.md', shortcut('Projects-old/Target.md'));
  const manager = new SymlinkManager(f.app);
  await manager.rebuildIndex();
  f.rename(folder, 'Archive');
  await manager.handleRename('Projects', 'Archive', true);
  assert.equal(await manager.getTargetPath(inside), 'Archive/Target.md');
  assert.equal(await manager.getTargetPath(outside), 'Archive/Target.md');
  assert.equal(await manager.getTargetPath(unrelated), 'Projects-old/Target.md');
});

test('rename does not overwrite a symlink target edited since indexing', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut(target.path));
  const manager = new SymlinkManager(f.app);
  await manager.rebuildIndex();
  f.edit(link, shortcut('Different.md'));
  f.rename(target, 'Renamed.md');
  await manager.handleRename('Target.md', 'Renamed.md', false);
  assert.equal(await manager.getTargetPath(link), 'Different.md');
  assert.deepEqual(f.writes, []);
});

test('a fresh manager recovers shortcuts from Markdown, including uncached files', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut(target.path));
  f.app.metadataCache.getFileCache = () => null;
  const manager = new SymlinkManager(f.app);
  await manager.rebuildIndex();
  assert.equal(await manager.resolveTarget(link), target);
  f.rename(target, 'Renamed.md');
  await manager.handleRename('Target.md', 'Renamed.md', false);
  assert.equal(await manager.getTargetPath(link), 'Renamed.md');
});

test('plugin redirects within existing foreground/background leaves and preserves editor mode', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut(target.path));
  const foreground = f.leaf(f.add('Unrelated.md'));
  const background = f.leaf(link, false);
  const plugin = new SymlinkNotesPlugin(f.app);
  plugin.onload();
  f.app.workspace.ready();
  await settle();
  assert.equal(background.view.file, target);
  assert.equal(f.app.workspace.activeLeaf, foreground);
  assert.equal(f.leaves.length, 2);
  assert.deepEqual(background.opened[0].options, { active: false, state: { mode: 'source' } });
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
    const plugin = new SymlinkNotesPlugin(f.app);
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
  const plugin = new SymlinkNotesPlugin(f.app);
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
  const plugin = new SymlinkNotesPlugin(f.app);
  plugin.onload();
  assert.equal(plugin.commands[0].checkCallback(true), true);
  plugin.commands[0].checkCallback(false);
  assert.ok(f.app.modal instanceof FolderSuggestModal);
  assert.deepEqual(f.app.modal.getItems(), [f.app.vault.getRoot(), folder]);
  f.app.modal.onChooseItem(folder);
  await settle();
  assert.ok(f.files.has('Household/Target.md'));
  assert.equal(leaf.view.file, target);
  assert.equal(leaf.opened.length, 0);
  f.app.workspace.activeLeaf = null;
  assert.equal(plugin.commands[0].checkCallback(true), false);
  plugin.onunload();
});

test('lifecycle events maintain the index for created, edited, deleted and rapidly renamed files', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const plugin = new SymlinkNotesPlugin(f.app);
  plugin.onload();
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
  assert.match(f.contents.get(created), /Second.md/);
  assert.match(f.contents.get(edited), /Second.md/);
  assert.equal(f.writes.includes('Deleted.md'), false);
  plugin.onunload();
});

test('unloading during resolution prevents delayed navigation', async () => {
  const f = fixture();
  f.add('Target.md');
  const link = f.add('Shortcut.md', shortcut('Target.md'));
  const leaf = f.leaf(link);
  const plugin = new SymlinkNotesPlugin(f.app);
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
  const plugin = new SymlinkNotesPlugin(f.app);
  plugin.onload();
  await settle();
  f.rename(folder, 'First');
  f.rename(folder, 'Final');
  await settle();
  assert.equal(link.path, 'Final/Shortcut.md');
  assert.match(f.contents.get(link), /symlink: Final\/Target.md/);
  assert.match(f.contents.get(outside), /symlink: Final\/Target.md/);
  plugin.onunload();
});

test('navigation uses current content despite stale metadata and never scans the vault', async () => {
  const f = fixture();
  const target = f.add('New.md');
  const link = f.add('Shortcut.md', shortcut('New.md'));
  f.app.metadataCache.getFileCache = () => ({ frontmatter: { symlink: 'Old.md' } });
  f.app.vault.getMarkdownFiles = () => { throw new Error('Unexpected vault scan'); };
  const manager = new SymlinkManager(f.app);
  assert.equal(await manager.resolveTarget(link), target);
});

test('a failed rename write reports the error and still updates other shortcuts', async () => {
  const f = fixture();
  const target = f.add('Target.md');
  const failed = f.add('Failed.md', shortcut('Target.md'));
  const good = f.add('Good.md', shortcut('Target.md'));
  const manager = new SymlinkManager(f.app);
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
  assert.equal(await manager.getTargetPath(failed), 'Target.md');
  assert.equal(await manager.getTargetPath(good), 'Renamed.md');
  assert.match(notices.at(-1), /Could not update symlink Failed.md.*Write denied/);
});
