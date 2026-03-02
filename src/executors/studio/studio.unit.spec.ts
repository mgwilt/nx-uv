import { ExecutorContext } from "@nx/devkit";
import { describe, expect, it, vi } from "vitest";

const runNxUvTuiMock = vi.hoisted(() => vi.fn());

vi.mock("../../tui", () => ({
  runNxUvTui: runNxUvTuiMock,
}));

import executor from "./studio";

const context: ExecutorContext = {
  root: "/repo",
  cwd: "/repo",
  isVerbose: false,
  projectName: "root",
  projectGraph: {
    nodes: {},
    dependencies: {},
  },
  projectsConfigurations: {
    version: 2,
    projects: {},
  },
  nxJsonConfiguration: {},
};

describe("studio executor", () => {
  it("forwards options to runNxUvTui and returns success", async () => {
    runNxUvTuiMock.mockResolvedValue({ success: true });

    const result = await executor(
      {
        cwd: "packages/py",
        readonly: true,
        initialView: "tasks",
      },
      context,
    );

    expect(runNxUvTuiMock).toHaveBeenCalledWith({
      cwd: "packages/py",
      readonly: true,
      initialView: "tasks",
    });
    expect(result).toEqual({ success: true });
  });

  it("falls back to workspace root and dashboard defaults", async () => {
    runNxUvTuiMock.mockResolvedValue({ success: false });

    const result = await executor({}, context);

    expect(runNxUvTuiMock).toHaveBeenCalledWith({
      cwd: "/repo",
      readonly: false,
      initialView: "dashboard",
    });
    expect(result).toEqual({ success: false });
  });
});
