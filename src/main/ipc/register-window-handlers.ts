import { ipcMain, type BrowserWindow } from "electron";
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

  ipcMain.handle("window:set-title", (event, payload: AppWindowState) => {
    const safeTitle = payload.fileName
      ? `CanvasTool - ${payload.fileName}`
      : `CanvasTool - ${payload.title}`;

    getTargetWindow(event)?.setTitle(safeTitle);
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
    targetWindow.setPosition(Math.round(payload.x), Math.round(payload.y));
  });

  ipcMain.on("window:set-position-immediate", (event, payload: AppWindowPosition) => {
    const targetWindow = getTargetWindow(event);
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
