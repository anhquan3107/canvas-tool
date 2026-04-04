import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";
import path from "node:path";
import type { NativeMenuAction } from "../shared/types/ipc";
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

if (process.platform === "darwin") {
  process.title = "CanvasTool";
  app.setName("CanvasTool");
}

const sendNativeMenuAction = (
  window: BrowserWindow | null,
  action: NativeMenuAction,
) => {
  const targetWindow = window ?? BrowserWindow.getAllWindows()[0] ?? null;
  targetWindow?.webContents.send("native-menu:action", action);
};

const registerAppShortcutOverrides = (window: BrowserWindow) => {
  window.webContents.on("before-input-event", (event, input) => {
    const hasPrimaryModifier =
      process.platform === "darwin" ? input.meta : input.control;
    if (!hasPrimaryModifier || input.alt) {
      return;
    }

    const key = input.key.toLowerCase();
    const code =
      "code" in input && typeof input.code === "string" ? input.code : "";
    const isResetView =
      !input.shift &&
      (key === "0" || code === "Digit0" || code === "Numpad0");
    const isZoomOut =
      !input.shift &&
      (key === "-" || key === "subtract" || code === "Minus" || code === "NumpadSubtract");
    const isZoomIn =
      key === "+" ||
      key === "=" ||
      key === "add" ||
      code === "NumpadAdd" ||
      code === "Equal";

    if (isResetView) {
      event.preventDefault();
      sendNativeMenuAction(window, "fit-canvas-to-window");
      return;
    }

    if (isZoomOut) {
      event.preventDefault();
      sendNativeMenuAction(window, "canvas-zoom-out");
      return;
    }

    if (isZoomIn) {
      event.preventDefault();
      sendNativeMenuAction(window, "canvas-zoom-in");
    }
  });
};

const createMainWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    title: "CanvasTool",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  guardWindowDevTools(mainWindow);
  registerAppShortcutOverrides(mainWindow);

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

  mainWindow.webContents.setZoomFactor(1);
};

const installMacApplicationMenu = () => {
  if (process.platform !== "darwin") {
    return;
  }

  app.setName("CanvasTool");

  const template: MenuItemConstructorOptions[] = [
    {
      role: "appMenu",
      submenu: [
        { role: "services" },
        { type: "separator" },
        {
          label: "Hide CanvasTool",
          click: () => app.hide(),
        },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit", label: "Quit CanvasTool" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Open",
          accelerator: "CmdOrCtrl+O",
          click: () => sendNativeMenuAction(BrowserWindow.getFocusedWindow(), "open-project"),
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => sendNativeMenuAction(BrowserWindow.getFocusedWindow(), "save-project"),
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () =>
            sendNativeMenuAction(BrowserWindow.getFocusedWindow(), "save-project-as"),
        },
        { type: "separator" },
        { role: "close", label: "Close Window" },
        { role: "quit", label: "Quit CanvasTool" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Show Keyboard Shortcuts",
          accelerator: "F1",
          click: () =>
            sendNativeMenuAction(BrowserWindow.getFocusedWindow(), "show-shortcuts"),
        },
        {
          label: "Lock / Unlock Canvas",
          accelerator: "F2",
          click: () =>
            sendNativeMenuAction(BrowserWindow.getFocusedWindow(), "toggle-canvas-lock"),
        },
        {
          label: "Hide / Show Swatches",
          accelerator: "CmdOrCtrl+H",
          click: () =>
            sendNativeMenuAction(BrowserWindow.getFocusedWindow(), "toggle-swatches"),
        },
        { type: "separator" },
        {
          label: "Fit Canvas to Content",
          accelerator: "CmdOrCtrl+Shift+F",
          click: () =>
            sendNativeMenuAction(BrowserWindow.getFocusedWindow(), "fit-canvas-to-content"),
        },
        {
          label: "Reset View",
          click: () =>
            sendNativeMenuAction(BrowserWindow.getFocusedWindow(), "fit-canvas-to-window"),
        },
        {
          label: "Change Canvas Size",
          accelerator: "CmdOrCtrl+Alt+I",
          click: () =>
            sendNativeMenuAction(BrowserWindow.getFocusedWindow(), "change-canvas-size"),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

app.whenReady().then(async () => {
  installMacApplicationMenu();
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
