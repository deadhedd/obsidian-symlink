# Symlink Notes — Development Specification

## 1. Purpose

Build a small Obsidian community plugin that provides **symlink-like behavior for notes** without using operating-system symlinks and without replacing Obsidian's built-in File Explorer.

The plugin represents a symlink as an ordinary Markdown file containing frontmatter that points to another Markdown file in the same vault.

When a user opens the symlink note, the plugin should transparently open the target note instead.

The design should remain deliberately small and rely on Obsidian's existing filesystem, File Explorer, editor, and navigation behavior wherever possible.

---

# 2. Core Concept

Assume this real note exists:

```text
Problems/Weak Bedroom Wi-Fi.md
```

The user wants the same note to appear under:

```text
Household/
```

The plugin creates:

```text
Household/Weak Bedroom Wi-Fi.md
```

containing:

```yaml
---
symlink: Problems/Weak Bedroom Wi-Fi.md
---
```

The second file is not a copy of the original note.

It is a redirect.

Opening:

```text
Household/Weak Bedroom Wi-Fi.md
```

should open:

```text
Problems/Weak Bedroom Wi-Fi.md
```

instead.

There must never be synchronization of note contents between the two files.

The target note remains the single canonical source of content.

---

# 3. Design Principles

The implementation must follow these principles.

### 3.1 Use normal Markdown files

Symlinks are represented as actual `.md` files in the vault.

Do not create operating-system symlinks.

Do not create virtual filesystem objects.

Do not replace Obsidian's File Explorer.

---

### 3.2 Minimize plugin behavior

The plugin should do as little as possible.

Prefer native Obsidian behavior over custom UI or custom abstractions.

The core plugin responsibilities are:

1. Recognize symlink notes.
2. Redirect navigation to their target.
3. Create symlink notes.
4. Keep symlink target paths valid when targets are renamed or moved.

Anything beyond those responsibilities should be treated as optional future work.

---

### 3.3 Canonical notes remain ordinary Obsidian notes

Target notes must require no special metadata.

For example:

```text
Problems/Weak Bedroom Wi-Fi.md
```

does not need:

```yaml
symlink-target: true
```

or any other plugin-specific property.

Only the shortcut note needs plugin metadata.

---

### 3.4 Human-readable storage

The symlink representation must remain understandable without the plugin.

A user should be able to inspect:

```yaml
---
symlink: Problems/Weak Bedroom Wi-Fi.md
---
```

and immediately understand what it does.

Do not store essential link information only in `data.json`.

---

# 4. Terminology

## Target

The canonical Markdown note containing the actual content.

Example:

```text
Problems/Weak Bedroom Wi-Fi.md
```

## Symlink Note

A small Markdown file containing a `symlink` frontmatter property.

Example:

```text
Household/Weak Bedroom Wi-Fi.md
```

## Target Path

The vault-relative path stored in the `symlink` property.

Example:

```yaml
symlink: Problems/Weak Bedroom Wi-Fi.md
```

All paths are relative to the vault root.

---

# 5. Symlink File Format

The minimum valid symlink file is:

```yaml
---
symlink: Problems/Weak Bedroom Wi-Fi.md
---
```

Additional frontmatter MAY exist.

Example:

```yaml
---
symlink: Problems/Weak Bedroom Wi-Fi.md
created: 2026-09-16
---
```

The plugin should ignore unrelated properties.

The plugin should consider a Markdown file a symlink if its parsed frontmatter contains a non-empty string property named:

```text
symlink
```

Property name matching should initially be exact.

Do not implement aliases such as:

```text
target
redirect
link
shortcut
```

for version 0.1.

---

# 6. Functional Requirements

## FR-1 — Detect Symlink Notes

The plugin must detect whether an opened Markdown file contains:

```yaml
symlink: <path>
```

Use Obsidian's metadata APIs where practical.

Avoid manually parsing YAML unless necessary.

---

## FR-2 — Redirect When Opened

When a symlink note is opened, the plugin must resolve its target path and open the target Markdown file.

Example:

User opens:

```text
Household/Weak Bedroom Wi-Fi.md
```

Frontmatter:

```yaml
symlink: Problems/Weak Bedroom Wi-Fi.md
```

Plugin opens:

```text
Problems/Weak Bedroom Wi-Fi.md
```

The user should normally never see the contents of the symlink file in the editor.

---

## FR-3 — Preserve Navigation Context

Opening a symlink should behave as closely as practical to opening the target directly.

If the symlink was opened in the current pane, open the target in that pane.

If Obsidian requests that the file open in another leaf or tab, preserve that behavior where reasonably possible.

Do not create unnecessary tabs.

Do not close unrelated tabs.

---

## FR-4 — Missing Target Handling

If the target does not exist, do not silently fail.

