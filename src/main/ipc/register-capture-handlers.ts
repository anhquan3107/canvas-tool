import {
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  screen,
  type BrowserWindowConstructorOptions,
} from "electron";
import path from "node:path";
import { guardWindowDevTools } from "../devtools-guard";
import {
  clearWindowActionTarget,
  setWindowActionTarget,
} from "../window-action-targets";
import {
  getCaptureWindowBounds,
  getCaptureWindowBoundsForSource,
  getCaptureWindowBoundsWithinBox,
  getCaptureWindowMinimumSize,
  getSenderWindow,
  normalizeCaptureSourceSize,
} from "./ipc-utils";
import {
  ensureCaptureWindowAspectPayload,
  ensureCaptureWindowPayload,
} from "./ipc-validators";

const CAPTURE_TOOLBAR_HEIGHT = 40;
const CAPTURE_TOOLBAR_SEAM_OVERLAP = 2;

const getCaptureToolbarBounds = (captureWindow: BrowserWindow) => {
  const bounds = captureWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  return {
    x: bounds.x,
    y: Math.max(
      display.workArea.y,
      bounds.y - CAPTURE_TOOLBAR_HEIGHT + CAPTURE_TOOLBAR_SEAM_OVERLAP,
    ),
    width: bounds.width,
    height: CAPTURE_TOOLBAR_HEIGHT + CAPTURE_TOOLBAR_SEAM_OVERLAP,
  };
};

