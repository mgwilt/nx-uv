#!/usr/bin/env node
"use strict";

/* v8 ignore next -- runtime dependency wiring for direct CLI execution */
function resolveBootstrapRunner() {
  require("@swc-node/register");
  const { runNxBootstrapCheckCli } = require("../src/tools/nx-bootstrap.ts");
  return runNxBootstrapCheckCli;
}

function runCheckNxBootstrapCli(
  args = process.argv.slice(2),
  runner = resolveBootstrapRunner(),
) {
  try {
    const result = runner(args);
    if (!result.ok) {
      process.exitCode = 1;
    }
    return result;
  } catch (error) {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
    return null;
  }
}

/* v8 ignore next -- only exercised when invoked directly as a CLI */
if (require.main === module) {
  runCheckNxBootstrapCli();
}

module.exports = { runCheckNxBootstrapCli };
