# 0002. Repository release artifact construction

**Date**: 2026-09-22
**Status**: Accepted

## Summary

This decision adds one repository command that constructs and validates the exact files needed to install Symlink Notes. The command uses the existing `npm ci` setup and `npm run check` verification contract, then creates a gitignored `release/` directory containing only `main.js` and `manifest.json`. It reports the release version and file hashes, with no changes to plugin runtime code.

## Context

The repository already has a production build that writes `main.js` and carries `manifest.json` as tracked release metadata. The README explains how to copy those files into an Obsidian vault, but the repository has no single process that proves the copied files are the intended release.

The root `main.js` is ignored, `.obsidian/` is local vault state, and the repository contains other files that must not enter an installable plugin directory. Release metadata also exists in `package.json`, `manifest.json`, and `versions.json`. Without one explicit gate, a release can be assembled from stale output, mismatched metadata, or an accidental extra file.

This is a local release aid for a small plugin maintained by one developer. It does not need to behave like a concurrent production service or prove bit for bit reproducibility across operating systems and independent installations. The useful contract is a normal repository command that runs the established verification path and makes the release files and their evidence explicit.

## Requirements

**User stories**:

1. As a maintainer, I want one command to construct the installable plugin files so that release preparation has a repeatable repository process.
2. As a maintainer, I want the command to validate release metadata and report hashes so that later release evidence describes the files that were checked.

**Acceptance criteria** (the contract):

1. **AC-1**: `npm run release:check` exists, accepts no required arguments, uses fixed repository relative paths, and is documented in the repository release workflow.
2. **AC-2**: The documented setup runs `npm ci` before `npm run release:check`. The release command does not require a clean Git worktree or a matching Git tag, and it does not change plugin runtime code or vault state.
3. **AC-3**: The command runs the canonical `npm run check` before creating release output. A failure from type checking, tests, or the production build exits nonzero and prevents release files from being created or replaced.
4. **AC-4**: The command requires `package.json.name === manifest.json.id` and `package.json.version === manifest.json.version`.
5. **AC-5**: The command requires `versions.json[package.json.version] === manifest.json.minAppVersion` and does not modify the historical `versions.json` file.
6. **AC-6**: The command creates or updates the gitignored `release/` directory with exactly two files, `main.js` and `manifest.json`, copied from the validated production output and repository metadata. It does not add an archive, source file, map file, `.obsidian` state, or unrelated repository file.
7. **AC-7**: If an existing `release/` directory contains a path other than `main.js` or `manifest.json`, the command fails with a nonzero result and does not delete the unexpected path.
8. **AC-8**: After both files are copied successfully, the command reports the release version, the exact artifact file set, the lowercase hexadecimal SHA 256 digest of `release/main.js`, the lowercase hexadecimal SHA 256 digest of `release/manifest.json`, and the output directory.
9. **AC-9**: The command uses only Node built in APIs and existing repository dependencies. It adds no archive format, task runner, packaging framework, lock, backup protocol, new service, secret, or runtime plugin dependency.

## Options considered

### Option 1: A small release validation command

Add `scripts/release-check.mjs` and an `npm run release:check` alias. The command assumes dependencies were installed with `npm ci`, runs `npm run check`, validates the three metadata relationships, copies exactly two files into `release/`, and reports version and SHA 256 values.

**Pros**:

1. It closes the repository ownership gap with a small understandable process.
2. It reuses the existing type check, test suite, and production build.
3. It keeps the installable artifact directly inspectable and directly usable in Obsidian.
4. It adds useful release evidence without adding a report format or package dependency.

**Cons**:

1. It proves one successful checked build, not independent cross platform reproducibility.
2. A file write failure during publication may require rerunning the command.

### Option 2: Build twice and compare generated output

Run the production build twice and compare the generated `main.js` files before copying them.

**Pros**:

1. It detects some nondeterministic build output.

**Cons**:

1. It doubles build work for a small local release gate.
2. Two adjacent builds still do not prove reproducibility across installations, Node versions, or operating systems.
3. The current repository gap is missing ownership and validation, not a demonstrated nondeterministic build.

### Option 3: Add release construction to `npm run check`

Make every ordinary repository check create or update the release directory.

**Pros**:

1. Every check would exercise the release copy path.

**Cons**:

1. Routine development would mutate release output.
2. A normal correctness check would gain release specific failure behavior and documentation burden.

### Option 4: Publish an archive or use packaging tooling

Create a versioned archive or add a packaging task runner for the two files.

**Pros**:

1. An archive can be convenient for a distribution system that requires one download.

**Cons**:

1. There is no current distribution requirement for an archive.
2. New tooling would add maintenance cost and another artifact format without closing a concrete gap.

## Decision

**Chosen option**: Option 1: A small release validation command.

The repository will add `scripts/release-check.mjs` and expose it as `npm run release:check`. After the documented `npm ci` setup, the command will run `npm run check`, validate package, manifest, and current compatibility metadata, copy exactly `main.js` and `manifest.json` into `release/`, and report the version and SHA 256 values. It will not run a second build.

## Rationale

The repository already has one accepted verification contract. Reusing `npm run check` gives the release command the existing type check, tests, and production build without creating a second build path or introducing a new dependency installation step.

The missing capability is an explicit, repository owned artifact boundary. A fixed two file copy after successful validation solves that problem directly. SHA 256 output provides useful evidence for the later verification feature, while a second build would add time and complexity without a repository requirement or evidence of nondeterminism.

## Feature design

**Data model sketch**:

