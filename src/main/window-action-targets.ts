import type { BrowserWindow } from "electron";

const actionTargetByWindow = new WeakMap<BrowserWindow, BrowserWindow>();

export const setWindowActionTarget = (
  sourceWindow: BrowserWindow,
  targetWindow: BrowserWindow,
) => {
  actionTargetByWindow.set(sourceWindow, targetWindow);
};

export const clearWindowActionTarget = (sourceWindow: BrowserWindow) => {
  actionTargetByWindow.delete(sourceWindow);
};

export const getWindowActionTarget = (sourceWindow: BrowserWindow | null) => {
  if (!sourceWindow) {
    return null;
  }

  return actionTargetByWindow.get(sourceWindow) ?? sourceWindow;
};
