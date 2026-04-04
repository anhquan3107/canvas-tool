import type { BrowserWindow } from "electron";
import { registerAppHandlers } from "./register-app-handlers";
import { registerCaptureHandlers } from "./register-capture-handlers";
import { registerExportHandlers } from "./register-export-handlers";
import { registerImportHandlers } from "./register-import-handlers";
import { registerProjectHandlers } from "./register-project-handlers";
import { registerWindowHandlers } from "./register-window-handlers";

export const setupIpcHandlers = (window: BrowserWindow) => {
  registerAppHandlers(window);
  registerExportHandlers(window);
  registerCaptureHandlers(window);
  registerProjectHandlers(window);
  registerWindowHandlers(window);
  registerImportHandlers(window);
};
