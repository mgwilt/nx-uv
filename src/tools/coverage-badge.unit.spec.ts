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
  calculateCoverageMetricPercent,
  calculateCoveragePercent,
  createCoverageBadgeArtifacts,
  createCoverageBadgePayload,
  generateCoverageBadges,
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

  it("calculates per-metric and floor percentages", () => {
    const summary = {
      total: {
        lines: { pct: 98.6 },
        functions: { pct: 97.2 },
        statements: { pct: 96.3 },
        branches: { pct: 90.34 },
      },
    };

    expect(calculateCoverageMetricPercent(summary, "lines")).toBe(98.6);
    expect(calculateCoverageMetricPercent(summary, "branches")).toBe(90.3);
    expect(calculateCoveragePercent(summary)).toBe(90.3);
  });

  it("maps coverage percentages to shields colors", () => {
    expect(selectCoverageColor(95)).toBe("brightgreen");
    expect(selectCoverageColor(90)).toBe("green");
    expect(selectCoverageColor(80)).toBe("yellowgreen");
    expect(selectCoverageColor(70)).toBe("yellow");
    expect(selectCoverageColor(60)).toBe("orange");
    expect(selectCoverageColor(59.9)).toBe("red");
  });

  it("creates coverage artifacts with metric and floor payloads", () => {
    const artifacts = createCoverageBadgeArtifacts({
      total: {
        lines: { pct: 99.1 },
        functions: { pct: 96.7 },
        statements: { pct: 97.4 },
        branches: { pct: 94.12 },
      },
    });

    expect(artifacts).toHaveLength(5);
    expect(
      artifacts.find((artifact) => artifact.fileName === "coverage-floor.json"),
    ).toEqual({
      fileName: "coverage-floor.json",
      payload: createCoverageBadgePayload(94.1, "coverage floor"),
    });
  });

  it("writes metric badges, floor badge, and a legacy alias", () => {
    const summaryPath = createTempPath("coverage/coverage-summary.json");
    const outputDir = createTempPath(".github/badges");
    const legacyOutputPath = createTempPath(".github/badges/coverage.json");

    writeJsonFile(summaryPath, {
      total: {
        lines: { pct: 99.1 },
        functions: { pct: 96.7 },
        statements: { pct: 97.4 },
        branches: { pct: 94.12 },
      },
    });

    const artifacts = generateCoverageBadges(
      summaryPath,
      outputDir,
      legacyOutputPath,
    );

    expect(artifacts).toHaveLength(5);

    const expectedFiles = [
      "coverage-lines.json",
      "coverage-functions.json",
      "coverage-statements.json",
      "coverage-branches.json",
      "coverage-floor.json",
      "coverage.json",
    ];

    for (const fileName of expectedFiles) {
      const filePath =
        fileName === "coverage.json"
          ? legacyOutputPath
          : join(outputDir, fileName);
      const onDisk = JSON.parse(readFileSync(filePath, "utf-8")) as {
        label: string;
        message: string;
        color: string;
        schemaVersion: number;
      };

      expect(onDisk.schemaVersion).toBe(1);
      expect(onDisk.message).toMatch(/^\d+\.\d%$/);
      expect(typeof onDisk.label).toBe("string");
      expect(typeof onDisk.color).toBe("string");
    }

    const floor = JSON.parse(
      readFileSync(join(outputDir, "coverage-floor.json"), "utf-8"),
    ) as {
      label: string;
      message: string;
      color: string;
      schemaVersion: number;
    };
    const legacy = JSON.parse(readFileSync(legacyOutputPath, "utf-8")) as {
      label: string;
      message: string;
      color: string;
      schemaVersion: number;
    };

    expect(legacy).toEqual(floor);
    expect(floor).toMatchObject({
      label: "coverage floor",
      message: "94.1%",
      color: "green",
    });
  });

  it("parses default and explicit cli args", () => {
    expect(parseCoverageBadgeCliArgs([])).toEqual({
      summaryPath: "coverage/coverage-summary.json",
      outputDir: ".github/badges",
      legacyOutputPath: ".github/badges/coverage.json",
    });

    expect(
      parseCoverageBadgeCliArgs([
        "--summary",
        "tmp/summary.json",
        "--output-dir",
        "tmp/badges",
        "--legacy-output",
        "tmp/custom-coverage.json",
      ]),
    ).toEqual({
      summaryPath: "tmp/summary.json",
      outputDir: "tmp/badges",
      legacyOutputPath: "tmp/custom-coverage.json",
    });

    expect(
      parseCoverageBadgeCliArgs([
        "--summary",
        "tmp/summary.json",
        "--output",
        "tmp/legacy/coverage.json",
      ]),
    ).toEqual({
      summaryPath: "tmp/summary.json",
      outputDir: "tmp/legacy",
      legacyOutputPath: "tmp/legacy/coverage.json",
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
    expect(() => parseCoverageBadgeCliArgs(["--output-dir"])).toThrow(
      "Missing value for --output-dir",
    );
    expect(() => parseCoverageBadgeCliArgs(["--legacy-output"])).toThrow(
      "Missing value for --legacy-output",
    );
  });

  it("runs the cli helper and returns generated artifacts", () => {
    const summaryPath = createTempPath("coverage/coverage-summary.json");
    const outputDir = createTempPath(".github/badges");
    const legacyOutputPath = createTempPath(".github/badges/coverage.json");

    writeJsonFile(summaryPath, {
      total: {
        lines: { pct: 96.1 },
        functions: { pct: 95.7 },
        statements: { pct: 97.4 },
        branches: { pct: 92.0 },
      },
    });

    const artifacts = runCoverageBadgeCli([
      "--summary",
      summaryPath,
      "--output-dir",
      outputDir,
      "--legacy-output",
      legacyOutputPath,
    ]);

    expect(artifacts).toHaveLength(5);

    const floor = artifacts.find(
      (artifact) => artifact.fileName === "coverage-floor.json",
    );
    expect(floor?.payload).toEqual({
      schemaVersion: 1,
      label: "coverage floor",
      message: "92.0%",
      color: "green",
    });
  });
});
