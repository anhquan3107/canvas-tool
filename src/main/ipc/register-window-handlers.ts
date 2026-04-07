import { ipcMain, type BrowserWindow } from "electron";
import type {
  AppWindowBounds,
  AppWindowOpacityRequest,
  AppWindowPosition,
  AppWindowState,
} from "../../shared/types/ipc";
import {
  clampWindowOpacity,
  getSavedWindowOpacity,
  persistWindowOpacity,
} from "../window-opacity";
import { getSenderWindow } from "./ipc-utils";

export const registerWindowHandlers = (window: BrowserWindow) => {
  ipcMain.handle("window:set-title", (event, payload: AppWindowState) => {
    const safeTitle = payload.fileName
      ? `CanvasTool - ${payload.fileName}`
      : `CanvasTool - ${payload.title}`;

    getSenderWindow(event.sender)?.setTitle(safeTitle);
  });

  ipcMain.handle("window:minimize", (event) => {
    getSenderWindow(event.sender)?.minimize();
  });

  ipcMain.handle("window:toggle-always-on-top", (event) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    const nextState = !targetWindow.isAlwaysOnTop();
    targetWindow.setAlwaysOnTop(nextState);

    return {
      isMaximized: targetWindow.isMaximized(),
      isAlwaysOnTop: targetWindow.isAlwaysOnTop(),
    };
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
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
    getSenderWindow(event.sender)?.close();
  });

  ipcMain.handle("window:get-controls-state", (event) => ({
    isMaximized: (getSenderWindow(event.sender) ?? window).isMaximized(),
    isAlwaysOnTop: (getSenderWindow(event.sender) ?? window).isAlwaysOnTop(),
  }));

  ipcMain.handle("window:get-position", (event): AppWindowPosition => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    const [x, y] = targetWindow.getPosition();
    return { x, y };
  });

  ipcMain.on("window:get-position-sync", (event) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    const [x, y] = targetWindow.getPosition();
    event.returnValue = { x, y } satisfies AppWindowPosition;
  });

  ipcMain.handle("window:get-bounds", (event): AppWindowBounds => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    const { x, y, width, height } = targetWindow.getBounds();
    return { x, y, width, height };
  });

  ipcMain.on("window:get-bounds-sync", (event) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    const { x, y, width, height } = targetWindow.getBounds();
    event.returnValue = { x, y, width, height } satisfies AppWindowBounds;
  });

  ipcMain.handle("window:set-position", (event, payload: AppWindowPosition) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    targetWindow.setPosition(Math.round(payload.x), Math.round(payload.y));
  });

  ipcMain.on("window:set-position-immediate", (event, payload: AppWindowPosition) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    targetWindow.setPosition(Math.round(payload.x), Math.round(payload.y));
  });

  ipcMain.handle("window:set-bounds", (event, payload: AppWindowBounds) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    targetWindow.setBounds({
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      width: Math.round(payload.width),
      height: Math.round(payload.height),
    });
  });

  ipcMain.on("window:set-bounds-immediate", (event, payload: AppWindowBounds) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    targetWindow.setBounds({
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      width: Math.round(payload.width),
      height: Math.round(payload.height),
    });
  });

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
