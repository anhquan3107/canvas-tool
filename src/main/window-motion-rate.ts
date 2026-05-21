import { screen } from "electron";

const MAX_WINDOW_MOTION_FPS = 120;
const MIN_WINDOW_MOTION_FPS = 30;
const FALLBACK_WINDOWS_MOTION_FPS = 60;

const getDisplayRefreshRates = () =>
  screen
    .getAllDisplays()
    .map((display) => Math.round(display.displayFrequency))
    .filter(
      (frequency) =>
        Number.isFinite(frequency) && frequency >= MIN_WINDOW_MOTION_FPS,
    );

const getWindowMotionFps = () => {
  if (process.platform !== "win32") {
    return MAX_WINDOW_MOTION_FPS;
  }

  const refreshRates = getDisplayRefreshRates();
  const slowestRefreshRate =
    refreshRates.length > 0
      ? Math.min(...refreshRates)
      : FALLBACK_WINDOWS_MOTION_FPS;

  return Math.min(
    MAX_WINDOW_MOTION_FPS,
    Math.max(MIN_WINDOW_MOTION_FPS, slowestRefreshRate),
  );
};

export const getWindowMotionPollIntervalMs = () => 1000 / getWindowMotionFps();
