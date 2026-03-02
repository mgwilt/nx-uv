import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatInvocation,
  isNxBootstrapFailure,
  runNxBootstrapCheck,
  runNxBootstrapCheckCli,
  runPnpmCommand,
} from "./nx-bootstrap";

const { runCheckNxBootstrapCli } =
  require("../../tools/check-nx-bootstrap.cjs") as {
    runCheckNxBootstrapCli: (
      args?: string[],
      runner?: (args: string[]) => { ok: boolean },
    ) => { ok: boolean } | null;
  };

type FakeSpawnResult = {
  status: number | null;
  stdout?: string;
  stderr?: string;
  error?: { message?: string };
};

type FakeSpawnRunner = (
  command: string,
  args: string[],
  options: { encoding: "utf-8"; env: NodeJS.ProcessEnv },
) => FakeSpawnResult;

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("nx-bootstrap helpers", () => {
  it("recognizes known bootstrap failure signatures", () => {
    expect(isNxBootstrapFailure("Failed to load 3 default Nx plugin(s)")).toBe(
      true,
    );
    expect(isNxBootstrapFailure("Failed to start plugin worker")).toBe(true);
    expect(isNxBootstrapFailure("ordinary command failure")).toBe(false);
  });

  it("formats invocations with pnpm prefix", () => {
    expect(formatInvocation(["nx", "show", "projects", "--json"])).toBe(
      "pnpm nx show projects --json",
    );
  });

  it("runs pnpm command with NX_DAEMON forced off and normalizes output", () => {
    const runner = vi.fn<FakeSpawnRunner>().mockImplementation(() => ({
      status: null,
      stdout: undefined,
      stderr: undefined,
      error: { message: "spawn failed" },
    }));

    const result = runPnpmCommand(["nx", "report"], runner, {
      PATH: process.env.PATH,
    });

    expect(result).toEqual({
      status: 1,
      stdout: "",
      stderr: "",
      error: "spawn failed",
    });

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0]?.[0]).toBe("pnpm");
    expect(runner.mock.calls[0]?.[1]).toEqual(["nx", "report"]);
    expect(runner.mock.calls[0]?.[2].env.NX_DAEMON).toBe("false");
  });
});

describe("runNxBootstrapCheck", () => {
  it("returns success when all probe commands pass", () => {
    const runner = vi.fn<FakeSpawnRunner>().mockImplementation(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));

    const stdoutSpy = vi.fn<(text: string) => void>();
    const stderrSpy = vi.fn<(text: string) => void>();

    const result = runNxBootstrapCheck({
      runner,
      writeStdout: stdoutSpy,
      writeStderr: stderrSpy,
      env: { PATH: process.env.PATH },
    });

    expect(result).toEqual({
      ok: true,
      bootstrapFailure: false,
      command: null,
    });
    expect(runner).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("reports bootstrap failures with fallback guidance", () => {
    const runner = vi
      .fn<FakeSpawnRunner>()
      .mockImplementationOnce(() => ({
        status: 0,
        stdout: "",
        stderr: "",
      }))
      .mockImplementationOnce(() => ({
        status: 1,
        stdout: "",
        stderr: "Failed to start plugin worker",
      }));

    const stderrSpy = vi.fn<(text: string) => void>();

    const result = runNxBootstrapCheck({
      runner,
      writeStdout: vi.fn(),
      writeStderr: stderrSpy,
      env: { PATH: process.env.PATH },
    });

    expect(result).toEqual({
      ok: false,
      bootstrapFailure: true,
      command: "pnpm nx show projects --json",
    });
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy.mock.calls[0]?.[0]).toContain("pnpm quality:fallback");
  });

  it("reports non-bootstrap command failures without fallback classification", () => {
    const runner = vi.fn<FakeSpawnRunner>().mockImplementation(() => ({
      status: 1,
      stdout: "",
      stderr: "Unknown Nx error",
    }));

    const stderrSpy = vi.fn<(text: string) => void>();

    const result = runNxBootstrapCheck({
      runner,
      writeStdout: vi.fn(),
      writeStderr: stderrSpy,
      env: { PATH: process.env.PATH },
    });

    expect(result).toEqual({
      ok: false,
      bootstrapFailure: false,
      command: "pnpm nx report",
    });
    expect(stderrSpy.mock.calls[0]?.[0]).toContain("Unknown Nx error");
  });
});

describe("nx-bootstrap CLI adapters", () => {
  it("rejects unknown cli args for the typed helper", () => {
    expect(() => runNxBootstrapCheckCli(["--bad-arg"])).toThrow(
      "Unknown argument: --bad-arg",
    );
  });

  it("sets process exit code in wrapper when checker result is not ok", () => {
    const runner = vi
      .fn<(args: string[]) => { ok: boolean }>()
      .mockReturnValue({
        ok: false,
      });

    const result = runCheckNxBootstrapCli([], runner);

    expect(result).toEqual({ ok: false });
    expect(process.exitCode).toBe(1);
  });

  it("handles thrown errors in wrapper", () => {
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const runner = vi.fn<(args: string[]) => { ok: boolean }>(() => {
      throw new Error("bootstrap wrapper failed");
    });

    const result = runCheckNxBootstrapCli([], runner);

    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(String(stderrSpy.mock.calls[0]?.[0])).toContain(
      "bootstrap wrapper failed",
    );
  });
});
