import { BrowserWindow, desktopCapturer, ipcMain, type BrowserWindowConstructorOptions } from "electron";
import path from "node:path";
import { getCaptureWindowBounds } from "./ipc-utils";
import { ensureCaptureWindowPayload } from "./ipc-validators";

export const registerCaptureHandlers = (_window: BrowserWindow) => {
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
    const captureWindowOptions: BrowserWindowConstructorOptions = {
      width: bounds.width,
      height: bounds.height,
      minWidth: 640,
      minHeight: 420,
      frame: false,
      backgroundColor: "#12100f",
      title: `Capture - ${payload.sourceName}`,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    };
    const captureWindow = new BrowserWindow(captureWindowOptions);

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
};
