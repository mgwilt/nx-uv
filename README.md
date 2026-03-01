# @mgwilt/nx-uv

Nx plugin for integrating [uv](https://docs.astral.sh/uv/) workflows into an Nx monorepo.

## Executors

- `@mgwilt/nx-uv:sync` runs `uv sync`
- `@mgwilt/nx-uv:run` runs `uv run`
- `@mgwilt/nx-uv:add` runs `uv add`

## Generator

- `@mgwilt/nx-uv:python-package`
  - Creates a Python package in `packages/py/<name>` by default.
  - Generates `pyproject.toml`, `src/<module>/__init__.py`, and optional tests.
  - Adds Nx targets: `sync`, `add`, `run`, `test`, `lint`.

## Local Usage

```bash
pnpm nx g @mgwilt/nx-uv:python-package shared
pnpm nx run shared:sync
pnpm nx run shared:test
```
