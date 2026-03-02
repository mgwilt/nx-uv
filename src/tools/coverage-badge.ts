import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const COVERAGE_METRIC_SPECS = [
  {
    key: "lines",
    label: "coverage lines",
    fileName: "coverage-lines.json",
  },
  {
    key: "functions",
    label: "coverage functions",
    fileName: "coverage-functions.json",
  },
  {
    key: "statements",
    label: "coverage statements",
    fileName: "coverage-statements.json",
  },
  {
    key: "branches",
    label: "coverage branches",
    fileName: "coverage-branches.json",
  },
] as const;

export type CoverageMetricKey = (typeof COVERAGE_METRIC_SPECS)[number]["key"];

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

export interface CoverageBadgeArtifact {
  fileName: string;
  payload: ShieldsBadgePayload;
}

export interface CoverageBadgeCliOptions {
  summaryPath: string;
  outputDir: string;
  legacyOutputPath: string;
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
  label = "coverage",
): ShieldsBadgePayload {
  return {
    schemaVersion: 1,
    label,
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

export function calculateCoverageMetricPercent(
  summary: CoverageSummary,
  metric: CoverageMetricKey,
): number {
  return Math.round(summary.total[metric].pct * 10) / 10;
}

export function createCoverageBadgeArtifacts(
  summary: CoverageSummary,
): CoverageBadgeArtifact[] {
  const metricArtifacts: CoverageBadgeArtifact[] = COVERAGE_METRIC_SPECS.map(
    (spec) => {
      const coveragePercent = calculateCoverageMetricPercent(summary, spec.key);
      return {
        fileName: spec.fileName,
        payload: createCoverageBadgePayload(coveragePercent, spec.label),
      };
    },
  );

  const floorPercent = calculateCoveragePercent(summary);
  const floorPayload = createCoverageBadgePayload(
    floorPercent,
    "coverage floor",
  );

  return [
    ...metricArtifacts,
    {
      fileName: "coverage-floor.json",
      payload: floorPayload,
    },
  ];
}

export function writeCoverageBadgeArtifacts(
  outputDir: string,
  artifacts: CoverageBadgeArtifact[],
  legacyOutputPath: string,
): void {
  const floorArtifact = artifacts.find(
    (artifact) => artifact.fileName === "coverage-floor.json",
  );

  if (!floorArtifact) {
    throw new Error("Coverage floor artifact was not generated.");
  }

  for (const artifact of artifacts) {
    writeCoverageBadge(resolve(outputDir, artifact.fileName), artifact.payload);
  }

  // Keep a compatibility alias for existing references.
  writeCoverageBadge(legacyOutputPath, floorArtifact.payload);
}

export function generateCoverageBadges(
  summaryPath: string,
  outputDir: string,
  legacyOutputPath: string,
): CoverageBadgeArtifact[] {
  const summary = loadCoverageSummary(summaryPath);
  const artifacts = createCoverageBadgeArtifacts(summary);
  writeCoverageBadgeArtifacts(outputDir, artifacts, legacyOutputPath);

  return artifacts;
}

export function parseCoverageBadgeCliArgs(
  args: string[],
): CoverageBadgeCliOptions {
  let summaryPath = "coverage/coverage-summary.json";
  let outputDir = ".github/badges";
  let legacyOutputPath = ".github/badges/coverage.json";
  let outputDirExplicitlySet = false;

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

    if (arg === "--output-dir") {
      if (!next) {
        throw new Error("Missing value for --output-dir");
      }
      outputDir = next;
      outputDirExplicitlySet = true;
      index += 1;
      continue;
    }

    if (arg === "--legacy-output") {
      if (!next) {
        throw new Error(`Missing value for ${arg}`);
      }
      legacyOutputPath = next;
      index += 1;
      continue;
    }

    if (arg === "--output") {
      if (!next) {
        throw new Error("Missing value for --output");
      }
      legacyOutputPath = next;
      if (!outputDirExplicitlySet) {
        outputDir = dirname(next);
      }
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    summaryPath,
    outputDir,
    legacyOutputPath,
  };
}

export function runCoverageBadgeCli(args: string[]): CoverageBadgeArtifact[] {
  const options = parseCoverageBadgeCliArgs(args);
  const artifacts = generateCoverageBadges(
    resolve(options.summaryPath),
    resolve(options.outputDir),
    resolve(options.legacyOutputPath),
  );

  const summaryText = artifacts
    .map((artifact) => `${artifact.fileName}=${artifact.payload.message}`)
    .join(", ");
  process.stdout.write(`coverage badges: ${summaryText}\n`);

  return artifacts;
}

/* c8 ignore start */
if (require.main === module) {
  runCoverageBadgeCli(process.argv.slice(2));
}
/* c8 ignore stop */
