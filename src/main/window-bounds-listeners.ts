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

  const notify = () => {
    const currentListener = boundsListenerByWindow.get(window);
    if (!currentListener || window.isDestroyed()) {
      return;
    }

    currentListener(window.getBounds());
  };

  notify();
  setImmediate(notify);
  setTimeout(notify, 16);
};
