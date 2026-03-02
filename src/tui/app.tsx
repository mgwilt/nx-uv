import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ActionForm, FormFieldDefinition } from "./components/action-form";
import {
  actionIsMutating,
  planConvertGenerator,
  planInferencePatch,
  planIntegrationGenerator,
  planProjectGenerator,
  planRunTarget,
  planRunUv,
  planWorkspaceGenerator,
} from "./services/action-planner";
import { buildPreview, applyAction } from "./services/preview";
import { discoverWorkspace } from "./services/workspace-scanner";
import {
  ActionPreview,
  ApplyResult,
  PlannedAction,
  TuiLaunchOptions,
  TuiView,
  WorkspaceSnapshot,
} from "./types";
import {
  INTEGRATION_TEMPLATES,
  PYTORCH_BACKENDS,
} from "../generators/integration/templates";

export function NxUvApp(props: {
  options: TuiLaunchOptions;
  onComplete: (success: boolean) => void;
}) {
  const { options, onComplete } = props;
  const { exit } = useApp();
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [workspaceMissing, setWorkspaceMissing] = useState(false);
  const [screen, setScreen] = useState<TuiView | "preview" | "result">(
    options.initialView ?? "dashboard",
  );
  const [returnView, setReturnView] = useState<TuiView>(
    options.initialView ?? "dashboard",
  );
  const [pendingAction, setPendingAction] = useState<PlannedAction | null>(
    null,
  );
  const [preview, setPreview] = useState<ActionPreview | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cwd = options.cwd ?? process.cwd();
    const nextSnapshot = discoverWorkspace(cwd);
    if (!nextSnapshot) {
      setWorkspaceMissing(true);
      setSnapshot(null);
      return;
    }

    setWorkspaceMissing(false);
    setSnapshot(nextSnapshot);
  }, [options.cwd]);

  const dashboardItems = useMemo(
    () => [
      { label: "Setup workspace", action: () => setScreen("workspace") },
      {
        label: "Create app/package/script",
        action: () => setScreen("project"),
      },
      {
        label: "Apply integration template",
        action: () => setScreen("integration"),
      },
      {
        label: "Convert existing projects",
        action: () => setScreen("convert"),
      },
      { label: "Configure inference", action: () => setScreen("inference") },
      { label: "Run Nx target", action: () => setScreen("tasks") },
      { label: "Run uv command", action: () => setScreen("uv") },
      {
        label: "Refresh workspace scan",
        action: () => {
          const cwd = options.cwd ?? process.cwd();
          const nextSnapshot = discoverWorkspace(cwd);
          setSnapshot(nextSnapshot);
          setWorkspaceMissing(!nextSnapshot);
          setError(null);
        },
      },
      {
        label: "Exit",
        action: () => {
          onComplete(true);
          exit();
        },
      },
    ],
    [exit, onComplete, options.cwd],
  );

  if (workspaceMissing) {
    return (
      <MissingWorkspaceScreen
        onExit={() => {
          onComplete(false);
          exit();
        }}
      />
    );
  }

  if (!snapshot) {
    return (
      <Box>
        <Text>Scanning workspace...</Text>
      </Box>
    );
  }

  const handlePlan = (view: TuiView, action: PlannedAction) => {
    try {
      setError(null);
      const nextPreview = buildPreview(action);
      setReturnView(view);
      setPendingAction(action);
      setPreview(nextPreview);
      setScreen("preview");
    } catch (planError) {
      setError(
        planError instanceof Error ? planError.message : String(planError),
      );
    }
  };

  const refreshSnapshot = () => {
    const cwd = options.cwd ?? process.cwd();
    const nextSnapshot = discoverWorkspace(cwd);
    setSnapshot(nextSnapshot);
    setWorkspaceMissing(!nextSnapshot);
  };

  const renderScreen = () => {
    if (screen === "dashboard") {
      return (
        <DashboardScreen
          snapshot={snapshot}
          items={dashboardItems}
          error={error}
        />
      );
    }

    if (screen === "workspace") {
      return (
        <ActionForm
          title="Workspace setup"
          description="Configure root pyproject workspace settings and plugin defaults."
          fields={workspaceFields(snapshot)}
          onCancel={() => setScreen("dashboard")}
          onSubmit={(values) =>
            handlePlan(
              "workspace",
              planWorkspaceGenerator(snapshot.workspaceRoot, values),
            )
          }
        />
      );
    }

    if (screen === "project") {
      return (
        <ActionForm
          title="Project generator"
          description="Create Python apps, libraries, or scripts with nx-uv targets."
          fields={projectFields()}
          onCancel={() => setScreen("dashboard")}
          onSubmit={(values) =>
            handlePlan(
              "project",
              planProjectGenerator(snapshot.workspaceRoot, values),
            )
          }
        />
      );
    }

    if (screen === "integration") {
      return (
        <ActionForm
          title="Integration generator"
          description="Scaffold CI, Docker, notebooks, and dependency automation templates."
          fields={integrationFields(snapshot)}
          onCancel={() => setScreen("dashboard")}
          onSubmit={(values) =>
            handlePlan(
              "integration",
              planIntegrationGenerator(snapshot.workspaceRoot, values),
            )
          }
        />
      );
    }

    if (screen === "convert") {
      return (
        <ActionForm
          title="Convert generator"
          description="Attach default nx-uv targets to existing Python projects."
          fields={convertFields()}
          onCancel={() => setScreen("dashboard")}
          onSubmit={(values) =>
            handlePlan(
              "convert",
              planConvertGenerator(snapshot.workspaceRoot, values),
            )
          }
        />
      );
    }

    if (screen === "inference") {
      return (
        <ActionForm
          title="Inference settings"
          description="Patch nx.json plugin options including inferred target overrides."
          fields={inferenceFields(snapshot)}
          onCancel={() => setScreen("dashboard")}
          onSubmit={(values) =>
            handlePlan(
              "inference",
              planInferencePatch(snapshot.workspaceRoot, values),
            )
          }
        />
      );
    }

    if (screen === "tasks") {
      return (
        <ActionForm
          title="Run Nx target"
          description="Execute any project:target[:configuration] with optional additional args."
          fields={targetFields(snapshot)}
          submitLabel="Run"
          onCancel={() => setScreen("dashboard")}
          onSubmit={(values) =>
            handlePlan("tasks", planRunTarget(snapshot.workspaceRoot, values))
          }
        />
      );
    }

    if (screen === "uv") {
      return (
        <ActionForm
          title="Run uv command"
          description="Run arbitrary uv args (example: cache size, run -- pytest -q)."
          fields={uvFields()}
          submitLabel="Run"
          onCancel={() => setScreen("dashboard")}
          onSubmit={(values) =>
            handlePlan("uv", planRunUv(snapshot.workspaceRoot, values))
          }
        />
      );
    }

    if (screen === "preview") {
      return (
        <PreviewScreen
          action={pendingAction}
          preview={preview}
          readonly={options.readonly ?? false}
          onBack={() => {
            setScreen(returnView);
          }}
          onApply={() => {
            if (!pendingAction) {
              return;
            }

            if (
              (options.readonly ?? false) &&
              actionIsMutating(pendingAction)
            ) {
              setError(
                "Readonly mode is enabled. Mutating actions cannot be applied.",
              );
              return;
            }

            const apply = applyAction(pendingAction);
            setResult(apply);
            setScreen("result");
            refreshSnapshot();
          }}
        />
      );
    }

    return (
      <ResultScreen
        result={result}
        onDashboard={() => {
          setResult(null);
          setPendingAction(null);
          setPreview(null);
          setScreen("dashboard");
        }}
        onExit={() => {
          onComplete(Boolean(result?.success));
          exit();
        }}
      />
    );
  };

  return (
    <Box flexDirection="column">
      <Header snapshot={snapshot} readonly={options.readonly ?? false} />
      <Box marginTop={1}>{renderScreen()}</Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function Header(props: { snapshot: WorkspaceSnapshot; readonly: boolean }) {
  const { snapshot, readonly } = props;
  return (
    <Box flexDirection="column">
      <Text bold>nx-uv studio</Text>
      <Text>
        workspace: {snapshot.workspaceRoot} | uv:{" "}
        {snapshot.uvVersion ?? "not found"} | projects:{" "}
        {snapshot.projects.length}
        {readonly ? " | readonly" : ""}
      </Text>
    </Box>
  );
}

function MissingWorkspaceScreen(props: { onExit: () => void }) {
  const { onExit } = props;

  useInput((input: string) => {
    if (input.toLowerCase() === "q") {
      onExit();
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="red">No Nx workspace found from the current directory.</Text>
      <Text>
        Run this command from a repo that contains nx.json, then try again.
      </Text>
      <Text>Press q to exit.</Text>
    </Box>
  );
}

function DashboardScreen(props: {
  snapshot: WorkspaceSnapshot;
  items: Array<{ label: string; action: () => void }>;
  error: string | null;
}) {
  const { snapshot, items, error } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput(
    (
      input: string,
      key: { upArrow?: boolean; downArrow?: boolean; return?: boolean },
    ) => {
      if (key.upArrow) {
        setSelectedIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedIndex((current) => Math.min(items.length - 1, current + 1));
        return;
      }

      if (key.return) {
        items[selectedIndex]?.action();
        return;
      }

      if (input.toLowerCase() === "q") {
        items[items.length - 1]?.action();
      }
    },
  );

  return (
    <Box flexDirection="column">
      <Text bold>Dashboard</Text>
      <Text>
        plugin configured: {snapshot.pluginConfigured ? "yes" : "no"} | root
        pyproject: {snapshot.hasRootPyproject ? "yes" : "no"} | uv workspace
        table: {snapshot.hasUvWorkspaceTable ? "yes" : "no"}
      </Text>
      <Text>Use arrows + Enter. Press q to exit.</Text>
      <Box marginTop={1} flexDirection="column">
        {items.map((item, index) => (
          <Text
            key={item.label}
            color={index === selectedIndex ? "cyan" : undefined}
          >
            {index === selectedIndex ? "> " : "  "}
            {item.label}
          </Text>
        ))}
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function PreviewScreen(props: {
  action: PlannedAction | null;
  preview: ActionPreview | null;
  readonly: boolean;
  onApply: () => void;
  onBack: () => void;
}) {
  const { action, preview, readonly, onApply, onBack } = props;

  useInput((input: string, key: { escape?: boolean; return?: boolean }) => {
    if (input.toLowerCase() === "b" || key.escape) {
      onBack();
      return;
    }

    if (key.return || input.toLowerCase() === "a") {
      onApply();
    }
  });

  if (!action || !preview) {
    return (
      <Box>
        <Text color="red">No preview is available.</Text>
      </Box>
    );
  }

  const canApply = !(readonly && actionIsMutating(action));

  return (
    <Box flexDirection="column">
      <Text bold>{action.title}</Text>
      <Text>{preview.summary}</Text>
      <Text>Command preview:</Text>
      {preview.commands.map((line) => (
        <Text key={line}> {line}</Text>
      ))}
      <Text>Detected file changes: {preview.fileChanges.length}</Text>
      {preview.fileChanges.slice(0, 20).map((entry) => (
        <Text key={`${entry.operation}-${entry.path}`}>
          {entry.operation} {entry.path}
        </Text>
      ))}
      {preview.stdout ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold>stdout</Text>
          <Text>{truncate(preview.stdout)}</Text>
        </Box>
      ) : null}
      {preview.stderr ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">
            stderr
          </Text>
          <Text color="yellow">{truncate(preview.stderr)}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text>
          Press Enter/a to {canApply ? "apply" : "run non-mutating preview"}, b
          or Esc to go back.
        </Text>
      </Box>
      {!canApply ? (
        <Text color="yellow">
          Readonly mode blocks apply for mutating actions.
        </Text>
      ) : null}
    </Box>
  );
}

function ResultScreen(props: {
  result: ApplyResult | null;
  onDashboard: () => void;
  onExit: () => void;
}) {
  const { result, onDashboard, onExit } = props;

  useInput((input: string, key: { escape?: boolean }) => {
    if (input.toLowerCase() === "b" || key.escape) {
      onDashboard();
      return;
    }

    if (input.toLowerCase() === "q") {
      onExit();
    }
  });

  if (!result) {
    return (
      <Box>
        <Text color="red">No result to display.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color={result.success ? "green" : "red"}>
        {result.success ? "Success" : "Failed"}
      </Text>
      <Text>{result.summary}</Text>
      {result.stdout ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold>stdout</Text>
          <Text>{truncate(result.stdout)}</Text>
        </Box>
      ) : null}
      {result.stderr ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">
            stderr
          </Text>
          <Text color="yellow">{truncate(result.stderr)}</Text>
        </Box>
      ) : null}
      <Text>Press b to return to dashboard, q to exit.</Text>
    </Box>
  );
}

function workspaceFields(snapshot: WorkspaceSnapshot): FormFieldDefinition[] {
  return [
    {
      key: "name",
      label: "workspaceName",
      type: "text",
      defaultValue: "",
      placeholder: "optional",
    },
    {
      key: "membersGlob",
      label: "membersGlob",
      type: "text",
      defaultValue: "packages/py/*",
      required: true,
    },
    {
      key: "exclude",
      label: "exclude (csv)",
      type: "text",
      defaultValue: "",
      placeholder: "optional",
    },
    {
      key: "targetPrefix",
      label: "targetPrefix",
      type: "text",
      defaultValue: snapshot.pluginOptions.targetPrefix ?? "uv:",
      required: true,
    },
    {
      key: "inferencePreset",
      label: "inferencePreset",
      type: "select",
      options: ["minimal", "standard", "full"],
      defaultValue: snapshot.pluginOptions.inferencePreset ?? "standard",
    },
    {
      key: "includeGlobalTargets",
      label: "includeGlobalTargets",
      type: "boolean",
      defaultValue: snapshot.pluginOptions.includeGlobalTargets ?? false,
    },
    {
      key: "skipFormat",
      label: "skipFormat",
      type: "boolean",
      defaultValue: false,
    },
  ];
}

function projectFields(): FormFieldDefinition[] {
  return [
    {
      key: "name",
      label: "name",
      type: "text",
      required: true,
      defaultValue: "",
      placeholder: "services/api",
    },
    {
      key: "directory",
      label: "directory",
      type: "text",
      defaultValue: "packages/py",
    },
    {
      key: "moduleName",
      label: "moduleName",
      type: "text",
      defaultValue: "",
      placeholder: "optional",
    },
    {
      key: "projectType",
      label: "projectType",
      type: "select",
      options: ["app", "lib", "script"],
      defaultValue: "lib",
    },
    {
      key: "withTests",
      label: "withTests",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "workspaceMember",
      label: "workspaceMember",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "tags",
      label: "tags (csv)",
      type: "text",
      defaultValue: "",
      placeholder: "optional",
    },
    {
      key: "skipFormat",
      label: "skipFormat",
      type: "boolean",
      defaultValue: false,
    },
  ];
}

function integrationFields(snapshot: WorkspaceSnapshot): FormFieldDefinition[] {
  const pythonProjects = snapshot.projects
    .filter((project) => project.hasPyproject)
    .map((project) => project.name);

  return [
    {
      key: "template",
      label: "template",
      type: "select",
      options: [...INTEGRATION_TEMPLATES],
      defaultValue: "fastapi",
      required: true,
    },
    pythonProjects.length > 0
      ? {
          key: "project",
          label: "project",
          type: "select" as const,
          options: ["", ...pythonProjects],
          defaultValue: "",
        }
      : {
          key: "project",
          label: "project",
          type: "text" as const,
          defaultValue: "",
          placeholder: "optional",
        },
    {
      key: "directory",
      label: "directory",
      type: "text",
      defaultValue: "",
      placeholder: "optional",
    },
    {
      key: "backend",
      label: "backend (pytorch)",
      type: "select",
      options: ["", ...PYTORCH_BACKENDS],
      defaultValue: "",
    },
    {
      key: "includeNotebook",
      label: "includeNotebook (pytorch)",
      type: "select",
      options: ["", "true", "false"],
      defaultValue: "",
    },
    {
      key: "includeDocker",
      label: "includeDocker (pytorch)",
      type: "select",
      options: ["", "true", "false"],
      defaultValue: "",
    },
    {
      key: "overwrite",
      label: "overwrite",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "skipFormat",
      label: "skipFormat",
      type: "boolean",
      defaultValue: false,
    },
  ];
}

function convertFields(): FormFieldDefinition[] {
  return [
    {
      key: "project",
      label: "project",
      type: "text",
      defaultValue: "",
      placeholder: "optional (all projects when empty)",
    },
    {
      key: "skipFormat",
      label: "skipFormat",
      type: "boolean",
      defaultValue: false,
    },
  ];
}

function inferenceFields(snapshot: WorkspaceSnapshot): FormFieldDefinition[] {
  return [
    {
      key: "targetPrefix",
      label: "targetPrefix",
      type: "text",
      defaultValue: snapshot.pluginOptions.targetPrefix ?? "uv:",
      required: true,
    },
    {
      key: "inferencePreset",
      label: "inferencePreset",
      type: "select",
      options: ["minimal", "standard", "full"],
      defaultValue: snapshot.pluginOptions.inferencePreset ?? "standard",
    },
    {
      key: "includeGlobalTargets",
      label: "includeGlobalTargets",
      type: "boolean",
      defaultValue: snapshot.pluginOptions.includeGlobalTargets ?? false,
    },
    {
      key: "inferredTargetsJson",
      label: "inferredTargets JSON",
      type: "text",
      defaultValue: "",
      placeholder: "optional object",
    },
  ];
}

function targetFields(snapshot: WorkspaceSnapshot): FormFieldDefinition[] {
  const projectNames = snapshot.projects.map((project) => project.name);

  const projectField: FormFieldDefinition =
    projectNames.length > 0
      ? {
          key: "project",
          label: "project",
          type: "select",
          options: projectNames,
          defaultValue: projectNames[0],
          required: true,
        }
      : {
          key: "project",
          label: "project",
          type: "text",
          defaultValue: "",
          required: true,
        };

  return [
    projectField,
    {
      key: "target",
      label: "target",
      type: "text",
      defaultValue: "test",
      required: true,
    },
    {
      key: "configuration",
      label: "configuration",
      type: "text",
      defaultValue: "",
      placeholder: "optional",
    },
    {
      key: "args",
      label: "extra args",
      type: "text",
      defaultValue: "",
      placeholder: "optional",
    },
  ];
}

function uvFields(): FormFieldDefinition[] {
  return [
    {
      key: "args",
      label: "uv args",
      type: "text",
      defaultValue: "",
      required: true,
      placeholder: "cache size",
    },
    {
      key: "cwd",
      label: "cwd",
      type: "text",
      defaultValue: "",
      placeholder: "optional (workspace root when empty)",
    },
  ];
}

function truncate(value: string): string {
  const maxLength = 4000;
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...<truncated>`;
}
