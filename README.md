# @mgwilt/nx-uv

Nx plugin for integrating [uv](https://docs.astral.sh/uv/) workflows into an Nx monorepo.

[![CI](https://github.com/mgwilt/nx-uv/actions/workflows/ci.yml/badge.svg)](https://github.com/mgwilt/nx-uv/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/mgwilt/nx-uv/badges/.github/badges/coverage.json)](https://github.com/mgwilt/nx-uv/blob/badges/.github/badges/coverage.json)
[![npm beta](https://img.shields.io/npm/v/@mgwilt/nx-uv/beta?label=npm%20beta)](https://www.npmjs.com/package/@mgwilt/nx-uv?activeTab=versions)

## Coverage model

The plugin uses a hybrid model:

- Typed executor families for major uv command groups
- Universal executor fallback for complete command passthrough
- Inferred targets via Nx plugin `createNodesV2` from `pyproject.toml`
- Explicit generators for workspace/project scaffolding, conversion, migration, and integrations

## Executors

- `@mgwilt/nx-uv:uv` universal uv passthrough
- `@mgwilt/nx-uv:project` top-level project flows (`run`, `sync`, `lock`, `build`, etc.)
- `@mgwilt/nx-uv:pip` pip interface subcommands
- `@mgwilt/nx-uv:tool` tool management subcommands
- `@mgwilt/nx-uv:python` Python management subcommands
- `@mgwilt/nx-uv:auth` auth subcommands
- `@mgwilt/nx-uv:cache` cache subcommands
- `@mgwilt/nx-uv:self` self-management subcommands

## Generators

- `@mgwilt/nx-uv:workspace` configure root uv workspace + Nx inference plugin options
- `@mgwilt/nx-uv:project` generate Python app/lib/script projects with uv targets
- `@mgwilt/nx-uv:convert` convert existing projects to redesigned executors/targets
- `@mgwilt/nx-uv:integration` scaffold integration templates

## Inference plugin

Add plugin entry in `nx.json`:

```json
{
  "plugins": [
    {
      "plugin": "@mgwilt/nx-uv",
      "options": {
        "targetPrefix": "uv:",
        "inferencePreset": "standard",
        "includeGlobalTargets": false
      }
    }
  ]
}
```

Inferred projects are discovered via `**/pyproject.toml`.

## Integration templates

`integration` generator templates:

- `alternative-indexes`
- `aws-lambda`
- `coiled`
- `dependency-bots`
- `docker`
- `fastapi`
- `github`
- `gitlab`
- `jupyter`
- `marimo`
- `pre-commit`
- `pytorch`

## uv compatibility

The executor runtime enforces uv `0.9.x` by default. Set `skipVersionCheck=true` to bypass.

## Quality gates

- `pnpm quality:local` runs format check, lint, typecheck, and unit/integration tests.
- `pnpm quality:ci` runs the full strict gate: format check, lint, typecheck, unit/integration/e2e tests, coverage thresholds, and build.
- Coverage thresholds are enforced at: lines `95`, functions `95`, statements `95`, branches `90`.
- Coverage badge JSON is generated from `coverage/coverage-summary.json` and written to `.github/badges/coverage.json`.

## Hooks

- Lefthook is installed via `prepare` (`pnpm install` auto-installs hooks).
- `pre-commit` enforces format, lint, typecheck, unit, and integration tests.
- `pre-push` enforces the full `quality:ci` gate.

## CI model

- Pull requests run `nx affected` checks using base/head SHAs.
- Pushes to `main` run full quality gates and update the coverage badge on the `badges` branch.
- Nightly workflow runs full quality gates for drift detection.

## Release channel

Automated releases are published as npm prereleases using the `beta` dist-tag.