Display a user-visible notice such as:

```text
Symlink target not found:
Problems/Weak Bedroom Wi-Fi.md
```

The symlink note should then remain accessible so the user can repair it manually.

Avoid creating redirect loops that make the broken shortcut impossible to edit.

---

## FR-5 — Create Symlink Command

Provide a command:

```text
Create symlink to current note
```

The command should operate on the currently active Markdown file.

The user selects where the shortcut should be created.

The created file should contain:

```yaml
---
symlink: <target-path>
---
```

The default shortcut filename should match the target note filename.

Example:

Target:

```text
Problems/Weak Bedroom Wi-Fi.md
```

Destination folder:

```text
Household/
```

Created file:

```text
Household/Weak Bedroom Wi-Fi.md
```

---

## FR-6 — Prevent Accidental Overwrite

If the destination already contains:

```text
Weak Bedroom Wi-Fi.md
```

the plugin must not overwrite it.

Show a notice and abort.

Do not automatically append:

```text
-1
-copy
-shortcut
```

in version 0.1.

---

## FR-7 — Update Links When Target Moves

If a target note is renamed or moved, update all symlink notes pointing to that target.

Example:

Before:

```text
Problems/Weak Bedroom Wi-Fi.md
```

Symlink:

```yaml
symlink: Problems/Weak Bedroom Wi-Fi.md
```

Target moved to:

```text
Problems/Networking/Weak Bedroom Wi-Fi.md
```

The plugin updates the shortcut to:

```yaml
symlink: Problems/Networking/Weak Bedroom Wi-Fi.md
```

---

## FR-8 — Do Not Modify Symlink Paths When the Symlink File Moves

Moving the shortcut itself must not change its target.

Example:

```text
Household/Weak Bedroom Wi-Fi.md
```

moves to:

```text
Household/Networking/Weak Bedroom Wi-Fi.md
```

The file should still contain:

```yaml
symlink: Problems/Weak Bedroom Wi-Fi.md
```

because stored paths are vault-relative rather than relative to the symlink file.

---

## FR-9 — Target Deletion

If a target note is deleted, do not automatically delete symlinks pointing to it.

The symlinks become broken links.

Opening one should produce the missing-target behavior described in FR-4.

This allows the user to recover or manually redirect the shortcut.

---

# 7. Redirect Chains

A symlink may theoretically point to another symlink.

Example:

```text
A.md -> B.md
B.md -> C.md
```

The plugin should follow the chain until it reaches a normal Markdown file.

Result:

```text
A.md -> C.md
```

Do not automatically rewrite `A.md`.

Simply resolve the chain at navigation time.

---

# 8. Circular Symlinks

The plugin must detect loops.

Examples:

```text
A.md -> B.md
B.md -> A.md
```

or:

```text
A.md -> B.md
B.md -> C.md
C.md -> A.md
```

The plugin must stop resolving when a previously visited path is encountered.

Display a notice such as:

```text
Circular symlink detected.
```

Do not allow an infinite navigation loop.

A reasonable hard maximum resolution depth should also exist as a secondary safeguard.

Suggested maximum:

```text
20 redirects
```

---

# 9. Creating Symlinks

## Preferred User Flow

User opens:

```text
Problems/Weak Bedroom Wi-Fi.md
```

Runs:

```text
Create symlink to current note
```

Plugin displays a folder picker.

User chooses:

```text
Household
```

Plugin creates:

```text
Household/Weak Bedroom Wi-Fi.md
```

with:

```yaml
---
symlink: Problems/Weak Bedroom Wi-Fi.md
---
```

Then display a notice:

```text
Symlink created in Household
```

Do not automatically navigate away from the current note.

---

# 10. Folder Picker

For version 0.1, a simple Obsidian modal is sufficient.

It should allow the user to choose an existing vault folder.

Creating new folders from the modal is not required.

The vault root should be a valid destination.

Do not build a custom file explorer.

---

# 11. Updating Targets After Rename

The plugin must monitor vault rename events.

On rename:

```text
oldPath -> newPath
```

search known Markdown files for symlinks whose target equals:

```text
oldPath
```

and update them to:

```text
newPath
```

### Important

Do not perform a raw search-and-replace across Markdown files.

Only update the `symlink` frontmatter property.

Use Obsidian frontmatter-processing APIs where practical.

---

# 12. Performance

The plugin should be suitable for large vaults.

Do not rescan the entire vault every time a note is opened.

A full vault scan at plugin initialization is acceptable for version 0.1 if necessary.

Prefer maintaining an in-memory index:

```ts
Map<string, Set<string>>
```

Conceptually:

```text
target path
    ->
set of symlink note paths
```

Example:

