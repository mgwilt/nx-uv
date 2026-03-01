# @mgwilt/nx-uv

Nx plugin for integrating [uv](https://docs.astral.sh/uv/) workflows into an Nx monorepo.

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

## Release channel

Automated releases are published as npm prereleases using the `beta` dist-tag.
