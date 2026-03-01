#!/usr/bin/env bash
set -euo pipefail
uv add --dev ipykernel
uv run -- python -m ipykernel install --user --name uv-kernel
