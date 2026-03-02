# Toolchain Matrix

This matrix defines the maintainer-supported quality-gate environments.

## Maintainer baseline

- Package manager: `pnpm 10.x`
- Nx: `22.x`
- uv setup in CI: `astral-sh/setup-uv@v4`

## Node.js compatibility matrix

The canonical quality gate (`pnpm quality:ci`) is validated in CI across:

- Node `20`
- Node `22`
- Node `24`

Coverage badge publication runs from the Node `22` job after matrix quality checks pass.

## Local troubleshooting guidance

When diagnosing gate failures, capture:

- `pnpm --version`
- `pnpm nx --version`
- `node -v`
- `pnpm quality:bootstrap`
