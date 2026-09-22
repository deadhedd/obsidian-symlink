# Scope: Symlink Notes engineering maturity

Symlink Notes is an existing Obsidian plugin that provides Markdown based shortcuts between notes. This scope brings its current released stage to greenfield equivalent engineering maturity without changing plugin behavior.

**Build approach:** Tracer Bullet (prove each repository delivery path end to end before expanding it).
**Workflow:** Beta (after develop, run `/check verify`, then `/test`). The project default level of rigor. `/architect` is the recommended first stop when a slice still carries a load bearing decision.

_These are recommendations to keep the work orderly. You decide when each slice is complete._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Symlink Notes MVP | Existing | existing |
| 2 | Release metadata and repository documentation | Slice 1 | done |
| 3 | Verification contract and TypeScript test checking | Slice 2 | done |
| 4 | Repository owned release artifact | Slice 3 | done |
| 5 | Release verification evidence | Slice 4 | in-progress |
| 6 | Repository context and identity hygiene | Slice 5 | done |

## Existing product

### 1. Symlink Notes MVP · existing

The released MVP provides Markdown based note shortcuts, target resolution, loop handling, safe creation, rename and move updates, broken target handling, and Desktop and Mobile compatible plugin behavior. Treat this implementation and its product behavior as complete.

**Done when:** the current implementation remains unchanged while the engineering slices below preserve the existing acceptance behavior.

Spec: [Symlink Notes development specification](../../Symlink%20Notes%20%E2%80%94%20AI%20Development%20Specification.md) · code in `../../src/`

## Engineering maturity

### 2. Release metadata and repository documentation · done

Reconcile the current `0.1.1` package, plugin metadata, version history, README, specification references, and release checklist so one current story is told everywhere.

**Done when:** `package.json`, `package-lock.json`, `manifest.json`, `versions.json`, README references, the specification version language, and release checklist agree about the current release and no completed work remains described as an unfinished `0.1.0` release.

- [x] Build it: `/develop release metadata and repository documentation`

Code in `../../package.json`, `../../package-lock.json`, `../../manifest.json`, `../../versions.json`, `../../README.md`, `../../TODO.md`, and `../../Symlink Notes — AI Development Specification.md`.

### 3. Verification contract and TypeScript test checking · done

Define a truthful Node.js support policy and make relevant TypeScript tests participate in static checking while keeping the current runtime behavior unchanged.

**Done when:** the supported Node.js range is explicit, the verification environment tests that policy, the TypeScript test source is checked by an appropriate static command, CI runs the resulting contract, and the full repository check remains green.

- [x] Design it: `/architect verification contract and TypeScript test checking`
- [x] Build it: `/develop verification contract and TypeScript test checking`

Spec: [0001](../specs/0001-verification-contract-typescript-tests.md)
Code in `../../package.json`, `../../package-lock.json`, `../../tsconfig.json`, `../../tests/obsidian.mock.d.mts`, `../../tests/plugin.test.ts`, `../../README.md`, `../../AGENTS.md`, and `../../.github/workflows/ci.yml`.

### 4. Repository owned release artifact · done

Create one reproducible repository process for constructing and validating the exact Obsidian distribution files, with local vault state and unrelated repository files excluded.

**Done when:** one documented repository command produces only the intended `main.js` and `manifest.json`, validates their version and manifest relationship, cannot include `.obsidian` state or unrelated files, and succeeds from a clean install.

- [x] Design it (spec): `/architect repository owned release artifact`
- [x] Build it: `/develop repository owned release artifact`
  - [x] Add the release command and npm entry point, covering AC-1, AC-2, AC-3, and AC-9
  - [x] Validate release metadata and create the exact two file artifact, covering AC-4, AC-5, AC-6, and AC-7
  - [x] Add focused tests, documentation, and release evidence output, covering AC-3, AC-8, and AC-9

Code in `../../scripts/release-check.mjs`, `../../package.json`, `../../.gitignore`, `../../tests/plugin.test.ts`, `../../README.md`, and `../../TODO.md`.
- [x] Verify it: `/check verify repository owned release artifact`
- [x] Test it: `/test repository owned release artifact`

Spec: [0002](../specs/0002-reproducible-release-artifact.md)

### 5. Release verification evidence · in-progress

Make the manual Desktop and Mobile smoke checks durable and tied to the exact release assets being verified.

**Done when:** the repository records the release version, asset hashes, Obsidian and device versions, clean vault setup, smoke test results, and any limitations for the verified Desktop and Mobile runs.

- [x] Design it (spec): `/architect release verification evidence`

Spec: [0003](../specs/0003-release-verification-evidence.md)

Files in `../../docs/release-verification/template.md`, `../../README.md`, and `../../TODO.md`.

- [x] Build it: `/develop release verification evidence`
  - [x] Add the fixed Markdown template for artifact identity, environments, outcomes, notes, retests, and limitations, covering AC-1, AC-3, AC-4, AC-5, AC-7, AC-8, AC-10, and AC-11
  - [x] Document the manual workflow in README and order the TODO release checklist so artifact construction precedes publication, covering AC-2, AC-6, AC-9, AC-12, and AC-14
  - [x] Perform the Desktop and Mobile smoke checks against the unchanged recorded artifact files, or record an honest `Blocked` result when an environment is unavailable, and check in the version record, covering AC-3, AC-5, AC-6, AC-7, AC-9, AC-10, AC-11, and AC-13
- [ ] Verify it: `/check verify release verification evidence`
- [ ] Test it: `/test release verification evidence`

### 6. Repository context and identity hygiene · done

Reconcile the local workflow context and repository identity without creating redundant guidance or changing plugin behavior.

**Done when:** `AGENTS.md` names the current `yaml` dependency and `npm run check`, `CLAUDE.md` remains only a pointer, the canonical Git remote is used, and local `.obsidian` state has an explicit non leaking treatment in the repository workflow.

- [x] Build it: `/develop repository context and identity hygiene`

Code in `../../AGENTS.md`, `../../CLAUDE.md`, and `../../.gitignore`.

## Explicitly outside this scope

The required work does not include a formatter, linter, coverage thresholds, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, commit hash pinning for GitHub Actions, product features, runtime behavior changes, or speculative refactoring.

## Legend

**Feature lifecycle:** `existing` records complete work that predates the skills workflow. Planned slices move through `in-progress` and `done` as they are designed, built, verified, and tested.

**Next step:** the first unticked box, `/develop release metadata and repository documentation`.

**Needs a decision:** run `/architect` before implementation because the slice defines a support or release contract that should be recorded before code is written.
