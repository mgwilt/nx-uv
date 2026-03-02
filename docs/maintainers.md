# Maintainer Guide

This document covers repository operations and internal workflows. End-user usage stays in [`../README.md`](../README.md).

## Local commands

- Build plugin:
  - `pnpm build`
- Regenerate samples:
  - `pnpm samples:generate`
- Regenerate LLM context files:
  - `pnpm llms:generate`
- Check LLM context drift:
  - `pnpm llms:check`
- Lint:
  - `pnpm lint`
- Typecheck:
  - `pnpm typecheck`
- Run tests:
  - `pnpm test:unit`
  - `pnpm test:integration`
  - `pnpm test:e2e`
  - `pnpm test:coverage`

## Quality gates

- Nx bootstrap health check:
  - `pnpm quality:bootstrap`
- Local fast gate:
  - `pnpm quality:local`
- Full strict gate:
  - `pnpm quality:ci`
- Fallback direct gate (when Nx bootstrap fails):
  - `pnpm quality:fallback`

Troubleshooting when Nx plugin bootstrap fails before tasks execute:

- `pnpm quality:bootstrap`
- `pnpm nx reset`
- `pnpm quality:ci`

Fallback direct checks (to isolate Nx bootstrap issues from plugin logic):

- `pnpm quality:fallback`
- This command intentionally bypasses Nx graph construction and runs eslint/tsc/vitest directly.

Capture diagnostics for issue reports:

- `pnpm --version`
- `pnpm nx --version`
- `node -v`
- `pnpm quality:bootstrap`

E2E note:

- `e2e/project-executor.e2e.spec.ts` now probes whether local executable shims can run.
- In restricted environments (`EPERM`/`EACCES` spawn failures), the e2e cases are skipped with a warning instead of producing misleading assertion failures.
- In CI, if executable shim probing fails and all e2e assertions would be skipped, the suite fails by default.
- Set `NX_UV_ALLOW_E2E_ALL_SKIPPED=1` only for known restricted CI environments where executable process shims are not permitted.

Coverage thresholds enforced in `vitest.coverage.config.mts`:

- Lines: `95`
- Functions: `95`
- Statements: `95`
- Branches: `90`

## Git hooks

[Lefthook](https://lefthook.dev/) is auto-installed via `prepare`.

- [`pre-commit`](https://pre-commit.com/) runs:
  - format check
  - lint
  - typecheck
  - unit tests
  - integration tests
- `commit-msg` runs:
  - [Commitlint](https://commitlint.js.org/) on the current commit message
- `pre-push` runs:
  - full `quality:ci`

## CI workflows

- `ci.yml`
  - Pull requests: affected checks on Node `20`, `22`, and `24`
  - Push to `main`: full quality gate on Node `20`, `22`, and `24` + coverage badge publish from Node `22`
- `nightly.yml`
  - Scheduled full quality validation on Node `20`, `22`, and `24`
- `samples.yml`
  - Regenerates `samples/` and fails on drift for generator-related PRs/pushes
- `llms.yml`
  - Validates `llms.txt` and `llms-full.txt` drift for docs/automation-related PRs/pushes
- `release.yml`
  - Manual prerelease flow (`beta` channel)
- `commitlint.yml`
  - [Conventional Commits](https://www.conventionalcommits.org/) message validation for PRs

Additional references:

- Toolchain policy: [`toolchain-matrix.md`](toolchain-matrix.md)
- Bootstrap incident runbook: [`runbooks/gate-bootstrap-failure.md`](runbooks/gate-bootstrap-failure.md)

## Coverage badge pipeline

1. `test:coverage` writes `coverage/coverage-summary.json`.
2. `coverage:badge` generates `.github/badges/coverage.json`.
3. CI publishes badge content to the `badges` branch.
4. README coverage badge reads from:
   - `https://raw.githubusercontent.com/mgwilt/nx-uv/badges/.github/badges/coverage.json`

## Release process (pre-v1)

The project currently ships prereleases to [npm](https://www.npmjs.com/).

- Version bump (preid):
  - `pnpm release:version`
- Publish with prerelease dist-tag:
  - `pnpm release:publish`

Current release policy:

- [npm](https://www.npmjs.com/) dist-tag: `beta`
- Stable `latest` should not be the default path until v1 planning changes.

## llms automation

The repository tracks LLM context artifacts in version control:

- `llms.txt`
- `llms-full.txt`

They are generated from `tools/llms-sources.json` using:

- `pnpm llms:generate`

Drift is enforced by:

- `pnpm llms:check` in `quality-local` and `quality-ci`
- pre-push hook (via `quality-ci`)
- `.github/workflows/llms.yml`
