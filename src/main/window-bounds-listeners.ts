import type { BrowserWindow } from "electron";

type WindowBoundsListener = (bounds: Electron.Rectangle) => void;

const boundsListenerByWindow = new WeakMap<BrowserWindow, WindowBoundsListener>();

export const setWindowBoundsListener = (
  window: BrowserWindow,
  listener: WindowBoundsListener | null,
) => {
  if (listener) {
    boundsListenerByWindow.set(window, listener);
    return;
  }

  boundsListenerByWindow.delete(window);
};

export const notifyWindowBoundsChanged = (window: BrowserWindow) => {
  const listener = boundsListenerByWindow.get(window);
  if (!listener || window.isDestroyed()) {
    return;
  }

  listener(window.getBounds());
};
