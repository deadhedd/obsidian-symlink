# Symlink Notes

Portable Markdown shortcuts for Obsidian Desktop and Mobile. Version 0.1.0 requires Obsidian 1.5.7 or newer.

A shortcut is an ordinary note:

```yaml
---
symlink: Problems/Weak Bedroom Wi-Fi.md
---
```

Opening it opens the target in the same tab. The target contains the canonical content; the plugin never copies or synchronizes note contents. All target paths are exact, vault-root-relative Markdown file paths, including `.md`.

## Install

1. Run `npm ci` and `npm run build` (Node.js 18 or newer).
2. Create `<vault>/.obsidian/plugins/symlink-notes/`.
3. Copy `main.js` and `manifest.json` into that folder.
4. Reload Obsidian and enable **Symlink Notes** in Settings → Community plugins.

The generated `main.js` is the desktop/mobile plugin bundle. No stylesheet or runtime npm dependencies are needed. Build on a computer, then copy those two files to a mobile vault to install there.

## Use

Open a Markdown note and run **Symlink Notes: Create symlink to current note** from the command palette. Choose an existing folder, or `/ (vault root)`. The shortcut uses the current note's filename. Creation leaves the current note open and refuses to overwrite an existing file or folder. Paths in generated YAML are quoted to preserve special characters.

Renaming or moving a target, including moving its containing folder, updates the `symlink` property of incoming shortcuts. Other properties and the note body are preserved; Obsidian may reformat YAML during its frontmatter update. Moving a shortcut itself leaves its target unchanged. Targets must be moved while the plugin is enabled for automatic updates to occur.

Chains resolve at navigation time, with loop detection and a maximum of 20 redirects. Missing, invalid, non-Markdown, circular, and excessively deep targets produce a notice and leave the original shortcut open for repair. Empty or non-string properties and malformed YAML behave as ordinary notes. Deleting a target leaves its shortcuts intact.

To repair a broken shortcut, edit its frontmatter and reopen it. Working shortcuts redirect immediately; to edit one manually, temporarily disable the plugin or use an external editor. With the plugin disabled, every shortcut remains readable Markdown.

## Behavior and limits

- Uses public Obsidian workspace, vault, metadata, and YAML APIs. No filesystem symlinks or Node.js APIs run in the plugin.
- Startup builds an in-memory index; file and metadata events maintain it. Navigation reads only the opened note and its chain, without scanning the vault.
- Redirects use the existing Markdown leaf, preserving its editor mode and avoiding focus changes for background tabs. Public navigation events run after opening, so a brief glimpse of the shortcut is possible. Native history can retain a shortcut entry, which will redirect again when opened.
- Frontmatter changes are limited to `symlink`. Backlinks, search, graph, File Explorer, and Quick Switcher use Obsidian's normal behavior.
- Absolute paths, URLs, `.`/`..` paths, attachments, and folder targets are unsupported.

Public API reference: [Obsidian TypeScript definitions](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts).

## Development and verification

```sh
npm ci
npm test
npm run build
```

`npm run dev` watches and rebuilds `main.js`. `npm run typecheck` checks strict TypeScript independently.

Tests use Node's test runner with an in-memory Obsidian API mock and real YAML parsing. They cover resolution, creation, collisions, rename/move events, metadata/body preservation, restart reconstruction, invalid targets, loops, depth limits, background leaves, navigation races, unload, and write failures. They do not replace testing the plugin inside Obsidian.

Manual smoke test in a disposable desktop/mobile vault:

1. Create `Problems/Target.md` with some body text and a `Household` folder. Use the command to create `Household/Target.md`.
2. Open the shortcut from File Explorer, Quick Switcher, and an internal link. Check current, split, and new/background tabs; verify the target opens without unrelated tabs closing.
3. Repeat creation in `Household`; verify the existing shortcut is unchanged. Try the vault root as a destination.
4. Rename the target, move it to another folder, then move its containing folder. Inspect the shortcut frontmatter and verify unrelated properties/body content survive.
5. Move the shortcut, then rename the target again. Verify the shortcut still follows it.
6. Delete the target. Open the shortcut, verify the notice, and edit the broken path. Reopen after repairing it.
7. Create a two-hop chain, a circular pair, and an ordinary note. Verify correct navigation and safe circular-link handling.
8. Restart Obsidian. Verify shortcut navigation and target rename updates still work. Disable the plugin and verify shortcuts remain ordinary readable notes.
