# 0003. Release verification evidence records

**Date**: 2026-09-22
**Status**: In Progress

## Summary

This decision adds a small checked in Markdown record for each release that is manually smoke tested. The record identifies the exact installable files with their release version and SHA 256 hashes, then records concise Desktop and Mobile results. It uses the existing release command and manual workflow, with no generator, database, external issue process, or plugin runtime change.

## Context

The repository already constructs the exact two file installable artifact with `npm run release:check`. That command reports the release version and SHA 256 hashes for `main.js` and `manifest.json`, but the repository does not yet retain the results of installing those files and exercising the plugin on Desktop and Mobile.

The remaining release evidence must be human readable, version controlled, and simple enough to complete after a manual smoke test. It must distinguish a behavior failure from an environment that prevented testing, while keeping the current evidence tied to the exact files that were tested.

The repository is a small TypeScript plugin project. The release record is documentation for one release, not a new runtime feature or a verification service. It must not turn the ignored `release/` directory into a mixed purpose evidence store.

## Requirements

**User stories**:

1. As a maintainer, I want one small record per release so that manual Desktop and Mobile smoke results remain reviewable after the test run.
2. As a maintainer, I want the record to identify the exact release files so that the results cannot be confused with another build.
3. As a maintainer, I want failed or blocked results retained so that the record describes what was actually verified rather than claiming a pass.

**Acceptance criteria** (the contract):

1. **AC-1**: The repository contains `docs/release-verification/template.md`, a small human readable Markdown template with field instructions for one release verification record.
2. **AC-2**: A completed record for release version `<version>` is stored at `docs/release-verification/<version>.md`, and verification evidence is not stored inside `release/`.
3. **AC-3**: Each record captures the release version, the lowercase SHA 256 hash of `main.js`, and the lowercase SHA 256 hash of `manifest.json`, copied from the successful `npm run release:check` output. The exact files under test are `release/main.js` and `release/manifest.json` from that run, copied unchanged into both clean test vaults. It does not require a source commit or Git tag.
4. **AC-4**: Each record captures one verification date in `YYYY-MM-DD` form and, for both Desktop and Mobile, the Obsidian version, operating system or device, and a concise clean vault setup note.
5. **AC-5**: Each platform records exactly one current outcome, `Pass`, `Fail`, or `Blocked`. `Pass` means every smoke action completed with expected behavior. `Fail` means an observed plugin behavior failure. `Blocked` means an external or environmental limitation prevented completion before any plugin behavior failure was observed.
6. **AC-6**: The smoke path recorded for each platform is enable the plugin, create a shortcut, open the shortcut and verify the target opens, rename or move the target, and verify the shortcut still resolves to the moved or renamed target.
7. **AC-7**: A `Pass` result needs no mandatory commentary. A `Fail` or `Blocked` result includes a short explanatory note naming the affected smoke action. The note for `Blocked` also identifies the external or environmental limitation.
8. **AC-8**: The record has one optional record level `Limitations` section for concise caveats that apply to the whole verification. Platform specific details remain in the platform notes.
9. **AC-9**: If one platform cannot be tested, the record is still created or completed with that platform marked `Blocked`, while the completed result for the other platform is retained. No platform result is left blank.
10. **AC-10**: A later retest of the same artifact is allowed only when both recorded SHA 256 hashes still match the files under test. It keeps the main fields at their current result and appends a short dated note in `YYYY-MM-DD` form in the affected platform notes. The note states the prior outcome, the new outcome, and what changed or allowed the retest to proceed.
11. **AC-11**: If the files under test do not match the recorded version or either recorded SHA 256 hash, verification stops. The existing record is not overwritten with new hashes, and no new evidence is created, until the artifact or versioning discrepancy is resolved. A corrected artifact with different hashes requires resolving the release version or artifact identity before evidence is created or updated.
12. **AC-12**: `README.md` briefly explains what the workflow is and when to use it, `TODO.md` contains the release step checklist with artifact construction before any publication step, and the template contains the fixed named fields defined by this spec. No separate guide or record generator is added.
13. **AC-13**: A record is checked in for `Pass`, `Fail`, or `Blocked` outcomes. The record is evidence of what was tested, not a certificate that both platforms passed.
14. **AC-14**: The change does not alter plugin runtime behavior, the existing `npm run release:check` command, the exact two file artifact boundary, or vault state.

