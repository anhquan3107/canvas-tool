import {
  BrowserWindow,
  screen,
  type Display,
  type Rectangle,
} from "electron";
import type { AppSettings, WindowBoundsSnapshot } from "../shared/types/project";
import {
  readSettings,
  sanitizeWindowPlacementSettings,
  writeSettings,
} from "./services/app-settings-service";

const WINDOW_STATE_SAVE_DELAY_MS = 180;
const MIN_VISIBLE_SIZE = 80;

export interface WindowPlacementDefaults {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

interface RestoredWindowPlacement {
  bounds?: Rectangle;
  isMaximized: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const isLikelyUsableDisplay = (display: Display) => {
  if (display.detected === false) {
    return false;
  }

  if (
    display.workArea.width < MIN_VISIBLE_SIZE ||
    display.workArea.height < MIN_VISIBLE_SIZE
  ) {
    return false;
  }

  // Inference: on some Windows setups a powered-off external monitor can still
  // remain in the display list, but report no meaningful refresh rate.
  if (!display.internal && display.displayFrequency <= 1) {
    return false;
  }

  return true;
};

const getDisplayLayoutKey = (displays: Display[]) =>
  displays
    .filter(isLikelyUsableDisplay)
    .map((display) => {
      return getDisplaySnapshotKey(display);
    })
    .sort()
    .join("|");

const getDisplaySnapshotKey = (display: Display) => {
  const { x, y, width, height } = display.bounds;
  const {
    x: workX,
    y: workY,
    width: workWidth,
    height: workHeight,
  } = display.workArea;

  return `${x},${y},${width},${height}:${workX},${workY},${workWidth},${workHeight}:${display.scaleFactor}:${display.rotation}`;
};

const toPlacement = (
  bounds: Rectangle,
  isMaximized: boolean,
  display: Display,
): WindowBoundsSnapshot => ({
  x: Math.round(bounds.x),
  y: Math.round(bounds.y),
  width: Math.round(bounds.width),
  height: Math.round(bounds.height),
  isMaximized,
  displayId: display.id,
  displayKey: getDisplaySnapshotKey(display),
});

const getVisibleArea = (bounds: Rectangle, workArea: Rectangle) => {
  const overlapWidth =
    Math.min(bounds.x + bounds.width, workArea.x + workArea.width) -
    Math.max(bounds.x, workArea.x);
  const overlapHeight =
    Math.min(bounds.y + bounds.height, workArea.y + workArea.height) -
    Math.max(bounds.y, workArea.y);

  return {
    width: Math.max(0, overlapWidth),
    height: Math.max(0, overlapHeight),
  };
};

export const isBoundsVisibleOnDisplay = (bounds: Rectangle, display: Display) => {
  const visible = getVisibleArea(bounds, display.workArea);
  return (
    visible.width >= MIN_VISIBLE_SIZE && visible.height >= MIN_VISIBLE_SIZE
  );
};

export const fitBoundsIntoDisplay = (
  bounds: Rectangle,
  display: Display,
  defaults: WindowPlacementDefaults,
): Rectangle => {
  const workArea = display.workArea;
  const width = clamp(bounds.width, defaults.minWidth, workArea.width);
  const height = clamp(bounds.height, defaults.minHeight, workArea.height);
  const x = clamp(bounds.x, workArea.x, workArea.x + workArea.width - width);
  const y = clamp(bounds.y, workArea.y, workArea.y + workArea.height - height);

  return { x, y, width, height };
};

const centerBoundsOnDisplay = (
  display: Display,
  defaults: WindowPlacementDefaults,
): Rectangle => {
  const workArea = display.workArea;
  const width = Math.min(defaults.width, workArea.width);
  const height = Math.min(defaults.height, workArea.height);

  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
  };
};

const resolvePlacementBounds = (
  saved: WindowBoundsSnapshot,
  displays: Display[],
  defaults: WindowPlacementDefaults,
) => {
  const rawBounds: Rectangle = {
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
  };
  const savedDisplayById =
    typeof saved.displayId === "number"
      ? displays.find(
          (display) =>
            display.id === saved.displayId && isLikelyUsableDisplay(display),
        )
      : undefined;

  if (savedDisplayById) {
    const savedDisplayMatchesState =
      !saved.displayKey ||
      getDisplaySnapshotKey(savedDisplayById) === saved.displayKey;

    if (
      savedDisplayMatchesState ||
      isBoundsVisibleOnDisplay(rawBounds, savedDisplayById)
    ) {
      return fitBoundsIntoDisplay(rawBounds, savedDisplayById, defaults);
    }
  }

  const activeDisplays = displays.filter(isLikelyUsableDisplay);
  const visibleDisplay = activeDisplays.find((display) =>
    isBoundsVisibleOnDisplay(rawBounds, display),
  );

  if (visibleDisplay) {
    return fitBoundsIntoDisplay(rawBounds, visibleDisplay, defaults);
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const fallbackDisplay =
    (isLikelyUsableDisplay(primaryDisplay) ? primaryDisplay : activeDisplays[0]) ??
    primaryDisplay;

  return fitBoundsIntoDisplay(rawBounds, fallbackDisplay, defaults);
};

export const getRestoredMainWindowPlacement = async (
  defaults: WindowPlacementDefaults,
): Promise<RestoredWindowPlacement> => {
  const settings = await readSettings();
  const displays = screen.getAllDisplays();
  const layoutKey = getDisplayLayoutKey(displays);
  const placementSettings = sanitizeWindowPlacementSettings(
    settings.windowPlacement,
  );
  const savedPlacement =
    placementSettings?.layouts?.[layoutKey] ?? placementSettings?.lastBounds;

  if (!savedPlacement) {
    return { isMaximized: false };
  }

  return {
    bounds: resolvePlacementBounds(savedPlacement, displays, defaults),
    isMaximized: savedPlacement.isMaximized === true,
  };
};

const buildNextSettings = (
  settings: AppSettings,
  layoutKey: string,
  placement: WindowBoundsSnapshot,
): AppSettings => ({
  ...settings,
  windowPlacement: {
    ...(sanitizeWindowPlacementSettings(settings.windowPlacement) ?? {}),
    lastBounds: placement,
    layouts: {
      ...(sanitizeWindowPlacementSettings(settings.windowPlacement)?.layouts ?? {}),
      [layoutKey]: placement,
    },
  },
});

export const watchMainWindowPlacement = (window: BrowserWindow) => {
  let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastSerializedPlacement = "";

  const persistPlacement = async () => {
    if (window.isDestroyed()) {
      return;
    }

    const currentDisplays = screen.getAllDisplays();
    const layoutKey = getDisplayLayoutKey(currentDisplays);
    const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
    const placementDisplay = screen.getDisplayMatching(bounds);
    const placement = toPlacement(
      bounds,
      window.isMaximized(),
      placementDisplay,
    );
    const serializedPlacement = `${layoutKey}:${JSON.stringify(placement)}`;

    if (serializedPlacement === lastSerializedPlacement) {
      return;
    }

    lastSerializedPlacement = serializedPlacement;
    const settings = await readSettings();
    await writeSettings(buildNextSettings(settings, layoutKey, placement));
  };

  const schedulePersist = () => {
    if (saveTimeoutId !== null) {
      clearTimeout(saveTimeoutId);
    }

    saveTimeoutId = setTimeout(() => {
      saveTimeoutId = null;
      void persistPlacement();
    }, WINDOW_STATE_SAVE_DELAY_MS);
  };

  window.on("move", schedulePersist);
  window.on("resize", schedulePersist);
  window.on("maximize", schedulePersist);
  window.on("unmaximize", schedulePersist);
  window.on("close", () => {
    if (saveTimeoutId !== null) {
      clearTimeout(saveTimeoutId);
      saveTimeoutId = null;
    }
    void persistPlacement();
  });
  window.on("closed", () => {
    if (saveTimeoutId !== null) {
      clearTimeout(saveTimeoutId);
    }
  });
};
