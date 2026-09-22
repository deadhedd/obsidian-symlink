# 0001. Verification contract and TypeScript test checking

**Date**: 2026-09-22
**Status**: Accepted

## Summary

This decision defines one verification contract for the repository. The project supports Node 22 and Node 24 as development and build environments, and contributors and CI use `npm run check` as the same proof of correctness. Strict TypeScript checking covers plugin code and every TypeScript test, while the JavaScript Obsidian mock remains a runtime only dependency with an explicit declaration.

## Context

The repository currently documents Node 18 or newer, while the intended support policy is the actively supported Node LTS lines only. A broad lower bound would imply support for Node majors that the project does not continuously verify.

The current TypeScript configuration checks only `src/**/*.ts`. The test suite contains TypeScript that is bundled and run, but it is not part of the static contract. The JavaScript mock intentionally implements only the small Obsidian surface needed by the tests, so its boundary must be described without changing its runtime behavior or pretending that it is the full Obsidian API.

The repository also needs one CI path that contributors can reproduce locally. The check must prove both supported Node lines, keep each result visible, and fail when installation, static checking, tests, or the production build fails.

## Requirements

**User stories**:

1. As a contributor, I want one verification command that matches CI so that local results predict repository results.
2. As a maintainer, I want the supported Node policy stated in package metadata, contributor guidance, and CI so that compatibility claims stay explicit.
3. As a TypeScript test author, I want future test files checked automatically so that test type errors cannot hide outside the static contract.

**Acceptance criteria**:

1. **AC-1**: `package.json` declares `engines.node` as `^22.0.0 || ^24.0.0`.
2. **AC-2**: `README.md` and `AGENTS.md` both state Node 22 and Node 24 as the supported lines for repository development, build, and verification only, and both identify `npm run check` as the canonical repository verification command. Neither document presents Node as part of the Obsidian plugin runtime contract.
3. **AC-3**: `tsconfig.json` strictly checks every file matched by `src/**/*.ts` and `tests/**/*.ts`, without requiring future TypeScript test files to be added to the configuration individually.
4. **AC-4**: TypeScript checking uses an explicit declaration for `tests/obsidian.mock.mjs`, keeps the mock runtime file unchanged, and does not use a broad `any` declaration for the mock surface.
5. **AC-5**: `@types/node` uses the Node 22 major as the TypeScript API baseline.
6. **AC-6**: The root metadata in `package-lock.json` matches the package metadata, including the Node 22 type dependency baseline and the supported engine declaration, so `npm ci` can reproduce the declared dependency set.
7. **AC-7**: `npm run check` runs `npm run typecheck`, then `npm test`, then `npm run build`, and stops at the first nonzero result. The duplicate type check inside `build` remains intentional so `npm run build` is independently type safe.
8. **AC-8**: A repository local GitHub Actions workflow runs on pull requests targeting `main` and pushes to `main`, with a matrix containing Node 22 and Node 24.
9. **AC-9**: Each matrix entry runs `npm ci` and then exactly `npm run check`. A failure from either command fails that matrix entry and the workflow. No matrix entry is advisory and `continue-on-error` is not used.
10. **AC-10**: The workflow uses `fail-fast: false`, requests only `contents: read`, uses no secrets or write permissions, and does not cancel overlapping runs.
11. **AC-11**: The change does not alter plugin runtime behavior, the JavaScript mock runtime behavior, or the existing product acceptance behavior.

## Options considered

### Option 1: One explicit LTS contract across package, tests, documentation, and CI

Declare the two supported Node lines in package metadata and contributor guidance, include all TypeScript tests in the existing strict configuration, describe the JavaScript mock with a test declaration, and run the same check through a GitHub Actions matrix.

**Pros**:

1. One readable contract covers local work and both CI environments.
2. Static checking catches future TypeScript tests automatically.
3. The small JavaScript mock stays unchanged and its limits remain visible.

**Cons**:

1. The Node versions are repeated in four repository surfaces and need one reviewed update when policy changes.
2. The mock declaration needs maintenance when the test fixture grows.

### Option 2: Keep the historical Node 18 or newer policy

Retain the current lower bound and use one or more newer Node versions only as additional CI coverage.

**Pros**:

1. It avoids changing existing wording.
2. It permits a broad range claim with little package metadata work.

**Cons**:

1. It claims support for Node majors that are not part of the maintained LTS contract.
2. It makes the CI evidence weaker than the compatibility statement.

### Option 3: Separate test compiler configuration

Keep the production TypeScript configuration focused on source files and add a second test configuration for the TypeScript suite.

**Pros**:

1. Test specific compiler settings could evolve independently.
2. The production configuration would remain unchanged.

**Cons**:

1. It adds another configuration surface before the test environment needs one.
2. Contributors could run one compiler configuration while CI runs another.

### Option 4: Add generated or drift detecting support metadata

Generate documentation and the CI matrix from package metadata, or add a script that compares every declaration.

