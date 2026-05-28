/**
 * Main-process-driven window resize.
 *
 * The renderer only tells us "start resizing direction=nw" and "stop resizing".
 * All cursor polling, bounds calculation, and setBounds() calls happen here in
 * the main process — zero IPC round-trips during the drag.  This eliminates the
 * jitter caused by IPC latency when the renderer drives setBounds().
 */
import { BrowserWindow, screen, ipcMain } from "electron";
import { notifyWindowBoundsChanged } from "./window-bounds-listeners";
import { getWindowActionTarget } from "./window-action-targets";
import { getWindowMotionPollIntervalMs } from "./window-motion-rate";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface ResizeSession {
  window: BrowserWindow;
  direction: ResizeDirection;
  startCursorX: number;
  startCursorY: number;
  startBounds: Electron.Rectangle;
  minWidth: number;
  minHeight: number;
  aspectRatio: number | null;
  timerId: ReturnType<typeof setInterval> | null;
}

const hasWest = (d: ResizeDirection) => d.includes("w");
const hasEast = (d: ResizeDirection) => d.includes("e");
const hasNorth = (d: ResizeDirection) => d.includes("n");
const hasSouth = (d: ResizeDirection) => d.includes("s");

let activeSession: ResizeSession | null = null;
const resizeAspectRatioByWindow = new WeakMap<BrowserWindow, number>();
const resizeMinimumSizeByWindow = new WeakMap<
  BrowserWindow,
  { width: number; height: number }
>();
const resizingWindows = new WeakSet<BrowserWindow>();

export const isMainProcessResizeApplying = (window: BrowserWindow) =>
  resizingWindows.has(window);

export const isMainProcessResizeActive = (window: BrowserWindow) =>
  activeSession?.window === window;

export const setMainProcessResizeAspectRatio = (
  window: BrowserWindow,
  aspectRatio: number | null,
) => {
  if (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0) {
    resizeAspectRatioByWindow.set(window, aspectRatio);
    return;
  }

  resizeAspectRatioByWindow.delete(window);
};

export const setMainProcessResizeMinimumSize = (
  window: BrowserWindow,
  minimumSize: { width: number; height: number } | null,
) => {
  if (
    minimumSize &&
    Number.isFinite(minimumSize.width) &&
    Number.isFinite(minimumSize.height) &&
    minimumSize.width > 0 &&
    minimumSize.height > 0
  ) {
    resizeMinimumSizeByWindow.set(window, {
      width: Math.round(minimumSize.width),
      height: Math.round(minimumSize.height),
    });
    return;
  }

  resizeMinimumSizeByWindow.delete(window);
};

const applyAspectRatio = (
  direction: ResizeDirection,
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
  aspectRatio: number | null,
) => {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return { width, height };
  }

  const useHeightAsPrimary =
    hasSouth(direction) || (!hasEast(direction) && !hasWest(direction));

  if (useHeightAsPrimary) {
    width = Math.round(height * aspectRatio);
  } else {
    height = Math.round(width / aspectRatio);
  }

  if (width < minWidth) {
    width = minWidth;
    height = Math.round(width / aspectRatio);
  }

  if (height < minHeight) {
    height = minHeight;
    width = Math.round(height * aspectRatio);
  }

  return {
    width: Math.max(minWidth, Math.round(width)),
    height: Math.max(minHeight, Math.round(height)),
  };
};

const computeBounds = (
  startBounds: Electron.Rectangle,
  direction: ResizeDirection,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number,
  aspectRatio: number | null,
): Electron.Rectangle => {
  let x: number;
  let width: number;

  if (hasEast(direction)) {
    width = Math.max(minWidth, Math.round(startBounds.width + dx));
    x = startBounds.x;
  } else if (hasWest(direction)) {
    const right = startBounds.x + startBounds.width;
    width = Math.max(minWidth, Math.round(startBounds.width - dx));
    x = right - width;
  } else {
    x = startBounds.x;
    width = startBounds.width;
  }

  let y: number;
  let height: number;

  if (hasSouth(direction)) {
    height = Math.max(minHeight, Math.round(startBounds.height + dy));
    y = startBounds.y;
  } else if (hasNorth(direction)) {
    const bottom = startBounds.y + startBounds.height;
    height = Math.max(minHeight, Math.round(startBounds.height - dy));
    y = bottom - height;
  } else {
    y = startBounds.y;
    height = startBounds.height;
  }

  const aspectLockedSize = applyAspectRatio(
    direction,
    width,
    height,
    minWidth,
    minHeight,
    aspectRatio,
  );
  width = aspectLockedSize.width;
  height = aspectLockedSize.height;

  if (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0) {
    if (hasWest(direction)) {
      x = startBounds.x + startBounds.width - width;
    } else {
      x = startBounds.x;
    }

    if (hasNorth(direction)) {
      y = startBounds.y + startBounds.height - height;
    } else {
      y = startBounds.y;
    }
  }

  return { x, y, width, height };
};

const pollAndApply = () => {
  if (!activeSession) return;
  const {
    window: win,
    direction,
    startCursorX,
    startCursorY,
    startBounds,
    minWidth,
    minHeight,
    aspectRatio,
  } = activeSession;

  if (win.isDestroyed()) {
    stopResize();
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const dx = cursor.x - startCursorX;
  const dy = cursor.y - startCursorY;

  const next = computeBounds(
    startBounds,
    direction,
    dx,
    dy,
    minWidth,
    minHeight,
    aspectRatio,
  );

  // Only setBounds when something actually changed.
  const current = win.getBounds();
  if (
    current.x === next.x &&
    current.y === next.y &&
    current.width === next.width &&
    current.height === next.height
  ) {
    return;
  }

  resizingWindows.add(win);
  try {
    win.setBounds(next, false);
  } finally {
    resizingWindows.delete(win);
  }
  notifyWindowBoundsChanged(win);
};

const stopResize = () => {
  if (!activeSession) return;
  if (activeSession.timerId !== null) {
    clearInterval(activeSession.timerId);
  }
  activeSession = null;
};

export const registerMainProcessResize = (window: BrowserWindow) => {
  ipcMain.on("resize:start", (event, payload: { direction: string }) => {
    // Only handle resize for the correct window.
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const targetWindow =
      getWindowActionTarget(senderWindow) ?? senderWindow ?? window;

    if (targetWindow.isDestroyed() || targetWindow.isMaximized()) {
      event.returnValue = false;
      return;
    }

    // Stop any existing session first.
    stopResize();

    const cursor = screen.getCursorScreenPoint();
    const bounds = targetWindow.getBounds();
    const configuredMinimumSize = resizeMinimumSizeByWindow.get(targetWindow);
    const [mw, mh] = configuredMinimumSize
      ? [configuredMinimumSize.width, configuredMinimumSize.height]
      : targetWindow.getMinimumSize();

    activeSession = {
      window: targetWindow,
      direction: payload.direction as ResizeDirection,
      startCursorX: cursor.x,
      startCursorY: cursor.y,
      startBounds: bounds,
      minWidth: Math.max(1, mw),
      minHeight: Math.max(1, mh),
      aspectRatio: resizeAspectRatioByWindow.get(targetWindow) ?? null,
      timerId: setInterval(pollAndApply, getWindowMotionPollIntervalMs()),
    };

    event.returnValue = true;
  });

  ipcMain.on("resize:stop", (event) => {
    // Apply final bounds before stopping.
    if (activeSession) {
      pollAndApply();
    }
    stopResize();
    event.returnValue = true;
  });

  // Clean up if window closes.
  window.on("closed", () => {
    stopResize();
  });
};
