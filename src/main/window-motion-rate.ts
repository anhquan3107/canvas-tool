import { screen } from "electron";

const MAX_WINDOW_MOTION_FPS = 120;
const MIN_WINDOW_MOTION_FPS = 30;
const FALLBACK_WINDOWS_MOTION_FPS = MAX_WINDOW_MOTION_FPS;

const getDisplayRefreshRates = () =>
  screen
    .getAllDisplays()
    .flatMap((display) => {
      const frequency = Math.round(display.displayFrequency);
      return Number.isFinite(frequency) && frequency >= MIN_WINDOW_MOTION_FPS
        ? [frequency]
        : [];
    });

const getWindowMotionFps = () => {
  if (process.platform !== "win32") {
    return MAX_WINDOW_MOTION_FPS;
  }

  const refreshRates = getDisplayRefreshRates();
  const fastestRefreshRate =
    refreshRates.length > 0
      ? Math.max(...refreshRates)
      : FALLBACK_WINDOWS_MOTION_FPS;

  return Math.min(
    MAX_WINDOW_MOTION_FPS,
    Math.max(MIN_WINDOW_MOTION_FPS, fastestRefreshRate),
  );
};

export const getWindowMotionPollIntervalMs = () => 1000 / getWindowMotionFps();
