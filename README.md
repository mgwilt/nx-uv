# @mgwilt/nx-uv

[Nx](https://nx.dev/) plugin for running [uv](https://docs.astral.sh/uv/) workflows in [Nx](https://nx.dev/) monorepos.

[![CI](https://github.com/mgwilt/nx-uv/actions/workflows/ci.yml/badge.svg)](https://github.com/mgwilt/nx-uv/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/mgwilt/nx-uv/badges/.github/badges/coverage.json)](https://github.com/mgwilt/nx-uv/blob/badges/.github/badges/coverage.json)
[![npm beta](https://img.shields.io/npm/v/%40mgwilt%2Fnx-uv/beta?label=npm%20beta&cacheSeconds=300)](https://www.npmjs.com/package/@mgwilt/nx-uv?activeTab=versions)

## When to use this plugin

- Run [uv](https://docs.astral.sh/uv/) commands through [Nx](https://nx.dev/) targets instead of ad-hoc shell scripts.
- Infer useful [uv](https://docs.astral.sh/uv/) targets from existing `pyproject.toml` files.
- Scaffold [uv](https://docs.astral.sh/uv/)-ready [Python](https://www.python.org/) projects and workspace config.
- Keep [Python](https://www.python.org/) work in the same task graph, caching, and CI flow as the rest of your monorepo.

## Tools

- Executors for [uv](https://docs.astral.sh/uv/) command families:
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
- [Nx](https://nx.dev/) plugin inference (`createNodesV2`) for `pyproject.toml`.

## Install

Prerequisites:

- [Nx](https://nx.dev/) workspace
- [uv](https://docs.astral.sh/uv/) installed and available on `PATH`

Install the plugin:

```bash
pnpm add -D @mgwilt/nx-uv
```

## Brand new monorepo example

This walkthrough creates a new [Nx](https://nx.dev/) monorepo and uses this plugin to scaffold a working [uv](https://docs.astral.sh/uv/) + [Python](https://www.python.org/) example.

1. Create a new workspace:

```bash
pnpm create nx-workspace@latest acme-monorepo --preset=ts --packageManager=pnpm --nxCloud=skip --interactive=false
cd acme-monorepo
```

2. Install this plugin (beta channel) and initialize workspace-level [uv](https://docs.astral.sh/uv/) config:

```bash
pnpm add -D @mgwilt/nx-uv@beta
pnpm nx g @mgwilt/nx-uv:workspace --name=acme --membersGlob=packages/py/*
```

3. Generate a [Python](https://www.python.org/) app and scaffold integrations:

```bash
pnpm nx g @mgwilt/nx-uv:project api --projectType=app --directory=packages/py
pnpm nx g @mgwilt/nx-uv:integration --template=fastapi --project=api
pnpm nx g @mgwilt/nx-uv:integration --template=github
```

Expected file tree (key files) after step 3:

```text
acme-monorepo/
├── nx.json
├── package.json
├── pyproject.toml
├── .github/
│   └── workflows/
│       └── uv-ci.yml
└── packages/
    └── py/
        └── api/
            ├── README.md
            ├── pyproject.toml
            ├── main.py
            ├── Dockerfile.fastapi
            ├── src/
            │   └── api/
            │       ├── __init__.py
            │       └── main.py
            └── tests/
                └── test_smoke.py
```

4. Add runtime and dev dependencies with [uv](https://docs.astral.sh/uv/):

```bash
cd packages/py/api
uv add fastapi uvicorn
uv add --dev pytest ruff
cd ../../..
```

5. Run plugin-backed targets via [Nx](https://nx.dev/):

```bash
pnpm nx run api:sync
pnpm nx run api:uv
pnpm nx run api:run
pnpm nx run api:test
pnpm nx run api:build
```

At this point you have a working monorepo with:

- Root `pyproject.toml` and [uv](https://docs.astral.sh/uv/) workspace members
- A generated `api` [Python](https://www.python.org/) project under `packages/py/api`
- Generated [FastAPI](https://fastapi.tiangolo.com/) starter files and a [GitHub Actions](https://github.com/features/actions) uv workflow template
- [Nx](https://nx.dev/) targets that run uv commands consistently in CI/local dev

## Quick start (existing workspace)

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

2. (Optional, recommended for new repos) Initialize [uv](https://docs.astral.sh/uv/) workspace config:

```bash
pnpm nx g @mgwilt/nx-uv:workspace --name=acme
```

3. Generate a [Python](https://www.python.org/) project wired for [uv](https://docs.astral.sh/uv/) + [Nx](https://nx.dev/):

```bash
pnpm nx g @mgwilt/nx-uv:project services/api --projectType=app
```

4. Run [uv](https://docs.astral.sh/uv/)-backed targets:

```bash
pnpm nx run api:sync
pnpm nx run api:test
pnpm nx run api:build
```

## Existing [Python](https://www.python.org/) projects

If your repo already has `pyproject.toml` files, the plugin can infer targets (for example `uv:sync`, `uv:run`, `uv:test`) based on your configured `targetPrefix` and inference preset.

## Integration templates

Use integration templates to scaffold common [uv](https://docs.astral.sh/uv/) ecosystem files for CI, containers, dependency automation, and notebook workflows.

### How file output location works

- `--project=<name>` sets `<baseDir>` to that [Nx](https://nx.dev/) project's root.
- `--directory=<path>` sets `<baseDir>` to that directory relative to workspace root.
- If neither is set, `<baseDir>` defaults to workspace root (`.`).
- Workspace-level templates always write to repo root, even if `--project` or `--directory` is provided.
- Workspace-level templates are:
  - `github`
  - `gitlab`
  - `dependency-bots`
  - `pre-commit`

### Template matrix

| Template              | Scope          | Files generated                                     | Best for                                                                                                                                                   |
| --------------------- | -------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alternative-indexes` | `baseDir`      | `<baseDir>/uv.indexes.toml.snippet`                 | Defining custom/internal [Python](https://www.python.org/) indexes                                                                                         |
| `aws-lambda`          | `baseDir`      | `<baseDir>/Dockerfile.lambda`                       | Packaging [uv](https://docs.astral.sh/uv/)-based [AWS Lambda](https://aws.amazon.com/lambda/) workloads                                                    |
| `coiled`              | `baseDir`      | `<baseDir>/scripts/coiled-example.py`               | Starting distributed [Python](https://www.python.org/) experiments with [Coiled](https://coiled.io/)                                                       |
| `dependency-bots`     | workspace root | `renovate.json`, `.github/dependabot.yml`           | Automated dependency update workflows with [Renovate](https://docs.renovatebot.com/) and [Dependabot](https://docs.github.com/en/code-security/dependabot) |
| `docker`              | `baseDir`      | `<baseDir>/Dockerfile`                              | Containerizing a [uv](https://docs.astral.sh/uv/) project with [Docker](https://www.docker.com/)                                                           |
| `fastapi`             | `baseDir`      | `<baseDir>/main.py`, `<baseDir>/Dockerfile.fastapi` | Bootstrapping a [FastAPI](https://fastapi.tiangolo.com/) service with [uv](https://docs.astral.sh/uv/)                                                     |
| `github`              | workspace root | `.github/workflows/uv-ci.yml`                       | [GitHub Actions](https://github.com/features/actions) [uv](https://docs.astral.sh/uv/) CI starter pipeline                                                 |
| `gitlab`              | workspace root | `.gitlab-ci.uv.yml`                                 | [GitLab CI/CD](https://docs.gitlab.com/ee/ci/) [uv](https://docs.astral.sh/uv/) starter pipeline                                                           |
| `jupyter`             | `baseDir`      | `<baseDir>/scripts/setup-jupyter-kernel.sh`         | Registering a [uv](https://docs.astral.sh/uv/)-managed [Jupyter](https://jupyter.org/) kernel                                                              |
| `marimo`              | `baseDir`      | `<baseDir>/notebooks/example.marimo.py`             | Starting [marimo](https://marimo.io/) notebook workflows                                                                                                   |
| `pre-commit`          | workspace root | `.pre-commit-config.yaml`                           | Local code quality hooks for [uv](https://docs.astral.sh/uv/) projects using [pre-commit](https://pre-commit.com/)                                         |
| `pytorch`             | `baseDir`      | `<baseDir>/uv.pytorch.toml.snippet`                 | Configuring [PyTorch](https://pytorch.org/) index/source snippets                                                                                          |

### Command examples for all templates

```bash
pnpm nx g @mgwilt/nx-uv:integration --template=alternative-indexes --project=api
pnpm nx g @mgwilt/nx-uv:integration --template=aws-lambda --project=api
pnpm nx g @mgwilt/nx-uv:integration --template=coiled --project=api
pnpm nx g @mgwilt/nx-uv:integration --template=dependency-bots
pnpm nx g @mgwilt/nx-uv:integration --template=docker --project=api
pnpm nx g @mgwilt/nx-uv:integration --template=fastapi --project=api
pnpm nx g @mgwilt/nx-uv:integration --template=github
pnpm nx g @mgwilt/nx-uv:integration --template=gitlab
pnpm nx g @mgwilt/nx-uv:integration --template=jupyter --project=api
pnpm nx g @mgwilt/nx-uv:integration --template=marimo --project=api
pnpm nx g @mgwilt/nx-uv:integration --template=pre-commit
pnpm nx g @mgwilt/nx-uv:integration --template=pytorch --project=api
```

### Common options

- `--overwrite=true` replaces existing files instead of skipping them.
- `--directory=<path>` writes baseDir-aware templates into a non-project directory.
- `--skipFormat=true` skips formatter execution after generation.
- Prefer `--project` for app/lib scaffolds and no location flag for workspace-level templates.

### Notes and pitfalls

- Templates are starter scaffolds; you should review and harden generated files for production use.
- Running the same template multiple times without `--overwrite=true` leaves existing files unchanged.
- Workspace-level templates are intentionally global and may affect repository-wide automation.

## Compatibility and versioning

- Runtime [uv](https://docs.astral.sh/uv/) compatibility check targets `uv 0.9.x` by default.
- This package is pre-v1 and published on the [npm](https://www.npmjs.com/) `beta` dist-tag.

## Additional docs

- [Documentation index](docs/index.md)
- [Maintainer guide (quality gates, CI, release)](docs/maintainers.md)
- [Sample scaffolding patterns](samples/README.md)
