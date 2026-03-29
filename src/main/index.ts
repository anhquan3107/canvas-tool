import { app, BrowserWindow } from "electron";
import path from "node:path";
import { guardWindowDevTools } from "./devtools-guard";
import { setupIpcHandlers } from "./ipc/ipc-handlers";

if (
  process.platform === "win32" &&
  process.env.ELECTRON_ENABLE_LOGGING !== "1" &&
  !process.env.CANVASTOOL_ENABLE_CHROMIUM_LOGS
) {
  // Keep noisy Windows Graphics Capture diagnostics out of the app console.
  app.commandLine.appendSwitch("log-level", "3");
}

const createMainWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: "#12100f",
    title: "CanvasTool",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  guardWindowDevTools(mainWindow);

  setupIpcHandlers(mainWindow);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const shouldOpenDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === "1";

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
};

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
