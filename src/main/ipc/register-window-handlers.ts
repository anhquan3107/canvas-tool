import { ipcMain, type BrowserWindow } from "electron";
import type { AppWindowPosition, AppWindowState } from "../../shared/types/ipc";
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

  ipcMain.handle("window:set-position", (event, payload: AppWindowPosition) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    targetWindow.setPosition(Math.round(payload.x), Math.round(payload.y));
  });
};
