# TODO

Pre-submission checklist for Symlink Notes.

## Code and metadata

- [x] Rename the command from `Create symlink to current note` to `Create symlink to active note`.
  - [x] Update the command name in `src/main.ts`.
  - [x] Update remaining literal command-name references in the README and development specification.
- [x] Fix startup initialization.
  - [x] Move the initial index rebuild behind `workspace.onLayoutReady()`.
  - [x] Register vault event handlers after layout is ready, especially `vault.on('create', ...)`.
- [x] Minify production builds by adding `minify: !watch` to `esbuild.config.mjs`.
- [x] Verify `minAppVersion`.
  - [x] Confirm `1.5.7` as the minimum required version from documented Obsidian API availability.
- [x] Decide whether to change the manifest author from `Symlink Notes contributors` to `deadhedd`.

## Verification

- [x] Run `npm ci`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Confirm `main.js` is generated successfully.
- [x] Run the desktop smoke test in a disposable vault.
- [x] Test on mobile because `isDesktopOnly` is `false`.

## Release readiness

- [x] Confirm `manifest.json` version is `0.1.0`.
- [x] Confirm `package.json` version is `0.1.0`.
- [x] Confirm `versions.json` contains the matching `0.1.0` mapping.
- [x] Confirm `LICENSE` and `README.md` are present and current.
- [x] Confirm generated `main.js` is not committed to the repository.

## Release

- [ ] Create GitHub release/tag `0.1.0` (not `v0.1.0`).
- [ ] Attach `main.js` to the release.
- [ ] Attach `manifest.json` to the release.
- [ ] Download the release assets and install those exact files into a clean test vault.
- [ ] Verify the released plugin enables and works correctly.

## Submission

- [ ] Submit `deadhedd/obsidian-symlink` to the Obsidian Community plugin directory.
- [ ] Resolve any automated or reviewer feedback.
