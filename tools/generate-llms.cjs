#!/usr/bin/env node
"use strict";

/* v8 ignore next -- runtime dependency wiring for direct CLI execution */
function resolveGenerateRunner() {
  require("@swc-node/register");
  const { runLlmsGenerateCli } = require("../src/tools/llms.ts");
  return runLlmsGenerateCli;
}

function runGenerateLlmsCli(
  args = process.argv.slice(2),
  runner = resolveGenerateRunner(),
) {
  try {
    return runner(args);
  } catch (error) {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
    return null;
  }
}

/* v8 ignore next -- only exercised when invoked directly as a CLI */
if (require.main === module) {
  runGenerateLlmsCli();
}

module.exports = { runGenerateLlmsCli };