```text
Problems/Weak Bedroom Wi-Fi.md
    ->
Household/Weak Bedroom Wi-Fi.md
Tech/Weak Bedroom Wi-Fi.md
```

Update the index when:

- Markdown files are created
- Markdown files are modified
- Markdown files are deleted
- Markdown files are renamed

Correctness is more important than premature optimization.

---

# 13. Suggested Internal Types

These are suggestions rather than strict API requirements.

```ts
interface SymlinkInfo {
    linkFile: TFile;
    targetPath: string;
}
```

Possible manager:

```ts
class SymlinkManager {
    isSymlink(file: TFile): boolean;

    getTargetPath(file: TFile): string | null;

    resolveTarget(file: TFile): Promise<TFile | null>;

    createSymlink(target: TFile, destination: TFolder): Promise<void>;

    rebuildIndex(): Promise<void>;

    handleRename(file: TAbstractFile, oldPath: string): Promise<void>;
}
```

Keep plugin startup and UI code separate from symlink logic where practical.

---

# 14. Suggested Project Structure

Do not create unnecessary architecture.

A reasonable starting layout:

```text
src/
├── main.ts
├── SymlinkManager.ts
└── FolderSuggestModal.ts
```

If Obsidian's normal plugin template places `main.ts` at the repository root, follow the template instead.

Avoid creating layers such as:

```text
repositories/
services/
controllers/
domain/
infrastructure/
```

unless the implementation actually becomes complicated enough to justify them.

This is a small plugin.

Keep it small.

---

# 15. Commands

Version 0.1 requires one primary command:

```text
Create symlink to current note
```

Optional convenience commands MAY include:

```text
Open symlink target
Edit symlink file
```

but these should not delay the MVP.

---

# 16. Editing Symlink Files

Because opening a symlink normally redirects immediately, users still need a way to repair a broken or incorrect link.

For version 0.1, one of the following approaches is sufficient:

### Option A

Broken symlinks do not redirect and therefore can be edited normally.

### Option B

Provide a command:

```text
Edit symlink file
```

which opens the shortcut without redirection.

If implementing this requires substantial complexity, use Option A for version 0.1.

---

# 17. Non-Goals

The following are explicitly outside the scope of version 0.1.

Do not implement them unless requested later.

### No operating-system symlinks

Do not call:

```text
ln -s
mklink
junction
```

or equivalent APIs.

---

### No custom File Explorer

Do not recreate Obsidian's sidebar tree.

---

### No virtual filesystem

Do not create fake `TFile` objects.

---

### No content synchronization

Never copy the contents of the target into the symlink file.

---

### No bidirectional synchronization

There is nothing to synchronize.

The shortcut only points to the target.

---

### No automatic backlink manipulation

Do not attempt to make backlinks treat shortcut files as the target.

---

### No graph manipulation

Do not patch or replace Obsidian's graph behavior.

---

### No search interception

Symlink files may appear in search results.

That is acceptable for version 0.1.

---

### No Quick Switcher interception

Symlink files may appear separately in the Quick Switcher.

That is acceptable for version 0.1.

---

### No Bases or Dataview integration

Do not add special support.

---

### No filesystem aliases for folders

Version 0.1 supports shortcut **notes**, not shortcut folders.

---

### No external targets

Targets must exist inside the same Obsidian vault.

Do not support:

```text
C:\Documents\foo.md
/home/user/foo.md
https://example.com/
```

---

# 18. Failure Cases

The plugin must fail safely.

## Target missing

Show notice.

Do not redirect.

---

## Target is not Markdown

Treat as unsupported for version 0.1.

Show notice.

---

## Invalid frontmatter

Do not crash.

Treat file as a normal note where possible.

---

## Empty target

Example:

```yaml
symlink:
```

Treat as invalid.

Do not redirect.

---

## Destination already exists

Abort shortcut creation.

Do not overwrite.

---

## Circular redirect

Abort resolution and show notice.

---

## Excessive redirect chain

Abort after the maximum resolution depth.

---

# 19. Mobile Compatibility

The plugin should avoid Node.js-only APIs.

Do not rely on:

```text
fs
path
child_process
```

or operating-system filesystem semantics.

Use Obsidian APIs for:

- reading files
- creating files
- modifying frontmatter
- finding files
- opening notes

The plugin should therefore be capable of running on Obsidian Desktop and Mobile.

---

# 20. Data Portability

The plugin's essential state must live inside Markdown files.

A symlink must remain understandable after:

- cloning the vault through Git
- opening the vault on Windows
- opening the vault on Linux
- opening the vault on macOS
- opening the vault on iOS
- uninstalling the plugin

The shortcut may stop redirecting when the plugin is absent, but the target path must remain visible as plain text YAML.

---

# 21. Acceptance Tests

The MVP is complete when all of the following pass.

## Test 1 — Basic redirect

