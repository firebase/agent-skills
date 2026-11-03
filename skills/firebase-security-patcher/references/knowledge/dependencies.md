# Vulnerable Dependency Remediation

## Strategy

1. Confirm the finding with `firebase-dependency-scan` (`scan_deps.mjs`).

1. Choose the **smallest upgrade** that reaches a fixed version (`fixedIn`).
   Prefer patch/minor bumps; flag major bumps to the user.

1. Direct dependency: `npm install <pkg>@<fixed>` (or `yarn add`, `pnpm add`,
   `pip install "<pkg>>=<fixed>"` + update pins, `go get <mod>@v<fixed>`,
   `flutter pub upgrade <pkg>`).

1. Transitive dependency: upgrade the parent if a fixed parent exists; otherwise
   pin via overrides:

   ```json
   // package.json (npm)
   { "overrides": { "vulnerable-pkg": "^1.2.5" } }
   // yarn
   { "resolutions": { "vulnerable-pkg": "^1.2.5" } }
   // pnpm
   { "pnpm": { "overrides": { "vulnerable-pkg": "^1.2.5" } } }
   ```

1. Cloud Functions have a separate `functions/package.json` - fix both.

1. No fix available: remove/replace the package, or document the mitigation and
   add an `[[IgnoredVulns]]` entry in `osv-scanner.toml` with a reason.

## Verify

1. `npm ci` (or equivalent) succeeds.
1. Build and tests pass (`npm run build`, `npm test`).
1. Re-run `scan_deps.mjs`: the advisory ID is gone.
1. For framework upgrades (e.g. `next`), smoke-test the app locally
   (`npm run dev`) and through the emulators.
