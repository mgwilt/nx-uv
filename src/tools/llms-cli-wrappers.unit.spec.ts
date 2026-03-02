import { afterEach, describe, expect, it, vi } from "vitest";

const { runCheckLlmsCli } = require("../../tools/check-llms.cjs") as {
  runCheckLlmsCli: (
    args?: string[],
    runner?: (args: string[]) => { ok: boolean; driftedFiles: string[] },
  ) => { ok: boolean; driftedFiles: string[] } | null;
};

const { runGenerateLlmsCli } = require("../../tools/generate-llms.cjs") as {
  runGenerateLlmsCli: (
    args?: string[],
    runner?: (args: string[]) => unknown,
  ) => unknown;
};

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("llms cli wrapper scripts", () => {
  it("returns success result for check wrapper", () => {
    const runner = vi
      .fn<(args: string[]) => { ok: boolean; driftedFiles: string[] }>()
      .mockReturnValue({
        ok: true,
        driftedFiles: [],
      });

    const result = runCheckLlmsCli(["--repo-root", "tmp"], runner);

    expect(runner).toHaveBeenCalledWith(["--repo-root", "tmp"]);
    expect(result).toEqual({
      ok: true,
      driftedFiles: [],
    });
    expect(process.exitCode).toBeUndefined();
  });

  it("sets non-zero exit code when check wrapper reports drift", () => {
    const runner = vi
      .fn<(args: string[]) => { ok: boolean; driftedFiles: string[] }>()
      .mockReturnValue({
        ok: false,
        driftedFiles: ["llms.txt"],
      });

    const result = runCheckLlmsCli([], runner);

    expect(result).toEqual({
      ok: false,
      driftedFiles: ["llms.txt"],
    });
    expect(process.exitCode).toBe(1);
  });

  it("handles thrown errors in check wrapper", () => {
    const runner = vi.fn<
      (args: string[]) => { ok: boolean; driftedFiles: string[] }
    >(() => {
      throw new Error("check failed");
    });
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const result = runCheckLlmsCli([], runner);

    expect(result).toBeNull();
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(String(stderrSpy.mock.calls[0]?.[0])).toContain("check failed");
    expect(process.exitCode).toBe(1);
  });

  it("returns runner output for generate wrapper", () => {
    const runner =
      vi.fn<(args: string[]) => { llms: string; llmsFull: string }>();
    runner.mockReturnValue({
      llms: "content",
      llmsFull: "full-content",
    });

    const result = runGenerateLlmsCli(["--repo-root", "tmp"], runner);

    expect(runner).toHaveBeenCalledWith(["--repo-root", "tmp"]);
    expect(result).toEqual({
      llms: "content",
      llmsFull: "full-content",
    });
    expect(process.exitCode).toBeUndefined();
  });

  it("handles thrown errors in generate wrapper", () => {
    const runner = vi.fn<(args: string[]) => unknown>(() => {
      throw new Error("generate failed");
    });
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const result = runGenerateLlmsCli([], runner);

    expect(result).toBeNull();
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(String(stderrSpy.mock.calls[0]?.[0])).toContain("generate failed");
    expect(process.exitCode).toBe(1);
  });
});
