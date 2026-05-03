import { BrowserWindow, screen, ipcMain } from "electron";
import { getWindowActionTarget } from "./window-action-targets";

interface DragSession {
  window: BrowserWindow;
  lastCursorX: number;
  lastCursorY: number;
  timerId: ReturnType<typeof setInterval> | null;
}

const POLL_INTERVAL_MS = 1000 / 120; // ~120 Hz polling

let activeSession: DragSession | null = null;

const pollAndApplyDrag = () => {
  if (!activeSession) return;
  const { window: win } = activeSession;

  if (win.isDestroyed()) {
    stopDrag();
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const dx = cursor.x - activeSession.lastCursorX;
  const dy = cursor.y - activeSession.lastCursorY;

  // DPI boundary jump detection
  if (Math.abs(dx) > 100 || Math.abs(dy) > 100) {
    activeSession.lastCursorX = cursor.x;
    activeSession.lastCursorY = cursor.y;
    return;
  }

  activeSession.lastCursorX = cursor.x;
  activeSession.lastCursorY = cursor.y;

  if (dx === 0 && dy === 0) return;

  const current = win.getBounds();
  win.setBounds({
    x: current.x + dx,
    y: current.y + dy,
    width: current.width,
    height: current.height,
  });
};

const stopDrag = () => {
  if (!activeSession) return;
  if (activeSession.timerId !== null) {
    clearInterval(activeSession.timerId);
  }
  activeSession = null;
};

export const registerMainProcessDrag = (window: BrowserWindow) => {
  ipcMain.on("drag:start", (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const targetWindow = getWindowActionTarget(senderWindow ?? window);

    if (!targetWindow || targetWindow.isDestroyed() || targetWindow.isMaximized()) {
      event.returnValue = false;
      return;
    }

    stopDrag();

    const cursor = screen.getCursorScreenPoint();

    activeSession = {
      window: targetWindow,
      lastCursorX: cursor.x,
      lastCursorY: cursor.y,
      timerId: setInterval(pollAndApplyDrag, POLL_INTERVAL_MS),
    };

    event.returnValue = true;
  });

  ipcMain.on("drag:stop", (event) => {
    if (activeSession) {
      pollAndApplyDrag();
    }
    stopDrag();
    event.returnValue = true;
  });

  window.on("closed", () => {
    stopDrag();
  });
};