## Options considered

### Option 1: A small checked in Markdown record

Keep a reusable template and one completed record per release under `docs/release-verification/`. The maintainer runs the existing release command, copies the template, fills the fields manually, and checks in the result.

**Pros**:

1. It is easy to read, review, and retain with the repository history.
2. It captures the exact artifact identity without adding a new service or data format.
3. It supports honest `Pass`, `Fail`, and `Blocked` outcomes and concise retest history.

**Cons**:

1. A maintainer must copy hashes and test results carefully.
2. Markdown fields have no automatic validation.

### Option 2: Generate a Markdown or JSON verification report

Add tooling that prefills or validates a report from the release command and possibly stores structured result data.

**Pros**:

1. Generated fields could reduce copying mistakes.
2. Structured output could support future reporting.

**Cons**:

1. It creates a second tooling subsystem for a small manual workflow.
2. Manual Desktop and Mobile observations would still need human entry.
3. Generated output could imply stronger verification than the process actually provides.

### Option 3: Use an external release issue or service

Store the smoke results in a GitHub issue, release workflow, or separate verification service and keep only instructions in the repository.

**Pros**:

1. External systems can provide workflow state and collaboration features.
2. The repository would contain fewer per release files.

**Cons**:

1. Evidence would be separated from the source and artifact instructions.
2. The process would depend on an external account and workflow.
3. It is disproportionate for a single maintainer and a two file plugin artifact.

## Decision

**Chosen option**: Option 1: A small checked in Markdown record.

The repository will add `docs/release-verification/template.md` and document a manual workflow that runs `npm run release:check`, copies the template to `docs/release-verification/<version>.md`, and records the exact version, two SHA 256 hashes, environment details, smoke results, required failure notes, and optional shared limitations. The existing release artifact command remains the source of the version and hashes.

No new command, generated report, database, external issue workflow, authentication model, secret, plugin runtime dependency, or verification service is needed.

## Rationale

The existing release command already produces the artifact identity needed by the record. A small Markdown template preserves that identity beside the human observations without duplicating release construction or inventing a second source of truth.

The selected result states keep the evidence honest. `Fail` describes a behavior defect, while `Blocked` records an environmental limitation. Retest notes preserve only the short transition history needed to explain the current result. Keeping the record outside `release/` preserves the exact two file install boundary established by the release artifact decision.

## Feature design

**Data model sketch**:

No persistent application data model applies. The documentation model has one reusable template and one record per release version.

| Document | Key fields | Relationship | Constraints |
|---|---|---|---|
| Verification template | Field instructions and placeholders | Used to create one release record | Stored at the fixed template path |
| Release verification record | Version, two hashes, one date, Desktop section, Mobile section, optional limitations | One record identifies one release artifact | Stored at the fixed version path, with no blank platform outcome |
| Platform result | Obsidian version, operating system or device, clean vault note, outcome, conditional notes | Two instances belong to one release record | Outcome is `Pass`, `Fail`, or `Blocked`; `Fail` and `Blocked` require notes |

The same version record may be updated for a retest only when the recorded version and hashes still identify the artifact under test. A hash mismatch stops the workflow until the discrepancy is resolved.

**Template shape**:

The template uses this fixed minimal Markdown shape. The `Notes` line is required only for `Fail` or `Blocked`, and must name the affected smoke action. The `Retest note` line is optional and is used only when a result changes.

