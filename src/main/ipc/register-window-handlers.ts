import { ipcMain, screen, type BrowserWindow } from "electron";
import type {
  AppWindowBounds,
  AppWindowIgnoreMouseRequest,
  AppWindowOpacityRequest,
  AppWindowPosition,
  AppWindowSize,
  AppWindowState,
} from "../../shared/types/ipc";
import { notifyWindowBoundsChanged } from "../window-bounds-listeners";
import { getWindowActionTarget } from "../window-action-targets";
import { clampWindowOpacity, getSavedWindowOpacity, persistWindowOpacity } from "../window-opacity";
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
  const isValidWindowBounds = (
    payload: AppWindowBounds | null | undefined,
  ): payload is AppWindowBounds =>
    payload != null &&
    isFiniteNumber(payload.x) &&
    isFiniteNumber(payload.y) &&
    isFiniteNumber(payload.width) &&
    isFiniteNumber(payload.height);
  const getNativeCoordinateEnvelope = () => {
    const displays = screen.getAllDisplays();
    if (displays.length === 0) {
      return {
        minX: -100_000,
        maxX: 100_000,
        minY: -100_000,
        maxY: 100_000,
      };
    }

    const minX = Math.min(...displays.map((display) => display.bounds.x));
    const minY = Math.min(...displays.map((display) => display.bounds.y));
    const maxX = Math.max(
      ...displays.map((display) => display.bounds.x + display.bounds.width),
    );
    const maxY = Math.max(
      ...displays.map((display) => display.bounds.y + display.bounds.height),
    );
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    return {
      minX: minX - spanX,
      maxX: maxX + spanX,
      minY: minY - spanY,
      maxY: maxY + spanY,
    };
  };
  const clampInteger = (value: number, min: number, max: number) => {
    const rounded = Math.round(value);
    if (!Number.isSafeInteger(rounded)) {
      return null;
    }

    const clamped = Math.min(max, Math.max(min, rounded));
    return Object.is(clamped, -0) ? 0 : clamped;
  };
  const sanitizeWindowPosition = (
    payload: AppWindowPosition | null | undefined,
  ): AppWindowPosition | null => {
    if (!isValidWindowPosition(payload)) {
      return null;
    }

    const envelope = getNativeCoordinateEnvelope();
    const x = clampInteger(payload.x, envelope.minX, envelope.maxX);
    const y = clampInteger(payload.y, envelope.minY, envelope.maxY);
    return x === null || y === null ? null : { x, y };
  };
  const sanitizeWindowBounds = (
    payload: AppWindowBounds | null | undefined,
  ): AppWindowBounds | null => {
    if (!isValidWindowBounds(payload)) {
      return null;
    }

    const envelope = getNativeCoordinateEnvelope();
    const x = clampInteger(payload.x, envelope.minX, envelope.maxX);
    const y = clampInteger(payload.y, envelope.minY, envelope.maxY);
    const width = clampInteger(payload.width, 1, 100_000);
    const height = clampInteger(payload.height, 1, 100_000);
    return x === null || y === null || width === null || height === null
      ? null
      : { x, y, width, height };
  };
  const toWindowSize = (width: number, height: number): AppWindowSize => ({
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  });
  const dipToScreenPoint = (point: AppWindowPosition) =>
    process.platform === "win32" || process.platform === "linux"
      ? screen.dipToScreenPoint(point)
      : point;
  const dipToScreenRect = (point: AppWindowBounds) =>
    process.platform === "win32"
      ? screen.dipToScreenRect(null, point)
      : point;
  const screenToDipRect = (point: AppWindowBounds) =>
    process.platform === "win32"
      ? screen.screenToDipRect(null, point)
      : point;

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

  ipcMain.handle("window:get-controls-state", (event) => ({
    isMaximized: getTargetWindow(event).isMaximized(),
    isAlwaysOnTop: getTargetWindow(event).isAlwaysOnTop(),
  }));

  ipcMain.on("window:get-cursor-screen-point-sync", (event) => {
    const { x, y } = screen.getCursorScreenPoint();
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

  ipcMain.on("window:dip-to-screen-rect-sync", (event, payload: AppWindowBounds) => {
    if (!isValidWindowBounds(payload)) {
      event.returnValue = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      } satisfies AppWindowBounds;
      return;
    }

    const { x, y, width, height } = dipToScreenRect(payload);
    event.returnValue = { x, y, width, height } satisfies AppWindowBounds;
  });

  ipcMain.on("window:screen-to-dip-rect-sync", (event, payload: AppWindowBounds) => {
    if (!isValidWindowBounds(payload)) {
      event.returnValue = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      } satisfies AppWindowBounds;
      return;
    }

    const { x, y, width, height } = screenToDipRect(payload);
    event.returnValue = { x, y, width, height } satisfies AppWindowBounds;
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

  ipcMain.on("window:get-minimum-size-sync", (event) => {
    const targetWindow = getTargetWindow(event);
    const [width, height] = targetWindow.getMinimumSize();
    event.returnValue = toWindowSize(width, height);
  });

  ipcMain.handle("window:set-position", (event, payload: AppWindowPosition) => {
    const targetWindow = getTargetWindow(event);
    const nextPosition = sanitizeWindowPosition(payload);
    if (!nextPosition) {
      return;
    }
    try {
      targetWindow.setPosition(nextPosition.x, nextPosition.y);
    } catch {
      // Native window APIs can reject transient OS pointer coordinates.
    }
  });

  ipcMain.on("window:set-position-immediate", (event, payload: AppWindowPosition) => {
    const targetWindow = getTargetWindow(event);
    const nextPosition = sanitizeWindowPosition(payload);
    if (!nextPosition) {
      return;
    }
    try {
      targetWindow.setPosition(nextPosition.x, nextPosition.y);
    } catch {
      // Ignore one bad native move instead of surfacing a main-process dialog.
    }
  });

  ipcMain.handle("window:set-bounds", (event, payload: AppWindowBounds) => {
    const targetWindow = getTargetWindow(event);
    const nextBounds = sanitizeWindowBounds(payload);
    if (!nextBounds) {
      return;
    }
    try {
      targetWindow.setBounds(nextBounds);
    } catch {
      return;
    }
    notifyWindowBoundsChanged(targetWindow, nextBounds);
  });

  ipcMain.on("window:set-bounds-immediate", (event, payload: AppWindowBounds) => {
    const targetWindow = getTargetWindow(event);
    const nextBounds = sanitizeWindowBounds(payload);
    if (nextBounds) {
      try {
        targetWindow.setBounds(nextBounds);
        notifyWindowBoundsChanged(targetWindow, nextBounds);
      } catch {
        // Required below: still set returnValue so sendSync() unblocks.
      }
    }
    // Required: set returnValue so ipcRenderer.sendSync() unblocks immediately.
    event.returnValue = null;
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
};
