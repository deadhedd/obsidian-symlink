# Symlink Notes

Portable Markdown shortcuts for Obsidian Desktop and Mobile. Version 0.1.1 requires Obsidian 1.5.7 or newer.

A shortcut is an ordinary note:

```yaml
---
symlink: Problems/Weak Bedroom Wi-Fi.md
---
```

Opening it opens the target in the same tab. The target contains the canonical content; the plugin never copies or synchronizes note contents. All target paths are exact, vault-root-relative Markdown file paths, including `.md`.

## Install

1. Run `npm ci` and `npm run release:check` with Node.js 22 or Node.js 24. These are the supported Node.js lines for repository development, builds, and verification only. Node.js is not part of the Obsidian plugin runtime contract.
2. Create `<vault>/.obsidian/plugins/symlink-notes/`.
3. Copy `release/main.js` and `release/manifest.json` into that folder.
4. Reload Obsidian and enable **Symlink Notes** in **Settings** → **Community plugins**.

The release command runs the canonical repository check before creating `release/`. It creates exactly `main.js` and `manifest.json`, then reports the version, output directory, and lowercase SHA 256 hashes for both files. No stylesheet or runtime npm dependencies are needed. Build on a computer, then copy those two files to a mobile vault to install there.

## Use

Open a Markdown note and run **Symlink Notes: Create symlink to active note** from the command palette. Choose an existing folder, or `/ (vault root)`. The shortcut uses the active note's filename. Creation leaves the active note open and refuses to overwrite an existing file or folder. Paths in generated YAML are quoted to preserve special characters.

Renaming or moving a target, including moving its containing folder, updates the `symlink` property of incoming shortcuts. Other properties and the note body are preserved; Obsidian may reformat YAML during its frontmatter update. Moving a shortcut itself leaves its target unchanged. Targets must be moved while the plugin is enabled for automatic updates to occur.

Chains resolve at navigation time, with loop detection and a maximum of 20 redirects. Missing, invalid, non-Markdown, circular, and excessively deep targets produce a notice and leave the original shortcut open for repair. Empty or non-string properties and malformed YAML behave as ordinary notes. Deleting a target leaves its shortcuts intact.

To repair a broken shortcut, edit its frontmatter and reopen it. Working shortcuts redirect immediately; to edit one manually, temporarily disable the plugin or use an external editor. With the plugin disabled, every shortcut remains readable Markdown.

## Behavior and limits

- Uses public Obsidian workspace, vault, metadata, and YAML APIs. No filesystem symlinks or Node.js APIs run in the plugin.
- Startup builds an in-memory index; file and metadata events maintain it. Navigation reads only the opened note and its chain, without scanning the vault.
- Redirects use the existing Markdown leaf, preserving its editor mode and avoiding focus changes for background tabs. Public navigation events run after opening, so a brief glimpse of the shortcut is possible. Native history can retain a shortcut entry, which will redirect again when opened.
- Frontmatter changes are limited to `symlink`. Backlinks, search, graph, File explorer, and Quick switcher use Obsidian's normal behavior.
- Absolute paths, URLs, `.`/`..` paths, attachments, and folder targets are unsupported.

Public API reference: [Obsidian TypeScript definitions](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts).

## License

Symlink Notes is licensed under the [MIT License](LICENSE).

## Development and verification

```sh
npm ci
npm run check
```

`npm run check` is the canonical repository verification command. It runs strict TypeScript checking, the test suite, and the production build in that order. `npm run dev` watches and rebuilds `main.js`. `npm run typecheck` checks strict TypeScript independently.

For a repository owned release artifact, run `npm ci` followed by `npm run release:check`. The command uses the successful production build and validated metadata, and refuses to remove unexpected files already in `release/`. The `release/` directory is ignored by Git.

## Release verification evidence

After `npm run release:check` succeeds, use the exact `release/main.js` and `release/manifest.json` it produced. Copy those files unchanged into a clean Desktop vault and a clean Mobile vault, then complete the smoke path in `docs/release-verification/template.md`. Copy the template to `docs/release-verification/<version>.md`, fill in the command output and test results, and check in the record even when a platform is `Fail` or `Blocked`. Stop if either recorded SHA 256 hash does not match the files under test.

Tests use Node's test runner with an in-memory Obsidian API mock and real YAML parsing. They cover resolution, creation, collisions, rename/move events, metadata/body preservation, restart reconstruction, invalid targets, loops, depth limits, background leaves, navigation races, unload, and write failures. They do not replace testing the plugin inside Obsidian.

Manual smoke test in a disposable desktop/mobile vault:

1. Create `Problems/Target.md` with some body text and a `Household` folder. Use the command to create `Household/Target.md`.
2. Open the shortcut from File explorer, Quick switcher, and an internal link. Check current, split, and new/background tabs; verify the target opens without unrelated tabs closing.
3. Repeat creation in `Household`; verify the existing shortcut is unchanged. Try the vault root as a destination.
4. Rename the target, move it to another folder, then move its containing folder. Inspect the shortcut frontmatter and verify unrelated properties/body content survive.
5. Move the shortcut, then rename the target again. Verify the shortcut still follows it.
6. Delete the target. Open the shortcut, verify the notice, and edit the broken path. Reopen after repairing it.
7. Create a two-hop chain, a circular pair, and an ordinary note. Verify correct navigation and safe circular-link handling.
8. Restart Obsidian. Verify shortcut navigation and target rename updates still work. Disable the plugin and verify shortcuts remain ordinary readable notes.