**Pros**:

1. Automated generation can reduce repeated version values.
2. A comparison script can detect policy drift.

**Cons**:

1. It adds tooling and another failure mode to a small repository.
2. The current policy changes infrequently and is easy to review as one edit.

## Decision

**Chosen option**: Option 1: One explicit LTS contract across package, tests, documentation, and CI.

The repository will declare Node 22 and Node 24 with `engines.node`, use `npm run check` as the only canonical verification command, use the Node 22 major for `@types/node`, include all TypeScript source and test files in one strict TypeScript configuration, and describe the runtime only JavaScript mock with a narrow declaration. GitHub Actions will run `npm ci` and `npm run check` independently on both Node lines for pull requests targeting `main` and pushes to `main`.

## Rationale

The oldest supported LTS line is the honest TypeScript baseline, so `@types/node` will use the Node 22 major while CI also proves Node 24. This avoids type checking against APIs that the older supported line does not provide.

Keeping `npm run check` as the single command preserves local and CI parity without adding a second alias or a custom Node version guard. A matrix with independent entries gives complete evidence for both supported lines, while read only workflow permissions and no concurrency cancellation keep the workflow simple and observable.

## Standard definition

**Canonical pattern**:

```json
{
  "engines": {
    "node": "^22.0.0 || ^24.0.0"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "node tests/run.mjs",
    "build": "npm run typecheck && node esbuild.config.mjs",
    "check": "npm run typecheck && npm test && npm run build"
  }
}
```

The TypeScript configuration includes `src/**/*.ts` and `tests/**/*.ts`. `tests/obsidian.mock.d.mts` explicitly declares every imported mock value and the fixture fields used by the TypeScript tests, including the small fake `App`, `TFile`, `TFolder`, workspace, event, leaf, modal, and command surfaces. A test only adapter may use explicit `unknown` assertions at the boundary between those fake values and production `App`, `TFile`, and `TFolder` parameters. A local test helper may expose the mock only `commands`, `ready`, and `modal` properties on the plugin value. No `any` is allowed for this boundary, and no ambient augmentation of production `obsidian` types is allowed. These adaptations must not change plugin source or the JavaScript mock runtime.

The workflow follows this shape:

```yaml
name: Verification

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [22.x, 24.x]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run check
```

The workflow uses the exact official major tags `actions/checkout@v7` and `actions/setup-node@v7`. It has no concurrency cancellation block and no advisory matrix entries.

**Replaces**:

1. The historical Node 18 or newer wording in contributor guidance.
2. Source only static checking that excludes TypeScript tests.
3. An untyped import boundary for the JavaScript mock.
4. Separate CI commands that could drift from the contributor command.
5. Default or write capable workflow permissions for a read only verification job.

**Enforcement**:

1. `package.json` declares the supported runtime lines.
2. `tsconfig.json` makes the TypeScript test boundary part of `npm run typecheck`.
3. `npm run check` preserves the fail fast sequence of static checking, tests, and build. The repeated type check inside `npm run build` is intentional and keeps direct builds independently type safe.
4. GitHub Actions runs the exact command after a clean `npm ci` on both supported lines. Any nonzero result fails the workflow.
5. Branch protection configuration is not changed by this specification. If the repository requires blocking merges on the workflow, that remains a repository setting outside this slice.

**Rollout**:

Single implementation change. Update package metadata and its lockfile, the TypeScript configuration and test declaration, both contributor guidance files, and the repository workflow together. Do not refactor plugin source or the JavaScript mock runtime.

**Exceptions**:

The JavaScript mock remains runtime only. Its explicit declaration may model only the small fixture surface used by tests. No TypeScript source or test file is excluded from strict checking, and no plugin runtime exception is permitted for this standard.

## Consequences

**Positive**:

1. Compatibility claims, local commands, and CI evidence describe the same contract.
2. Future TypeScript tests are checked automatically.
3. Both supported Node lines produce independent enforcing results.
4. The mock boundary becomes clear without altering test runtime behavior.

**Negative / tradeoffs**:

1. Node policy updates require coordinated edits to package metadata, CI, README, and AGENTS.
2. A typed declaration adds maintenance when the mock fixture changes.
3. Two matrix entries consume more runner time than one.
4. Major action tags are readable and maintainable, but do not provide immutable commit pinning.

**Neutral**:

1. Unsupported local Node versions may produce the normal npm engine warning. `npm run check` does not add a custom version guard.
2. The production build remains the final integration check and continues to produce the existing ignored bundle artifact.
3. Agent Skill and MCP discovery was declined for this slice. No additional tool integration is required by the standard.

## Follow-up

1. Revisit the Node version list when the actively supported LTS policy changes, updating all four declarations in one reviewed change.
2. Reconsider a separate test TypeScript configuration only if the test environment develops materially different compiler requirements.
3. Consider immutable GitHub Actions commit pinning only if repository maturity or a concrete supply chain risk makes that tradeoff worthwhile.
