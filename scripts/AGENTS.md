# Repository scripts

## Purpose

This area contains Node.js scripts used during repository development and release preparation. These scripts are not part of the Obsidian plugin runtime.

## Release artifact

Run `npm run release:check` after `npm ci` to run the canonical repository check and create the ignored `release/` directory. The directory may contain only `main.js` and `manifest.json`.

The release command uses fixed repository paths, validates package and plugin metadata, preserves unexpected existing paths, and reports SHA 256 values for the delivered files. Keep its implementation on Node built in APIs and existing repository dependencies.

## Specification

The release process is governed by [0002](../docs/specs/0002-reproducible-release-artifact.md).

_Drafted by /sync from the introducing change, worth a quick human pass._
