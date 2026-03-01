#!/usr/bin/env node
"use strict";

require("@swc-node/register");

const { runLlmsCheckCli } = require("../src/tools/llms.ts");

try {
  const result = runLlmsCheckCli(process.argv.slice(2));
  if (!result.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error?.stack ?? String(error)}\n`);
  process.exitCode = 1;
}