export const registerCaptureHandlers = (_window: BrowserWindow) => {
  const applyCaptureWindowAspect = (
    captureWindow: BrowserWindow,
    nextSourceSize: { width: number; height: number },
    preserveScale: boolean,
  ) => {
    const normalizedSourceSize = normalizeCaptureSourceSize(
      nextSourceSize.width,
      nextSourceSize.height,
    );
    const currentBounds = captureWindow.getBounds();
    const nextBounds = preserveScale
      ? getCaptureWindowBoundsWithinBox(normalizedSourceSize, {
          width: currentBounds.width,
          height: currentBounds.height,
        })
      : getCaptureWindowBoundsForSource(normalizedSourceSize);
    const minimumSize = getCaptureWindowMinimumSize(normalizedSourceSize);
    const shouldResizeWindow =
      !captureWindow.isMaximized() &&
      !captureWindow.isFullScreen() &&
      (Math.abs(currentBounds.width - nextBounds.width) > 1 ||
        Math.abs(currentBounds.height - nextBounds.height) > 1);

    captureWindow.setAspectRatio(
      normalizedSourceSize.width / normalizedSourceSize.height,
    );
    captureWindow.setMinimumSize(minimumSize.width, minimumSize.height);

    if (shouldResizeWindow) {
      captureWindow.setBounds(
        {
          ...currentBounds,
          width: nextBounds.width,
          height: nextBounds.height,
        },
        false,
      );
    }
  };

  ipcMain.handle("capture:list-sources", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      fetchWindowIcons: true,
      thumbnailSize: {
        width: 320,
        height: 180,
      },
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith("screen:") ? "screen" : "window",
      thumbnailDataUrl: source.thumbnail.isEmpty()
        ? null
        : source.thumbnail.toDataURL(),
      thumbnailWidth: source.thumbnail.getSize().width,
      thumbnailHeight: source.thumbnail.getSize().height,
      appIconDataUrl:
        source.appIcon && !source.appIcon.isEmpty()
          ? source.appIcon.toDataURL()
          : null,
    }));
  });

  ipcMain.handle("capture:open-window", async (_, rawPayload) => {
    const payload = ensureCaptureWindowPayload(rawPayload);
    const initialBounds = getCaptureWindowBounds(payload);
    const initialSourceSize = normalizeCaptureSourceSize(
      payload.sourceWidth,
      payload.sourceHeight,
    );
    const minimumSize = getCaptureWindowMinimumSize(initialSourceSize);
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const captureWindowOptions: BrowserWindowConstructorOptions = {
      width: initialBounds.width,
      height: initialBounds.height,
      minWidth: minimumSize.width,
      minHeight: minimumSize.height,
      show: false,
      resizable: true,
      frame: false,
      thickFrame: process.platform === "win32",
      transparent: false,
      backgroundColor: "#0f0f10",
      acceptFirstMouse: true,
      title: `Capture - ${payload.sourceName}`,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    };
    const captureWindow = new BrowserWindow(captureWindowOptions);
    const toolbarWindow = new BrowserWindow({
      ...getCaptureToolbarBounds(captureWindow),
      show: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: "#00000000",
      acceptFirstMouse: true,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    guardWindowDevTools(captureWindow);
    guardWindowDevTools(toolbarWindow);
    captureWindow.setAspectRatio(
      initialSourceSize.width / initialSourceSize.height,
    );
    toolbarWindow.setIgnoreMouseEvents(true, { forward: true });
    setWindowActionTarget(toolbarWindow, captureWindow);

    const syncToolbarWindow = () => {
      if (captureWindow.isDestroyed() || toolbarWindow.isDestroyed()) {
        return;
      }

      toolbarWindow.setAlwaysOnTop(captureWindow.isAlwaysOnTop());
      toolbarWindow.setBounds(getCaptureToolbarBounds(captureWindow), false);

      if (
        captureWindow.isVisible() &&
        !captureWindow.isMinimized() &&
        !captureWindow.isFullScreen()
      ) {
        if (!toolbarWindow.isVisible()) {
          toolbarWindow.showInactive();
        }
      } else if (toolbarWindow.isVisible()) {
        toolbarWindow.hide();
      }
    };

    const hideToolbarWindow = () => {
      if (!toolbarWindow.isDestroyed() && toolbarWindow.isVisible()) {
        toolbarWindow.hide();
      }
    };

    let revealTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      revealTimeout = null;
      if (!captureWindow.isDestroyed()) {
        captureWindow.show();
      }
      if (!toolbarWindow.isDestroyed()) {
        syncToolbarWindow();
      }
    }, 1500);

    captureWindow.once("closed", () => {
      if (revealTimeout) {
        clearTimeout(revealTimeout);
        revealTimeout = null;
      }

      clearWindowActionTarget(toolbarWindow);
      if (!toolbarWindow.isDestroyed()) {
        toolbarWindow.close();
      }
    });

    toolbarWindow.once("closed", () => {
      clearWindowActionTarget(toolbarWindow);
    });

    captureWindow.on("move", syncToolbarWindow);
    captureWindow.on("resize", syncToolbarWindow);
    captureWindow.on("show", syncToolbarWindow);
    captureWindow.on("restore", syncToolbarWindow);
    captureWindow.on("maximize", syncToolbarWindow);
    captureWindow.on("unmaximize", syncToolbarWindow);
    captureWindow.on("enter-full-screen", syncToolbarWindow);
    captureWindow.on("leave-full-screen", syncToolbarWindow);
    captureWindow.on("hide", hideToolbarWindow);
    captureWindow.on("minimize", hideToolbarWindow);
    captureWindow.on("always-on-top-changed", syncToolbarWindow);

    const query = new URLSearchParams({
      sessionId,
      mode: "capture",
      sourceId: payload.sourceId,
      sourceName: payload.sourceName,
      sourceKind: payload.sourceKind ?? "window",
      quality: payload.quality,
    }).toString();

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
      await captureWindow.loadURL(`${devServerUrl}?${query}`);
      await toolbarWindow.loadURL(
        `${devServerUrl}?${new URLSearchParams({
          mode: "capture-toolbar",
          sessionId,
          sourceName: payload.sourceName,
          quality: payload.quality,
        }).toString()}`,
      );
    } else {
      await captureWindow.loadFile(
        path.join(__dirname, "../renderer/index.html"),
        {
          query: {
            mode: "capture",
            sourceId: payload.sourceId,
            sourceName: payload.sourceName,
            sourceKind: payload.sourceKind ?? "window",
            quality: payload.quality,
            sessionId,
          },
        },
      );
      await toolbarWindow.loadFile(
        path.join(__dirname, "../renderer/index.html"),
        {
          query: {
            mode: "capture-toolbar",
            sessionId,
            sourceName: payload.sourceName,
            quality: payload.quality,
          },
        },
      );
    }
  });

  ipcMain.handle("capture:update-window-aspect", (event, rawPayload) => {
    const payload = ensureCaptureWindowAspectPayload(rawPayload);
    const captureWindow = getSenderWindow(event.sender);
    if (!captureWindow || captureWindow.isDestroyed()) {
      return;
    }

    applyCaptureWindowAspect(
      captureWindow,
      {
        width: payload.sourceWidth,
        height: payload.sourceHeight,
      },
      true,
    );

    if (!captureWindow.isVisible()) {
      captureWindow.show();
    }
  });
};
