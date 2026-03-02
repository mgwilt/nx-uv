import * as React from "react";
import { render } from "ink";
import { NxUvApp } from "./app";
import { TuiLaunchOptions } from "./types";

export type { TuiLaunchOptions, TuiView } from "./types";

export async function runNxUvTui(
  options: TuiLaunchOptions = {},
): Promise<{ success: boolean }> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write(
      "nx-uv studio requires an interactive terminal (TTY).\n",
    );
    return { success: false };
  }

  return new Promise<{ success: boolean }>((resolve) => {
    const instance = render(
      React.createElement(NxUvApp, {
        options,
        onComplete: (success: boolean) => {
          instance.unmount();
          resolve({ success });
        },
      }),
    );
  });
}
