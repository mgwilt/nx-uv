# Runbook: Gate Failed Before Tasks Started

Use this runbook when `quality:ci` fails before lint/typecheck/tests begin, typically with Nx plugin worker or graph-bootstrap errors.

## Symptoms

- `pnpm quality:ci` exits before project tasks start.
- Logs contain signatures like:
  - `Failed to load ... default Nx plugin(s)`
  - `Failed to start plugin worker`
  - `Unable to complete project graph creation`

## Triage steps

1. Validate bootstrap health.

```bash
pnpm quality:bootstrap
```

2. Reset Nx state and retry strict gate.

```bash
pnpm nx reset
pnpm quality:ci
```

3. If bootstrap still fails, run fallback checks to isolate plugin logic from Nx bootstrap.

```bash
pnpm quality:fallback
```

## Evidence to capture for incidents

Collect these command results in issue reports:

```bash
pnpm --version
pnpm nx --version
node -v
pnpm quality:bootstrap
```

If fallback checks pass but bootstrap fails, classify as infrastructure/toolchain incident (not immediate plugin logic regression).

## Escalation criteria

Escalate immediately when:

- `quality:bootstrap` fails in CI matrix nodes (`20`, `22`, and `24`).
- Multiple contributors reproduce bootstrap failures on the same commit.
- Fallback checks pass but strict gate blocks release/tag workflows.
