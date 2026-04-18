import { ipcMain, screen, type BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import type {
  AppWindowBounds,
  AppWindowIgnoreMouseRequest,
  AppWindowOpacityRequest,
  AppWindowPosition,
  AppWindowState,
} from "../../shared/types/ipc";
import {
  clampWindowOpacity,
  getSavedWindowOpacity,
  persistWindowOpacity,
} from "../window-opacity";
import { getWindowActionTarget } from "../window-action-targets";
import { getSenderWindow } from "./ipc-utils";

export const registerWindowHandlers = (window: BrowserWindow) => {
  const getDirectSenderWindow = (
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  ) => getSenderWindow(event.sender) ?? window;
  const getTargetWindow = (
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  ) => getWindowActionTarget(getSenderWindow(event.sender)) ?? window;
  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
  const isValidWindowPosition = (
    payload: AppWindowPosition | null | undefined,
  ): payload is AppWindowPosition =>
    payload != null &&
    isFiniteNumber(payload.x) &&
    isFiniteNumber(payload.y);
  const dipToScreenPoint = (point: AppWindowPosition) =>
    process.platform === "win32" || process.platform === "linux"
      ? screen.dipToScreenPoint(point)
      : point;
  const screenToDipPoint = (point: AppWindowPosition) =>
    process.platform === "win32" || process.platform === "linux"
      ? screen.screenToDipPoint(point)
      : point;
  const getWindowHandleValue = (targetWindow: BrowserWindow) => {
    const handle = targetWindow.getNativeWindowHandle();
    if (handle.byteLength >= 8) {
      return handle.readBigUInt64LE(0);
    }
    if (handle.byteLength >= 4) {
      return BigInt(handle.readUInt32LE(0));
    }
    return null;
  };
  const beginWindowsNativeMove = (targetWindow: BrowserWindow) => {
    if (process.platform !== "win32") {
      return false;
    }

    const handleValue = getWindowHandleValue(targetWindow);
    if (handleValue === null || handleValue === 0n) {
      return false;
    }

    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class CanvasToolWindowMove {
  [DllImport("user32.dll")]
  public static extern bool ReleaseCapture();

  [DllImport("user32.dll")]
  public static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
}
"@;
[CanvasToolWindowMove]::ReleaseCapture() | Out-Null;
[CanvasToolWindowMove]::SendMessage([IntPtr]::new([Int64]${handleValue.toString()}), 0x112, [IntPtr]::new(0xF012), [IntPtr]::Zero) | Out-Null;
`.trim();

    const encodedScript = Buffer.from(script, "utf16le").toString("base64");

    try {
      const child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-WindowStyle",
          "Hidden",
          "-EncodedCommand",
          encodedScript,
        ],
        {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        },
      );
      child.unref();
      return true;
    } catch {
      return false;
    }
  };

  ipcMain.handle("window:set-title", (event, payload: AppWindowState) => {
    const safeTitle = payload.fileName
      ? `CanvasTool - ${payload.fileName}`
      : `CanvasTool - ${payload.title}`;

    getTargetWindow(event)?.setTitle(safeTitle);
  });

  ipcMain.handle("window:focus", (event) => {
    const targetWindow = getTargetWindow(event);
    if (!targetWindow.isVisible()) {
      targetWindow.show();
    }
    targetWindow.moveTop();
    targetWindow.focus();
  });

  ipcMain.handle("window:minimize", (event) => {
    getTargetWindow(event)?.minimize();
  });

  ipcMain.handle("window:toggle-always-on-top", (event) => {
    const targetWindow = getTargetWindow(event);
    const nextState = !targetWindow.isAlwaysOnTop();
    targetWindow.setAlwaysOnTop(nextState);

    return {
      isMaximized: targetWindow.isMaximized(),
      isAlwaysOnTop: targetWindow.isAlwaysOnTop(),
    };
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const targetWindow = getTargetWindow(event);
    if (targetWindow.isMaximized()) {
      targetWindow.unmaximize();
    } else {
      targetWindow.maximize();
    }

    return {
      isMaximized: targetWindow.isMaximized(),
      isAlwaysOnTop: targetWindow.isAlwaysOnTop(),
    };
  });

  ipcMain.handle("window:close", (event) => {
    getTargetWindow(event)?.close();
  });

  ipcMain.handle("window:get-controls-state", (event) => ({
    isMaximized: getTargetWindow(event).isMaximized(),
    isAlwaysOnTop: getTargetWindow(event).isAlwaysOnTop(),
  }));

  ipcMain.on("window:get-cursor-screen-point-sync", (event) => {
    const { x, y } = screen.getCursorScreenPoint();
    event.returnValue = { x, y } satisfies AppWindowPosition;
  });

  ipcMain.on("window:get-cursor-screen-physical-point-sync", (event) => {
    const cursorPoint = screen.getCursorScreenPoint();
    const { x, y } = dipToScreenPoint(cursorPoint);
    event.returnValue = { x, y } satisfies AppWindowPosition;
  });

  ipcMain.on("window:dip-to-screen-point-sync", (event, payload: AppWindowPosition) => {
    if (!isValidWindowPosition(payload)) {
      event.returnValue = { x: 0, y: 0 } satisfies AppWindowPosition;
      return;
    }

    const { x, y } = dipToScreenPoint(payload);
    event.returnValue = { x, y } satisfies AppWindowPosition;
  });

  ipcMain.on("window:screen-to-dip-point-sync", (event, payload: AppWindowPosition) => {
    if (!isValidWindowPosition(payload)) {
      event.returnValue = { x: 0, y: 0 } satisfies AppWindowPosition;
      return;
    }

    const { x, y } = screenToDipPoint(payload);
    event.returnValue = { x, y } satisfies AppWindowPosition;
  });

  ipcMain.on("window:begin-native-move-sync", (event) => {
    const targetWindow = getTargetWindow(event);
    event.returnValue = beginWindowsNativeMove(targetWindow);
  });

  ipcMain.handle("window:get-position", (event): AppWindowPosition => {
    const targetWindow = getTargetWindow(event);
    const [x, y] = targetWindow.getPosition();
    return { x, y };
  });

  ipcMain.on("window:get-position-sync", (event) => {
    const targetWindow = getTargetWindow(event);
    const [x, y] = targetWindow.getPosition();
    event.returnValue = { x, y } satisfies AppWindowPosition;
  });

  ipcMain.handle("window:get-bounds", (event): AppWindowBounds => {
    const targetWindow = getTargetWindow(event);
    const { x, y, width, height } = targetWindow.getBounds();
    return { x, y, width, height };
  });

  ipcMain.on("window:get-bounds-sync", (event) => {
    const targetWindow = getTargetWindow(event);
    const { x, y, width, height } = targetWindow.getBounds();
    event.returnValue = { x, y, width, height } satisfies AppWindowBounds;
  });

  ipcMain.handle("window:set-position", (event, payload: AppWindowPosition) => {
    const targetWindow = getTargetWindow(event);
    if (!isValidWindowPosition(payload)) {
      return;
    }
    targetWindow.setPosition(Math.round(payload.x), Math.round(payload.y));
  });

  ipcMain.on("window:set-position-immediate", (event, payload: AppWindowPosition) => {
    const targetWindow = getTargetWindow(event);
    if (!isValidWindowPosition(payload)) {
      return;
    }
    targetWindow.setPosition(Math.round(payload.x), Math.round(payload.y));
  });

  ipcMain.handle("window:set-bounds", (event, payload: AppWindowBounds) => {
    const targetWindow = getTargetWindow(event);
    targetWindow.setBounds({
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      width: Math.round(payload.width),
      height: Math.round(payload.height),
    });
  });

  ipcMain.on("window:set-bounds-immediate", (event, payload: AppWindowBounds) => {
    const targetWindow = getTargetWindow(event);
    targetWindow.setBounds({
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      width: Math.round(payload.width),
      height: Math.round(payload.height),
    });
  });

  ipcMain.handle(
    "window:set-ignore-mouse-events",
    (event, payload: AppWindowIgnoreMouseRequest) => {
      const senderWindow = getDirectSenderWindow(event);
      senderWindow.setIgnoreMouseEvents(payload.ignore, {
        forward: payload.forward ?? true,
      });
    },
  );

  ipcMain.handle("window:get-opacity", () => getSavedWindowOpacity());

  ipcMain.handle(
    "window:set-opacity",
    async (_event, payload: AppWindowOpacityRequest) => {
      const nextOpacity = clampWindowOpacity(payload.opacity);
      if (payload.persist) {
        await persistWindowOpacity(nextOpacity);
      }
      return nextOpacity;
    },
  );
};
