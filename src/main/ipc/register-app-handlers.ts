import { app, ipcMain, type BrowserWindow } from "electron";
import { createDefaultProject } from "../services/project-service";
import { readSettings } from "../services/app-settings-service";

export const registerAppHandlers = (_window: BrowserWindow) => {
  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("app:quit", () => {
    app.quit();
  });

  ipcMain.handle("project:create", () => createDefaultProject());

  ipcMain.handle("project:get-recent-files", async () => {
    const settings = await readSettings();
    return settings.recentFiles;
  });
};
