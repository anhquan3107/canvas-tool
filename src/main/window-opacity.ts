import { readSettings, writeSettings } from "./services/app-settings-service";

export const DEFAULT_WINDOW_OPACITY = 1;
export const MIN_WINDOW_OPACITY = 0.05;
export const MAX_WINDOW_OPACITY = 1;

export const clampWindowOpacity = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_WINDOW_OPACITY;
  }

  return Math.min(MAX_WINDOW_OPACITY, Math.max(MIN_WINDOW_OPACITY, value));
};

export const getSavedWindowOpacity = async () => {
  const settings = await readSettings();
  return clampWindowOpacity(settings.windowOpacity ?? DEFAULT_WINDOW_OPACITY);
};

export const persistWindowOpacity = async (opacity: number) => {
  const nextOpacity = clampWindowOpacity(opacity);
  const settings = await readSettings();

  await writeSettings({
    ...settings,
    windowOpacity: nextOpacity,
  });

  return nextOpacity;
};
