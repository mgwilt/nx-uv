# @mgwilt/nx-uv

Nx plugin for running [uv](https://docs.astral.sh/uv/) workflows in Nx monorepos.

[![CI](https://github.com/mgwilt/nx-uv/actions/workflows/ci.yml/badge.svg)](https://github.com/mgwilt/nx-uv/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/mgwilt/nx-uv/badges/.github/badges/coverage.json)](https://github.com/mgwilt/nx-uv/blob/badges/.github/badges/coverage.json)
[![npm beta](https://img.shields.io/npm/v/%40mgwilt%2Fnx-uv/beta?label=npm%20beta&cacheSeconds=300)](https://www.npmjs.com/package/@mgwilt/nx-uv?activeTab=versions)

## When to use this plugin

- Run uv commands through Nx targets instead of ad-hoc shell scripts.
- Infer useful uv targets from existing `pyproject.toml` files.
- Scaffold uv-ready Python projects and workspace config.
- Keep Python work in the same task graph, caching, and CI flow as the rest of your monorepo.

## Tools

- Executors for uv command families:
  - `@mgwilt/nx-uv:project`
  - `@mgwilt/nx-uv:uv`
  - `@mgwilt/nx-uv:pip`
  - `@mgwilt/nx-uv:tool`
  - `@mgwilt/nx-uv:python`
  - `@mgwilt/nx-uv:auth`
  - `@mgwilt/nx-uv:cache`
  - `@mgwilt/nx-uv:self`
- Generators:
  - `@mgwilt/nx-uv:workspace`
  - `@mgwilt/nx-uv:project`
  - `@mgwilt/nx-uv:integration`
  - `@mgwilt/nx-uv:convert`
- Nx plugin inference (`createNodesV2`) for `pyproject.toml`.

## Install

Prerequisites:

- Nx workspace
- `uv` installed and available on `PATH`

Install the plugin:

```bash
pnpm add -D @mgwilt/nx-uv
```

## Quick start

1. Add the plugin to `nx.json`:

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

2. (Optional, recommended for new repos) Initialize uv workspace config:

```bash
pnpm nx g @mgwilt/nx-uv:workspace --name=acme
```

3. Generate a Python project wired for uv + Nx:

```bash
pnpm nx g @mgwilt/nx-uv:project services/api --projectType=app
```

4. Run uv-backed targets:

```bash
pnpm nx run api:sync
pnpm nx run api:test
pnpm nx run api:build
```

## Existing Python projects

If your repo already has `pyproject.toml` files, the plugin can infer targets (for example `uv:sync`, `uv:run`, `uv:test`) based on your configured `targetPrefix` and inference preset.

## Integration templates

Use the integration generator to scaffold common uv integration files:

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

Example:

```bash
pnpm nx g @mgwilt/nx-uv:integration --template=docker --project=api
```

## Compatibility and versioning

- Runtime uv compatibility check targets `uv 0.9.x` by default.
- This package is pre-v1 and published on the npm `beta` dist-tag.

## Additional docs

- [Documentation index](docs/index.md)
- [Maintainer guide (quality gates, CI, release)](docs/maintainers.md)
