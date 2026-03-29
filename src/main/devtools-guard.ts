import type { BrowserWindow, Input } from "electron";

const isDevToolsOpenShortcut = (input: Input) => {
  const key = input.key.toLowerCase();

  if (key === "f12") {
    return true;
  }

  const hasPrimaryModifier = process.platform === "darwin" ? input.meta : input.control;
  if (!hasPrimaryModifier) {
    return false;
  }

  if (key === "i" && input.shift) {
    return true;
  }

  if (process.platform === "darwin" && key === "i" && input.alt) {
    return true;
  }

  if (key === "j" && input.shift) {
    return true;
  }

  if (key === "c" && input.shift) {
    return true;
  }

  return false;
};

const shouldAllowDevTools = () =>
  process.env.ELECTRON_OPEN_DEVTOOLS === "1" ||
  process.env.CANVASTOOL_ALLOW_DEVTOOLS === "1";

export const guardWindowDevTools = (window: BrowserWindow) => {
  if (shouldAllowDevTools()) {
    return;
  }

  window.webContents.on("before-input-event", (event, input) => {
    if (!isDevToolsOpenShortcut(input)) {
      return;
    }

    event.preventDefault();
  });

  window.webContents.on("devtools-opened", () => {
    window.webContents.closeDevTools();
  });

  window.webContents.setWindowOpenHandler(() => ({
    action: "deny",
  }));
};
