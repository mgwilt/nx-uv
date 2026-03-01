import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  calculateCoveragePercent,
  createCoverageBadgePayload,
  generateCoverageBadge,
  loadCoverageSummary,
  parseCoverageBadgeCliArgs,
  runCoverageBadgeCli,
  selectCoverageColor,
} from "./coverage-badge";

const tempRoots: string[] = [];

function createTempPath(relativePath: string): string {
  const root = mkdtempSync(join(tmpdir(), "nx-uv-coverage-badge-"));
  tempRoots.push(root);
  return join(root, relativePath);
}

function writeJsonFile(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("coverage badge helpers", () => {
  it("loads and validates coverage summary totals", () => {
    const summaryPath = createTempPath("coverage/coverage-summary.json");
    writeJsonFile(summaryPath, {
      total: {
        lines: { pct: 98.1 },
        functions: { pct: 97.5 },
        statements: { pct: 99.2 },
        branches: { pct: 94.9 },
      },
    });

    const summary = loadCoverageSummary(summaryPath);

    expect(summary.total.lines.pct).toBe(98.1);
    expect(summary.total.branches.pct).toBe(94.9);
  });

  it("calculates coverage using the worst top-level metric", () => {
    const coveragePercent = calculateCoveragePercent({
      total: {
        lines: { pct: 98.6 },
        functions: { pct: 97.2 },
        statements: { pct: 96.3 },
        branches: { pct: 90.34 },
      },
    });

    expect(coveragePercent).toBe(90.3);
  });

  it("maps coverage percentages to shields colors", () => {
    expect(selectCoverageColor(95)).toBe("brightgreen");
    expect(selectCoverageColor(90)).toBe("green");
    expect(selectCoverageColor(80)).toBe("yellowgreen");
    expect(selectCoverageColor(70)).toBe("yellow");
    expect(selectCoverageColor(60)).toBe("orange");
    expect(selectCoverageColor(59.9)).toBe("red");
  });

  it("creates badge payload and writes badge json output", () => {
    const summaryPath = createTempPath("coverage/coverage-summary.json");
    const outputPath = createTempPath(".github/badges/coverage.json");

    writeJsonFile(summaryPath, {
      total: {
        lines: { pct: 99.1 },
        functions: { pct: 96.7 },
        statements: { pct: 97.4 },
        branches: { pct: 94.12 },
      },
    });

    const payload = generateCoverageBadge(summaryPath, outputPath);
    const onDisk = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      label: string;
      message: string;
      color: string;
      schemaVersion: number;
    };

    expect(payload).toEqual(createCoverageBadgePayload(94.1));
    expect(onDisk).toMatchObject({
      schemaVersion: 1,
      label: "coverage",
      message: "94.1%",
      color: "green",
    });
  });

  it("parses default and explicit cli args", () => {
    expect(parseCoverageBadgeCliArgs([])).toEqual({
      summaryPath: "coverage/coverage-summary.json",
      outputPath: ".github/badges/coverage.json",
    });

    expect(
      parseCoverageBadgeCliArgs([
        "--summary",
        "tmp/summary.json",
        "--output",
        "tmp/coverage.json",
      ]),
    ).toEqual({
      summaryPath: "tmp/summary.json",
      outputPath: "tmp/coverage.json",
    });
  });

  it("throws for malformed summaries and unknown args", () => {
    const summaryPath = createTempPath("coverage/coverage-summary.json");
    writeJsonFile(summaryPath, {
      total: {
        lines: { pct: 99 },
      },
    });

    expect(() => loadCoverageSummary(summaryPath)).toThrow(
      "Coverage summary is missing a numeric total.functions.pct value.",
    );
    expect(() => parseCoverageBadgeCliArgs(["--bad-option"])).toThrow(
      "Unknown argument: --bad-option",
    );
    expect(() => parseCoverageBadgeCliArgs(["--summary"])).toThrow(
      "Missing value for --summary",
    );
    expect(() => parseCoverageBadgeCliArgs(["--output"])).toThrow(
      "Missing value for --output",
    );
  });

  it("runs the cli helper and returns generated payload", () => {
    const summaryPath = createTempPath("coverage/coverage-summary.json");
    const outputPath = createTempPath(".github/badges/coverage.json");

    writeJsonFile(summaryPath, {
      total: {
        lines: { pct: 96.1 },
        functions: { pct: 95.7 },
        statements: { pct: 97.4 },
        branches: { pct: 92.0 },
      },
    });

    const payload = runCoverageBadgeCli([
      "--summary",
      summaryPath,
      "--output",
      outputPath,
    ]);

    expect(payload).toEqual({
      schemaVersion: 1,
      label: "coverage",
      message: "92.0%",
      color: "green",
    });
  });
});
