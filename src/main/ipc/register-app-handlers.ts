import { app, ipcMain, type BrowserWindow } from "electron";
import { createDefaultProject } from "../services/project-service";
import {
  markTitleBarTooltipSeen,
  readSettings,
  resetTitleBarTooltips,
  saveLocale,
  writeSettings,
} from "../services/app-settings-service";
import { resolveShortcutBindings, type ShortcutBindings } from "../../shared/shortcuts";
import type { AppLocale } from "../../shared/types/project";

export const registerAppHandlers = (_window: BrowserWindow) => {
  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("app:get-settings", () => readSettings());
  ipcMain.handle("app:save-locale", (_event, locale: AppLocale) =>
    saveLocale(locale),
  );
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
  ipcMain.handle("app:mark-title-bar-tooltip-seen", (_event, tooltipId: string) =>
    markTitleBarTooltipSeen(tooltipId),
  );
  ipcMain.handle("app:reset-title-bar-tooltips", () => resetTitleBarTooltips());
  ipcMain.handle("app:quit", () => {
    app.quit();
  });

  ipcMain.handle("project:create", () => createDefaultProject());

  ipcMain.handle("project:get-recent-files", async () => {
    const settings = await readSettings();
    return settings.recentFiles;
  });
};