Given:

```text
Target.md
Shortcut.md
```

and:

```yaml
---
symlink: Target.md
---
```

Opening `Shortcut.md` opens `Target.md`.

---

## Test 2 — Folder target

Given:

```text
Problems/Target.md
```

and:

```yaml
---
symlink: Problems/Target.md
---
```

the shortcut resolves correctly.

---

## Test 3 — Create shortcut

With:

```text
Problems/Target.md
```

open, running:

```text
Create symlink to current note
```

and choosing:

```text
Household/
```

creates:

```text
Household/Target.md
```

containing:

```yaml
---
symlink: Problems/Target.md
---
```

---

## Test 4 — Collision

If:

```text
Household/Target.md
```

already exists, attempting to create the shortcut does not modify that file.

---

## Test 5 — Rename target

Given:

```text
Target.md
```

and:

```yaml
symlink: Target.md
```

rename the target to:

```text
Renamed.md
```

The shortcut is updated to:

```yaml
symlink: Renamed.md
```

---

## Test 6 — Move target

Move:

```text
Problems/Target.md
```

to:

```text
Archive/Target.md
```

Existing symlinks update their target path.

---

## Test 7 — Move shortcut

Move:

```text
Household/Target.md
```

to:

```text
Household/Network/Target.md
```

Its `symlink` property remains unchanged.

---

## Test 8 — Delete target

Delete the target.

Opening the shortcut displays an informative notice and does not crash.

---

## Test 9 — Redirect chain

Given:

```text
A.md -> B.md
B.md -> C.md
```

opening `A.md` opens `C.md`.

---

## Test 10 — Circular redirect

Given:

```text
A.md -> B.md
B.md -> A.md
```

opening either shortcut displays a circular-link warning and does not hang.

---

## Test 11 — Ordinary notes

Opening any note without a `symlink` property behaves exactly as normal.

---

## Test 12 — Restart

Create shortcuts, close Obsidian, restart Obsidian, and verify that all shortcuts continue working without manual rebuilding.

---

# 22. MVP Definition

Version `0.1.0` requires only:

- recognition of `symlink:` frontmatter
- redirect on open
- target-chain resolution
- loop detection
- command to create a symlink
- folder selection
- collision prevention
- automatic target-path updates after target rename/move
- graceful broken-target handling
- desktop/mobile-safe implementation

Everything else is secondary.

---

# 23. Future Features

Do not implement these during the initial MVP unless specifically requested.

Possible later features include:

- Context-menu item in File Explorer
- `Create symlink here`
- Custom shortcut names
- Change target command
- Locate all shortcuts pointing to current note
- Reveal shortcut files
- Broken-link diagnostics
- Broken-link repair interface
- Hide shortcuts from selected Obsidian interfaces where technically possible
- Optional shortcut icon or visual indicator
- Folder symlinks
- Settings for frontmatter property name
- Relative-path support
- Automatic shortcut cleanup when target is deleted

---

# 24. Development Priorities

When making implementation decisions, use this priority order:

1. **Do not lose user data.**
2. **Do not overwrite existing notes.**
3. **Keep canonical notes ordinary.**
4. **Use Obsidian APIs rather than OS-specific filesystem APIs.**
5. **Keep behavior understandable from the Markdown itself.**
6. **Keep the implementation small.**
7. **Prefer boring code over clever abstractions.**

---

# 25. Instructions for AI Development Agents

When implementing this specification:

- Read the existing repository before modifying anything.
- Follow the current Obsidian plugin structure if one already exists.
- Do not rewrite unrelated code.
- Do not add dependencies unless clearly necessary.
- Prefer built-in Obsidian APIs.
- Keep TypeScript strict and explicit.
- Avoid `any` unless an Obsidian API genuinely requires it.
- Do not invent undocumented Obsidian APIs.
- Do not monkey-patch core plugins.
- Do not manipulate Obsidian's internal File Explorer DOM.
- Do not use OS-specific symlink functionality.
- Do not silently change user files beyond the required frontmatter edits.
- Preserve unrelated frontmatter when modifying `symlink`.
- Check for file collisions before creating anything.
- Handle exceptions and notify the user rather than failing silently.
- Keep individual methods small enough to reason about.
- Add comments for non-obvious Obsidian lifecycle/navigation behavior, not for self-explanatory code.

If the specification conflicts with a convenience feature, follow the specification.

If an implementation would require substantial new architecture, reconsider whether the feature belongs in version 0.1.

The intended plugin is small.

Keep it small.

---

# 26. Product Summary

**Symlink Notes** provides portable, Markdown-native shortcuts between Obsidian folders.

A shortcut is simply:

```yaml
---
symlink: path/to/the/real/note.md
---
```

Opening it opens the real note.

That is the product.