No persistent data model applies. The command reads repository metadata and build output, then writes the gitignored `release/` directory. It must not change plugin runtime state or vault data.

**State transitions**:

The command moves through `not started`, `repository check passed`, `metadata validated`, `release files copied`, and `reported`. Any `npm run check`, metadata, or existing release boundary failure exits nonzero before creating or replacing release files. A copy failure exits nonzero and can be corrected by rerunning the command.

**API surface**:

| Command | Inputs | Outputs | Auth | Key errors |
|---|---|---|---|---|
| `npm run release:check` | No required arguments. Fixed repository relative paths. | Exit code zero and concise terminal evidence on success. Nonzero exit and an actionable error on failure. | Local repository access only. No application authentication. | Missing dependencies, type check failure, test failure, build failure, invalid metadata, unexpected release path, or copy failure. |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Identify the release | Version | `package.json.version` |
| Validate plugin identity | Package name and plugin id | `package.json.name` and `manifest.json.id` |
| Validate release version | Package and manifest versions | `package.json.version` and `manifest.json.version` |
| Validate compatibility history | Minimum Obsidian version | `versions.json[package.json.version]` and `manifest.json.minAppVersion` |
| Build the plugin | Validated `main.js` | The production build run by `npm run check` |
| Construct the artifact | `main.js` and `manifest.json` | Root `main.js` after the successful check and root `manifest.json` after metadata validation |
| Report release evidence | Version, file set, output directory, and hashes | The delivered `release/main.js` and `release/manifest.json`, with lowercase hexadecimal SHA 256 values computed during the current command run using Node built in APIs |

**Key invariants**:

1. `package.json.name` equals `manifest.json.id`.
2. `package.json.version` equals `manifest.json.version`.
3. `versions.json[package.json.version]` equals `manifest.json.minAppVersion`.
4. The release directory contains exactly `main.js` and `manifest.json` after success.
5. The release files come from the successful repository check and validated repository metadata.
6. No archive, source file, source map, vault state, or unrelated repository file enters `release/`.
7. An unexpected existing path under `release/` is never deleted by the command.

**Security model**:

The command is a local build operation with no application users, roles, or stored secrets. It uses fixed repository paths and a fixed file allowlist. It does not accept a caller supplied version or destination. Node filesystem APIs are allowed in this repository development script and remain forbidden in plugin runtime code.

**Configuration required**:

No new environment variables, credentials, or feature flags are required. The documented prerequisite is `npm ci`.

**Critical test scenarios**:

1. Happy path: run `npm ci` and `npm run release:check`, then verify the two file artifact, metadata relationships, version, output directory, and reported hashes, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, and **AC-8**.
2. Metadata failure: use a fixture with a mismatched package version, manifest version, plugin id, or current compatibility entry and verify a nonzero result before release copying, verifies **AC-4** and **AC-5**.
3. Artifact boundary failure: place an unexpected file in `release/` and verify the command refuses to delete it and exits nonzero, verifies **AC-6** and **AC-7**.
4. Repository check failure: make type checking, tests, or the production build fail and verify the command exits nonzero without creating release output, verifies **AC-3**.
5. Scope boundary: verify the resulting directory contains only `main.js` and `manifest.json`, with no archive, map, source file, `.obsidian` state, or unrelated file, verifies **AC-6** and **AC-9**.

## Build plan

The repository uses a Tracer Bullet approach. The first slice should prove the complete path from the existing check command to a directly installable artifact. The second slice should make the failure boundary and release instructions explicit.

- [x] 1. Add `scripts/release-check.mjs` with fixed repository paths, execution of `npm run check`, metadata validation, exact release directory validation, copying, SHA 256 reporting, exit codes, and clear errors, satisfying **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, and **AC-8**.
- [x] 2. Add the `release:check` npm script and add `release/` to `.gitignore`, satisfying **AC-1**, **AC-2**, **AC-6**, and **AC-9**.
- [x] 3. Add focused automated coverage for command success, metadata mismatch, unexpected release paths, check failure, exact file output, and hash reporting. Extend the existing test runner only as needed, satisfying **AC-3**, **AC-4**, **AC-5**, **AC-6**, and **AC-7**.
- [x] 4. Document `npm ci`, `npm run release:check`, the exact two file output, and the terminal evidence in the README and release checklist. Keep Git tags described as separate release evidence, satisfying **AC-1**, **AC-2**, and **AC-8**.
- [x] 5. Run `npm run check`, then `npm run release:check`, and inspect the resulting directory and reported hashes before the feature is marked done, satisfying every acceptance criterion.

## Consequences

**Positive**:

1. Release construction becomes one normal repository operation.
2. The artifact is directly inspectable and directly installable.
3. Release metadata and the exact file boundary are checked before copying.
4. Hash and version output can be copied into later release verification evidence.
5. The implementation remains small enough for one maintainer to understand and repair.

**Negative / tradeoffs**:

1. The command validates one successful build rather than proving independent cross platform reproducibility.
2. Release validation still repeats the existing check if run after ordinary development verification.
3. A filesystem failure during copying may require rerunning the command.

**Neutral**:

1. Git tags remain useful release provenance, but artifact construction does not verify or create them.
2. The process reports hashes to the terminal but writes no report file into the artifact.
3. Full Obsidian manifest schema validation remains outside this slice.

## Follow-up

1. Use the release command output when implementing the planned release verification evidence feature.
2. Consider an archive only when a concrete distribution workflow requires one.
3. Consider stronger reproducibility checks only if the repository later records a real nondeterministic build problem.
