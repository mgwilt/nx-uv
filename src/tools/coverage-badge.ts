import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface CoverageMetricSummary {
  pct: number;
}

export interface CoverageSummary {
  total: {
    lines: CoverageMetricSummary;
    functions: CoverageMetricSummary;
    statements: CoverageMetricSummary;
    branches: CoverageMetricSummary;
  };
}

export interface ShieldsBadgePayload {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

export interface CoverageBadgeCliOptions {
  summaryPath: string;
  outputPath: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertMetric(
  metric: unknown,
  label: string,
): asserts metric is CoverageMetricSummary {
  if (
    !isRecord(metric) ||
    typeof metric.pct !== "number" ||
    Number.isNaN(metric.pct)
  ) {
    throw new Error(
      `Coverage summary is missing a numeric ${label}.pct value.`,
    );
  }
}

export function loadCoverageSummary(summaryPath: string): CoverageSummary {
  const raw = readFileSync(summaryPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  if (!isRecord(parsed) || !isRecord(parsed.total)) {
    throw new Error('Coverage summary must include a "total" object.');
  }

  const totals = parsed.total;
  assertMetric(totals.lines, "total.lines");
  assertMetric(totals.functions, "total.functions");
  assertMetric(totals.statements, "total.statements");
  assertMetric(totals.branches, "total.branches");

  return {
    total: {
      lines: { pct: totals.lines.pct },
      functions: { pct: totals.functions.pct },
      statements: { pct: totals.statements.pct },
      branches: { pct: totals.branches.pct },
    },
  };
}

export function calculateCoveragePercent(summary: CoverageSummary): number {
  const percentages = [
    summary.total.lines.pct,
    summary.total.functions.pct,
    summary.total.statements.pct,
    summary.total.branches.pct,
  ];

  const worstMetric = Math.min(...percentages);
  return Math.round(worstMetric * 10) / 10;
}

export function selectCoverageColor(coveragePercent: number): string {
  if (coveragePercent >= 95) {
    return "brightgreen";
  }

  if (coveragePercent >= 90) {
    return "green";
  }

  if (coveragePercent >= 80) {
    return "yellowgreen";
  }

  if (coveragePercent >= 70) {
    return "yellow";
  }

  if (coveragePercent >= 60) {
    return "orange";
  }

  return "red";
}

export function createCoverageBadgePayload(
  coveragePercent: number,
): ShieldsBadgePayload {
  return {
    schemaVersion: 1,
    label: "coverage",
    message: `${coveragePercent.toFixed(1)}%`,
    color: selectCoverageColor(coveragePercent),
  };
}

export function writeCoverageBadge(
  outputPath: string,
  payload: ShieldsBadgePayload,
): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

export function generateCoverageBadge(
  summaryPath: string,
  outputPath: string,
): ShieldsBadgePayload {
  const summary = loadCoverageSummary(summaryPath);
  const coveragePercent = calculateCoveragePercent(summary);
  const payload = createCoverageBadgePayload(coveragePercent);

  writeCoverageBadge(outputPath, payload);

  return payload;
}

export function parseCoverageBadgeCliArgs(
  args: string[],
): CoverageBadgeCliOptions {
  let summaryPath = "coverage/coverage-summary.json";
  let outputPath = ".github/badges/coverage.json";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--summary") {
      if (!next) {
        throw new Error("Missing value for --summary");
      }
      summaryPath = next;
      index += 1;
      continue;
    }

    if (arg === "--output") {
      if (!next) {
        throw new Error("Missing value for --output");
      }
      outputPath = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    summaryPath,
    outputPath,
  };
}

export function runCoverageBadgeCli(args: string[]): ShieldsBadgePayload {
  const options = parseCoverageBadgeCliArgs(args);
  const payload = generateCoverageBadge(
    resolve(options.summaryPath),
    resolve(options.outputPath),
  );

  // Keep output minimal so CI logs stay compact.
  process.stdout.write(`coverage badge: ${payload.message}\n`);

  return payload;
}

/* c8 ignore start */
if (require.main === module) {
  runCoverageBadgeCli(process.argv.slice(2));
}
/* c8 ignore stop */
