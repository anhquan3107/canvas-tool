import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  AppSettings,
  WindowBoundsSnapshot,
  WindowPlacementSettings,
} from "../../shared/types/project";
import {
  DEFAULT_SHORTCUT_BINDINGS,
  SHORTCUT_DEFINITIONS,
} from "../../shared/shortcuts";

const SETTINGS_FILE = "settings.json";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const sanitizePlacement = (
  placement: WindowBoundsSnapshot | undefined,
): WindowBoundsSnapshot | undefined => {
  if (!placement) {
    return undefined;
  }

  if (
    !isFiniteNumber(placement.x) ||
    !isFiniteNumber(placement.y) ||
    !isFiniteNumber(placement.width) ||
    !isFiniteNumber(placement.height)
  ) {
    return undefined;
  }

  return {
    x: Math.round(placement.x),
    y: Math.round(placement.y),
    width: Math.round(placement.width),
    height: Math.round(placement.height),
    isMaximized: placement.isMaximized === true,
    displayId:
      typeof placement.displayId === "number" &&
      Number.isFinite(placement.displayId)
        ? Math.round(placement.displayId)
        : undefined,
    displayKey:
      typeof placement.displayKey === "string" &&
      placement.displayKey.trim().length > 0
        ? placement.displayKey.trim()
        : undefined,
  };
};

export const sanitizeWindowPlacementSettings = (
  placement: WindowPlacementSettings | undefined,
): WindowPlacementSettings | undefined => {
  if (!placement || typeof placement !== "object") {
    return undefined;
  }

  const layouts = Object.fromEntries(
    Object.entries(placement.layouts ?? {}).flatMap(([key, value]) => {
      const sanitized = sanitizePlacement(value);
      return sanitized ? [[key, sanitized]] : [];
    }),
  );

  const lastBounds = sanitizePlacement(placement.lastBounds);

  if (!lastBounds && Object.keys(layouts).length === 0) {
    return undefined;
  }

  return {
    lastBounds,
    layouts,
  };
};

const clampSavedWindowOpacity = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0.05, value));
};

const defaultSettings = (): AppSettings => ({
  recentFiles: [],
  maxRecentFiles: 12,
  windowOpacity: 1,
  windowPlacement: undefined,
  shortcuts: { ...DEFAULT_SHORTCUT_BINDINGS },
  seenTitleBarTooltips: [],
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
    "canvas.toggleLock":
      shortcuts["canvas.toggleLock"] === "Ctrl+L"
        ? "F2"
        : shortcuts["canvas.toggleLock"],
    "canvas.changeSize":
      shortcuts["canvas.changeSize"] === "Ctrl+Shift+C"
        ? "Ctrl+Alt+I"
        : shortcuts["canvas.changeSize"],
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
      windowOpacity: clampSavedWindowOpacity(parsed.windowOpacity),
      lastOpenedFile:
        typeof parsed.lastOpenedFile === "string"
          ? parsed.lastOpenedFile
          : undefined,
      lastExportPath:
        typeof parsed.lastExportPath === "string"
          ? parsed.lastExportPath
          : undefined,
      windowPlacement: sanitizeWindowPlacementSettings(parsed.windowPlacement),
      shortcuts: parsedShortcuts,
      seenTitleBarTooltips: Array.isArray(parsed.seenTitleBarTooltips)
        ? parsed.seenTitleBarTooltips.filter(
            (item): item is string => typeof item === "string" && item.length > 0,
          )
        : [],
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

export const markTitleBarTooltipSeen = async (tooltipId: string) => {
  const nextTooltipId = tooltipId.trim();
  const settings = await readSettings();

  if (!nextTooltipId) {
    return settings.seenTitleBarTooltips ?? [];
  }

  const nextSeen = Array.from(
    new Set([...(settings.seenTitleBarTooltips ?? []), nextTooltipId]),
  );

  await writeSettings({
    ...settings,
    seenTitleBarTooltips: nextSeen,
  });

  return nextSeen;
};

export const resetTitleBarTooltips = async () => {
  const settings = await readSettings();
  await writeSettings({
    ...settings,
    seenTitleBarTooltips: [],
  });
  return [];
};

export const setLastExportPath = async (exportPath: string) => {
  const nextExportPath = exportPath.trim();
  const settings = await readSettings();

  if (!nextExportPath) {
    return settings.lastExportPath;
  }

  await writeSettings({
    ...settings,
    lastExportPath: nextExportPath,
  });

  return nextExportPath;
};
