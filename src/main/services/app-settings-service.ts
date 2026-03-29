import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppSettings } from "../../shared/types/project";
import {
  DEFAULT_SHORTCUT_BINDINGS,
  SHORTCUT_DEFINITIONS,
} from "../../shared/shortcuts";

const SETTINGS_FILE = "settings.json";

const defaultSettings = (): AppSettings => ({
  recentFiles: [],
  maxRecentFiles: 12,
  shortcuts: { ...DEFAULT_SHORTCUT_BINDINGS },
});

const settingsPath = () => path.join(app.getPath("userData"), SETTINGS_FILE);

const migrateShortcutBindings = (shortcuts: AppSettings["shortcuts"]) => {
  if (!shortcuts) {
    return shortcuts;
  }

  const toggleAutoArrangeOnImport = shortcuts["arrange.toggleAutoArrangeOnImport"];

  return {
    ...shortcuts,
    "arrange.auto":
      shortcuts["arrange.auto"] === "Ctrl+Alt+F"
        ? "Ctrl+Alt+A"
        : shortcuts["arrange.auto"],
    "arrange.toggleAutoArrangeOnImport":
      toggleAutoArrangeOnImport === "Ctrl+Alt+A" ||
      toggleAutoArrangeOnImport === "Ctrl+Alt+I"
        ? "Ctrl+Shift+A"
        : toggleAutoArrangeOnImport,
  };
};

export const readSettings = async (): Promise<AppSettings> => {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const migratedShortcuts = migrateShortcutBindings(parsed.shortcuts);
    const parsedShortcuts =
      migratedShortcuts && typeof migratedShortcuts === "object"
        ? Object.fromEntries(
            SHORTCUT_DEFINITIONS.map((definition) => {
              const value = migratedShortcuts?.[definition.id];
              return [
                definition.id,
                typeof value === "string" && value.trim().length > 0
                  ? value.trim()
                  : DEFAULT_SHORTCUT_BINDINGS[definition.id],
              ];
            }),
          )
        : { ...DEFAULT_SHORTCUT_BINDINGS };

    return {
      recentFiles: Array.isArray(parsed.recentFiles)
        ? parsed.recentFiles.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      maxRecentFiles:
        typeof parsed.maxRecentFiles === "number" && parsed.maxRecentFiles > 0
          ? parsed.maxRecentFiles
          : 12,
      lastOpenedFile:
        typeof parsed.lastOpenedFile === "string"
          ? parsed.lastOpenedFile
          : undefined,
      shortcuts: parsedShortcuts,
    };
  } catch {
    return defaultSettings();
  }
};

export const writeSettings = async (settings: AppSettings) => {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
};

export const addRecentFile = async (filePath: string) => {
  const settings = await readSettings();
  const withoutDupes = settings.recentFiles.filter(
    (existing) => existing !== filePath,
  );
  const max = settings.maxRecentFiles || 12;

  const next: AppSettings = {
    ...settings,
    lastOpenedFile: filePath,
    recentFiles: [filePath, ...withoutDupes].slice(0, max),
  };

  await writeSettings(next);
  return next.recentFiles;
};