```markdown
# Release verification: <version>

Verification date: YYYY-MM-DD
Release version: <version>
main.js SHA-256: <lowercase hash from npm run release:check>
manifest.json SHA-256: <lowercase hash from npm run release:check>

## Desktop

Obsidian version: <version>
Operating system or device: <value>
Clean vault setup: <brief note>
Smoke result: Pass | Fail | Blocked
Notes: <required for Fail or Blocked, name the affected smoke action>
Retest note: <optional YYYY-MM-DD note with prior result, new result, and what changed>

## Mobile

Obsidian version: <version>
Operating system or device: <value>
Clean vault setup: <brief note>
Smoke result: Pass | Fail | Blocked
Notes: <required for Fail or Blocked, name the affected smoke action>
Retest note: <optional YYYY-MM-DD note with prior result, new result, and what changed>

## Limitations

<optional shared caveat>
```

The exact `release/main.js` and `release/manifest.json` produced by the successful `npm run release:check` run are copied unchanged into both clean test vaults. A later retest may update results only while both recorded hashes still match those files. If either hash differs, stop and resolve the artifact or versioning discrepancy before creating or updating evidence.

**State transitions**:

The record moves from template, to drafted, to recorded. Each platform result moves independently among `Pass`, `Fail`, and `Blocked`. A retest changes the current platform result and appends one concise dated transition note. There is no separate event log.

**API surface**:

| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `npm run release:check` | Existing command | No required arguments | Release version, exact artifact file set, and two SHA 256 hashes | Local repository access | Existing release command errors, including failed checks or invalid artifact metadata |
| Verification record workflow | Manual documentation step | Current command output, smoke observations, and environment details | One Markdown record at the fixed version path | Repository write access | Missing artifact identity, hash mismatch, incomplete platform result, or missing required failure note |

No plugin API, network endpoint, database operation, or Obsidian runtime interface is added.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Identify the release | Release version | `npm run release:check` output, sourced from validated `package.json.version` |
| Identify the tested plugin bundle | SHA 256 hash of `main.js` | `npm run release:check` output, computed from `release/main.js` |
| Identify the tested manifest | SHA 256 hash of `manifest.json` | `npm run release:check` output, computed from `release/manifest.json` |
| Date the evidence | One calendar date in `YYYY-MM-DD` form | Maintainer performing the verification |
| Describe Desktop environment | Obsidian version, operating system, device if applicable, and clean vault note | Maintainer performing the Desktop smoke test |
| Describe Mobile environment | Obsidian version, device, and clean vault note | Maintainer performing the Mobile smoke test |
| Record each result | `Pass`, `Fail`, or `Blocked` | Outcome of the defined smoke path on that platform |
| Explain unsuccessful results | Short required note for `Fail` or `Blocked`, naming the affected smoke action | Maintainer observation, including the environmental limitation for `Blocked` |
| Explain a retest | Prior result, new result, `YYYY-MM-DD` date, and change that allowed the retest | Maintainer observation in the affected platform notes |
| Record shared caveats | Optional limitations | Maintainer judgment about a caveat that applies to the full verification |

**Key invariants**:

1. The record version and both hashes identify the exact `release/main.js` and `release/manifest.json` copied unchanged into the clean test vaults.
2. The two artifact hashes come from the successful `npm run release:check` output that produced the files under test.
3. The record lives under `docs/release-verification/`, never inside `release/`.
4. Both Desktop and Mobile have a current outcome, even when one is `Blocked`.
5. `Pass` means every smoke action completed with expected behavior and does not require notes.
6. `Fail` and `Blocked` are not interchangeable. `Fail` is an observed behavior failure. `Blocked` is an external limitation that prevented completion before any behavior failure was observed.
7. `Fail` and `Blocked` notes name the affected smoke action.
8. Retest notes do not replace the current result and do not become a formal event log.
9. A retest is allowed only while both recorded hashes match the files under test.
10. A hash mismatch stops verification before evidence is created or rewritten.
11. No source commit or Git tag is required in the record.

**Security model**:

This is local repository documentation. It has no application users, roles, credentials, secrets, personal data requirements, or external service authorization. Normal repository review and access controls govern changes to the records. The workflow must not copy vault contents or account details into the evidence.

