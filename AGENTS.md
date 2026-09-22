# Symlink Notes

## Stack

- **Language and runtime**: TypeScript, Node.js 22 or Node.js 24 for repository development, builds, and verification only. Node.js is not part of the Obsidian plugin runtime contract.
- **Framework**: Obsidian community plugin API
- **Key dependencies**: Obsidian API types, esbuild, TypeScript, yaml for tests
- **Package manager**: npm

## Build approach

Tracer Bullet (prove each repository delivery path end to end before expanding it).

## Commands

```bash
# Install
npm ci

# Development build
npm run dev

# Build
npm run build

# Full repository check
npm run check

# Repository release artifact
npm run release:check

# Test
npm test

# Type check
npm run typecheck
```

`npm run check` is the canonical repository verification command. It runs type checking, tests, and the production build in that order.

## Specs

The product and acceptance specification is [Symlink Notes development specification](Symlink%20Notes%20%E2%80%94%20AI%20Development%20Specification.md) in the repository root. The verification contract is [0001](docs/specs/0001-verification-contract-typescript-tests.md).

- The repository owned release artifact is governed by [0002](docs/specs/0002-reproducible-release-artifact.md).
- Release verification evidence is governed by [0003](docs/specs/0003-release-verification-evidence.md).

## Rules

- Keep shortcut state in ordinary Markdown frontmatter so vault data stays portable.
- Use public Obsidian APIs. Do not use operating system filesystem links or Node filesystem APIs in the plugin.
- Preserve canonical note content and unrelated frontmatter when changing a shortcut target.
- Check for existing files before creating a shortcut. Never overwrite user notes.
- Keep TypeScript strict and avoid unnecessary layers or dependencies.
- Put plugin code in `src/` and test code in `tests/`.
- Run `npm test` and `npm run build` before handing off a change.
- Record manual release verification in `docs/release-verification/<version>.md` using the repository template after the exact artifact is built.

## Repository workflow

- Use `origin` at `git@github.com:deadhedd/obsidian-symlink.git` as the canonical repository remote.
- Keep local Obsidian vault state in `.obsidian/` untracked. Do not include it in commits or release artifacts.

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

- [scripts/AGENTS.md](scripts/AGENTS.md): Repository release validation scripts and the exact two file artifact boundary.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
