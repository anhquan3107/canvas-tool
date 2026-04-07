import {
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  type BrowserWindowConstructorOptions,
} from "electron";
import path from "node:path";
import { guardWindowDevTools } from "../devtools-guard";
import {
  getCaptureWindowBounds,
  getCaptureWindowBoundsWithinBox,
  getCaptureWindowBoundsForSource,
  getCaptureWindowMinimumSize,
  getSenderWindow,
  normalizeCaptureSourceSize,
} from "./ipc-utils";
import {
  ensureCaptureWindowAspectPayload,
  ensureCaptureWindowPayload,
} from "./ipc-validators";

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
    const bounds = getCaptureWindowBounds(payload);
    const initialSourceSize = normalizeCaptureSourceSize(
      payload.sourceWidth,
      payload.sourceHeight,
    );
    const minimumSize = getCaptureWindowMinimumSize(initialSourceSize);
    const captureWindowOptions: BrowserWindowConstructorOptions = {
      width: bounds.width,
      height: bounds.height,
      minWidth: minimumSize.width,
      minHeight: minimumSize.height,
      show: false,
      resizable: true,
      frame: false,
      thickFrame: process.platform === "win32",
      transparent: false,
      backgroundColor: "#0f0f10",
      title: `Capture - ${payload.sourceName}`,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    };
    const captureWindow = new BrowserWindow(captureWindowOptions);
    guardWindowDevTools(captureWindow);
    captureWindow.setAspectRatio(
      initialSourceSize.width / initialSourceSize.height,
    );

    let revealTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      revealTimeout = null;
      if (!captureWindow.isDestroyed()) {
        captureWindow.show();
      }
    }, 1500);

    captureWindow.once("closed", () => {
      if (revealTimeout) {
        clearTimeout(revealTimeout);
        revealTimeout = null;
      }
    });

    const query = new URLSearchParams({
      mode: "capture",
      sourceId: payload.sourceId,
      sourceName: payload.sourceName,
      sourceKind: payload.sourceKind ?? "window",
      quality: payload.quality,
    }).toString();

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
      await captureWindow.loadURL(`${devServerUrl}?${query}`);
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
