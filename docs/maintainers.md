# Maintainer Guide

This document covers repository operations and internal workflows. End-user usage stays in [`../README.md`](../README.md).

## Local commands

- Build plugin:
  - `pnpm build`
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

- Local fast gate:
  - `pnpm quality:local`
- Full strict gate:
  - `pnpm quality:ci`

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
- `pre-push` runs:
  - full `quality:ci`

## CI workflows

- `ci.yml`
  - Pull requests: affected checks
  - Push to `main`: full quality gate + coverage badge publish
- `nightly.yml`
  - Scheduled full quality validation
- `release.yml`
  - Manual prerelease flow (`beta` channel)
- `commitlint.yml`
  - [Conventional Commits](https://www.conventionalcommits.org/) message validation for PRs

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
