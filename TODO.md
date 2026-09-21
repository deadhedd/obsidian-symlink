# TODO

Pre-submission checklist for Symlink Notes.

## Code and metadata

- [ ] Rename the command from `Create symlink to current note` to `Create symlink to active note`.
  - [ ] Update the command name in `src/main.ts`.
  - [ ] Update remaining literal command-name references in the README and development specification.
- [ ] Fix startup initialization.
  - [ ] Move the initial index rebuild behind `workspace.onLayoutReady()`.
  - [ ] Register vault event handlers after layout is ready, especially `vault.on('create', ...)`.
- [ ] Minify production builds by adding `minify: !watch` to `esbuild.config.mjs`.
- [x] Verify `minAppVersion`.
  - [x] Confirm `1.5.7` as the minimum required version from documented Obsidian API availability.
- [ ] Decide whether to change the manifest author from `Symlink Notes contributors` to `deadhedd`.

## Verification

- [ ] Run `npm ci`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Confirm `main.js` is generated successfully.
- [ ] Run the desktop smoke test in a disposable vault.
- [ ] Test on mobile because `isDesktopOnly` is `false`.

## Release readiness

- [ ] Confirm `manifest.json` version is `0.1.0`.
- [ ] Confirm `package.json` version is `0.1.0`.
- [ ] Confirm `versions.json` contains the matching `0.1.0` mapping.
- [ ] Confirm `LICENSE` and `README.md` are present and current.
- [ ] Confirm generated `main.js` is not committed to the repository.

## Release

- [ ] Create GitHub release/tag `0.1.0` (not `v0.1.0`).
- [ ] Attach `main.js` to the release.
- [ ] Attach `manifest.json` to the release.
- [ ] Download the release assets and install those exact files into a clean test vault.
- [ ] Verify the released plugin enables and works correctly.

## Submission

- [ ] Submit `deadhedd/obsidian-symlink` to the Obsidian Community plugin directory.
- [ ] Resolve any automated or reviewer feedback.
