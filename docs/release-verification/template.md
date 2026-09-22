# Release verification: <version>

Verification date: YYYY-MM-DD
Release version: <version>
main.js SHA-256: <lowercase hash from npm run release:check>
manifest.json SHA-256: <lowercase hash from npm run release:check>

Use the exact `release/main.js` and `release/manifest.json` produced by the successful `npm run release:check` run. Copy those files unchanged into each clean test vault. If either recorded hash differs from the files under test, stop and resolve the artifact or versioning discrepancy before creating or updating evidence.

## Desktop

Obsidian version: <version>
Operating system or device: <value>
Clean vault setup: <brief note>
Smoke result: Pass | Fail | Blocked
Notes: <required for Fail or Blocked, name the affected smoke action>
Retest note: <optional YYYY-MM-DD note with prior result, new result, and what changed>

Smoke path:

1. Enable the plugin.
2. Create a shortcut.
3. Open the shortcut and verify the target opens.
4. Rename or move the target.
5. Verify the shortcut still resolves to the moved or renamed target.

## Mobile

Obsidian version: <version>
Operating system or device: <value>
Clean vault setup: <brief note>
Smoke result: Pass | Fail | Blocked
Notes: <required for Fail or Blocked, name the affected smoke action>
Retest note: <optional YYYY-MM-DD note with prior result, new result, and what changed>

Smoke path:

1. Enable the plugin.
2. Create a shortcut.
3. Open the shortcut and verify the target opens.
4. Rename or move the target.
5. Verify the shortcut still resolves to the moved or renamed target.

## Limitations

<optional shared caveat>
