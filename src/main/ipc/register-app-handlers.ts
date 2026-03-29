import { app, ipcMain, type BrowserWindow } from "electron";
import { createDefaultProject } from "../services/project-service";
import { readSettings, writeSettings } from "../services/app-settings-service";
import { resolveShortcutBindings, type ShortcutBindings } from "../../shared/shortcuts";

export const registerAppHandlers = (_window: BrowserWindow) => {
  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("app:get-settings", () => readSettings());
  ipcMain.handle(
    "app:save-shortcut-bindings",
    async (_event, bindings: ShortcutBindings) => {
      const settings = await readSettings();
      const nextShortcuts = resolveShortcutBindings(bindings);
      await writeSettings({
        ...settings,
        shortcuts: nextShortcuts,
      });
      return nextShortcuts;
    },
  );
  ipcMain.handle("app:quit", () => {
    app.quit();
  });

  ipcMain.handle("project:create", () => createDefaultProject());

  ipcMain.handle("project:get-recent-files", async () => {
    const settings = await readSettings();
    return settings.recentFiles;
  });
};
