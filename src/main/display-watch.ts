import { BrowserWindow, screen, type Display } from "electron";
import {
  fitBoundsIntoDisplay,
  isBoundsVisibleOnDisplay,
  isLikelyUsableDisplay,
} from "./window-placement";

const DISPLAY_CHANGE_SETTLE_MS = 180;
const WINDOWS_DISPLAY_POLL_MS = 1500;

const getDisplayObservationKey = (display: Display) => {
  const { x, y, width, height } = display.bounds;
  const {
    x: workX,
    y: workY,
    width: workWidth,
    height: workHeight,
  } = display.workArea;
  const frequency = Number.isFinite(display.displayFrequency)
    ? Math.round(display.displayFrequency)
    : -1;

  return [
    display.id,
    `${x},${y},${width},${height}`,
    `${workX},${workY},${workWidth},${workHeight}`,
    display.scaleFactor,
    display.rotation,
    display.internal ? 1 : 0,
    display.detected === false ? 0 : 1,
    frequency,
  ].join(":");
};

const getDisplayTopologyKey = (displays: Display[]) =>
  displays.map(getDisplayObservationKey).sort().join("|");

const getFallbackDisplay = (displays: Display[]) => {
  const usableDisplays = displays.filter(isLikelyUsableDisplay);
  const primaryDisplay = screen.getPrimaryDisplay();

  return (
    (isLikelyUsableDisplay(primaryDisplay) ? primaryDisplay : usableDisplays[0]) ??
    primaryDisplay
  );
};

const getReferenceBounds = (window: BrowserWindow) => {
  if (window.isMinimized() || window.isMaximized()) {
    return window.getNormalBounds();
  }

  return window.getBounds();
};

const relocateWindowToDisplay = (
  window: BrowserWindow,
  fallbackDisplay: Display,
) => {
  const referenceBounds = getReferenceBounds(window);
  const [minimumWidth, minimumHeight] = window.getMinimumSize();
  const nextBounds = fitBoundsIntoDisplay(referenceBounds, fallbackDisplay, {
    width: referenceBounds.width,
    height: referenceBounds.height,
    minWidth: Math.max(1, minimumWidth),
    minHeight: Math.max(1, minimumHeight),
  });
  const wasFullScreen = window.isFullScreen();
  const wasMaximized = window.isMaximized();

  if (wasFullScreen) {
    window.setFullScreen(false);
  }

  if (wasMaximized) {
    window.unmaximize();
  }

  window.setBounds(nextBounds, false);

  if (!window.isDestroyed() && wasMaximized) {
    window.maximize();
  }
};

const needsDisplayRescue = (
  window: BrowserWindow,
  usableDisplays: Display[],
) => {
  if (window.isDestroyed() || window.getParentWindow()) {
    return false;
  }

  const bounds = getReferenceBounds(window);
  return !usableDisplays.some((display) =>
    isBoundsVisibleOnDisplay(bounds, display),
  );
};

export const watchDisplayAvailability = () => {
  let lastTopologyKey = "";
  let changeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const flushDisplayChange = () => {
    changeTimeoutId = null;

    const displays = screen.getAllDisplays();
    const nextTopologyKey = getDisplayTopologyKey(displays);
    if (nextTopologyKey === lastTopologyKey) {
      return;
    }

    lastTopologyKey = nextTopologyKey;
    const usableDisplays = displays.filter(isLikelyUsableDisplay);
    if (usableDisplays.length === 0) {
      return;
    }

    const fallbackDisplay = getFallbackDisplay(displays);
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!needsDisplayRescue(window, usableDisplays)) {
        return;
      }

      relocateWindowToDisplay(window, fallbackDisplay);
    });
  };

  const scheduleDisplayChangeCheck = () => {
    if (changeTimeoutId !== null) {
      clearTimeout(changeTimeoutId);
    }

    changeTimeoutId = setTimeout(flushDisplayChange, DISPLAY_CHANGE_SETTLE_MS);
  };

  screen.on("display-added", scheduleDisplayChangeCheck);
  screen.on("display-removed", scheduleDisplayChangeCheck);
  screen.on("display-metrics-changed", scheduleDisplayChangeCheck);

  const pollIntervalId =
    process.platform === "win32"
      ? setInterval(scheduleDisplayChangeCheck, WINDOWS_DISPLAY_POLL_MS)
      : null;

  scheduleDisplayChangeCheck();

  return () => {
    if (changeTimeoutId !== null) {
      clearTimeout(changeTimeoutId);
    }

    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
    }

    screen.removeListener("display-added", scheduleDisplayChangeCheck);
    screen.removeListener("display-removed", scheduleDisplayChangeCheck);
    screen.removeListener("display-metrics-changed", scheduleDisplayChangeCheck);
  };
};
