/**
 * Main-process-driven window resize.
 *
 * The renderer only tells us "start resizing direction=nw" and "stop resizing".
 * All cursor polling, bounds calculation, and setBounds() calls happen here in
 * the main process — zero IPC round-trips during the drag.  This eliminates the
 * jitter caused by IPC latency when the renderer drives setBounds().
 */
import { BrowserWindow, screen, ipcMain } from "electron";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface ResizeSession {
  window: BrowserWindow;
  direction: ResizeDirection;
  startCursorX: number;
  startCursorY: number;
  startBounds: Electron.Rectangle;
  minWidth: number;
  minHeight: number;
  timerId: ReturnType<typeof setInterval> | null;
}

const hasWest = (d: ResizeDirection) => d.includes("w");
const hasEast = (d: ResizeDirection) => d.includes("e");
const hasNorth = (d: ResizeDirection) => d.includes("n");
const hasSouth = (d: ResizeDirection) => d.includes("s");

const POLL_INTERVAL_MS = 1000 / 120; // ~120 Hz polling

let activeSession: ResizeSession | null = null;

const computeBounds = (
  startBounds: Electron.Rectangle,
  direction: ResizeDirection,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number,
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

  return { x, y, width, height };
};

const pollAndApply = () => {
  if (!activeSession) return;
  const { window: win, direction, startCursorX, startCursorY, startBounds, minWidth, minHeight } = activeSession;

  if (win.isDestroyed()) {
    stopResize();
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const dx = cursor.x - startCursorX;
  const dy = cursor.y - startCursorY;

  const next = computeBounds(startBounds, direction, dx, dy, minWidth, minHeight);

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

  win.setBounds(next);
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
    const targetWindow = senderWindow ?? window;

    if (targetWindow.isDestroyed() || targetWindow.isMaximized()) {
      event.returnValue = false;
      return;
    }

    // Stop any existing session first.
    stopResize();

    const cursor = screen.getCursorScreenPoint();
    const bounds = targetWindow.getBounds();
    const [mw, mh] = targetWindow.getMinimumSize();

    activeSession = {
      window: targetWindow,
      direction: payload.direction as ResizeDirection,
      startCursorX: cursor.x,
      startCursorY: cursor.y,
      startBounds: bounds,
      minWidth: Math.max(160, mw),
      minHeight: Math.max(160, mh),
      timerId: setInterval(pollAndApply, POLL_INTERVAL_MS),
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
