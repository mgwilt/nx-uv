#!/usr/bin/env node
"use strict";

require("@swc-node/register");

const { runLlmsGenerateCli } = require("../src/tools/llms.ts");

try {
  runLlmsGenerateCli(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error?.stack ?? String(error)}\n`);
  process.exitCode = 1;
}