**Configuration required**:

No new environment variables, credentials, feature flags, or dependencies are required.

**Critical test scenarios**:

1. Happy path: run `npm run release:check`, copy the exact resulting `release/main.js` and `release/manifest.json` unchanged into fresh disposable vaults on Desktop and Mobile, copy the template to the matching version path, complete the smoke path, and check in `Pass` results, verifying **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-12**, and **AC-13**.
2. Behavior failure: record `Fail` with a short platform note and retain the record, verifying **AC-5**, **AC-7**, and **AC-13**.
3. Environment block: record `Blocked` with the environmental limitation while retaining the other platform result, verifying **AC-5**, **AC-7**, **AC-9**, and **AC-13**.
4. Retest: confirm both recorded hashes still match the files under test, update the current result, and append a `YYYY-MM-DD` note containing the prior result, new result, and change that allowed the retest, verifying **AC-10**.
5. Artifact identity mismatch: detect a version or hash mismatch, stop, preserve the existing record, resolve the artifact or versioning discrepancy, and resume only after the recorded identity matches the files under test, verifying **AC-3**, **AC-11**, and **AC-14**.
6. Scope boundary: inspect the change and confirm it adds only the template and concise README and TODO workflow documentation, with no generated report, external workflow, runtime code change, or release directory evidence, verifying **AC-12** and **AC-14**.

## Build plan

The repository uses a Tracer Bullet approach. The first slice should make one complete manual path possible from the existing release command to a checked in evidence record. The second slice should make discovery and release checklist coverage explicit. No schema migration or runtime integration is needed.

1. [x] Add `docs/release-verification/template.md` using the fixed named Markdown shape in this spec. Include the version, two hashes, `YYYY-MM-DD` date, Desktop and Mobile fields, result, conditional notes, retest note, and optional limitations fields. State the exact smoke path and the hash mismatch stop rule, satisfying **AC-1**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, and **AC-11**.
2. [x] Add a concise README release verification section that explains when to run the workflow, how to use `npm run release:check`, where to copy the template, and that the record is manual evidence, satisfying **AC-2**, **AC-3**, **AC-12**, and **AC-14**.
3. [x] Update the existing release checklist in `TODO.md` so `npm ci` and `npm run release:check` construct the exact artifact before any publication step, then direct the maintainer to copy those unchanged files into both clean test vaults, complete the smoke path, create the version record, and check it in. Keep the checklist concise and preserve the distinction between `Pass`, `Fail`, and `Blocked`, satisfying **AC-2**, **AC-5**, **AC-6**, **AC-9**, **AC-12**, and **AC-13**.
4. [x] Perform the manual verification workflow for the release being delivered, or record an honest `Blocked` result where an environment is unavailable. Copy the exact files from the successful command output unchanged into the clean test vaults when testing is available, copy the template to the exact release version path, fill the hashes from that command output, check the identity before testing, and check in the completed record, satisfying every applicable criterion and confirming **AC-14**.

## Consequences

**Positive**:

1. Manual Desktop and Mobile evidence remains beside the repository decisions and can be reviewed later.
2. The evidence identifies the exact two installable files without requiring Git provenance fields.
3. Failure and environmental block results remain visible instead of being confused with missing work.
4. The workflow adds no runtime code, dependency, service, or artifact boundary complexity.

**Negative / tradeoffs**:

1. A maintainer must copy the version and hashes carefully from command output.
2. Markdown has no automatic field validation.
3. The record depends on honest manual installation and observation, so it does not replace a full product test suite or independently prove every possible device condition.

**Neutral**:

1. The same version record may change after a retest, with a short transition note preserving the reason.
2. Git tags and release provenance remain separate from this manual smoke evidence.
3. The ignored `release/` directory remains reserved for exactly `main.js` and `manifest.json`.

## Follow-up

1. Revisit the template only if a future release change or concrete regression requires additional smoke coverage.
