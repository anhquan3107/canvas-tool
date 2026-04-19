import { contextBridge, ipcRenderer } from "electron";
import type {
  AppWindowBounds,
  CaptureWindowFocusListener,
  DesktopApi,
  NativeMenuAction,
  ProjectOperationProgress,
  AppWindowPosition,
} from "../shared/types/ipc";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const sanitizeWindowPosition = (
  payload: AppWindowPosition | null | undefined,
): AppWindowPosition | null => {
  if (
    payload == null ||
    !isFiniteNumber(payload.x) ||
    !isFiniteNumber(payload.y)
  ) {
    return null;
  }

  return {
    x: Math.round(payload.x),
    y: Math.round(payload.y),
  };
};

const sanitizeWindowBounds = (
  payload: AppWindowBounds | null | undefined,
): AppWindowBounds | null => {
  if (
    payload == null ||
    !isFiniteNumber(payload.x) ||
    !isFiniteNumber(payload.y) ||
    !isFiniteNumber(payload.width) ||
    !isFiniteNumber(payload.height)
  ) {
    return null;
  }

  return {
    x: Math.round(payload.x),
    y: Math.round(payload.y),
    width: Math.round(payload.width),
    height: Math.round(payload.height),
  };
};

const desktopApi: DesktopApi = {
  app: {
    getVersion: () => ipcRenderer.invoke("app:get-version"),
    getSettings: () => ipcRenderer.invoke("app:get-settings"),
    saveShortcutBindings: (bindings) =>
      ipcRenderer.invoke("app:save-shortcut-bindings", bindings),
    markTitleBarTooltipSeen: (tooltipId) =>
      ipcRenderer.invoke("app:mark-title-bar-tooltip-seen", tooltipId),
    resetTitleBarTooltips: () =>
      ipcRenderer.invoke("app:reset-title-bar-tooltips"),
    onNativeMenuAction: (listener) => {
      const handleAction = (
        _event: Electron.IpcRendererEvent,
        action: NativeMenuAction,
      ) => {
        listener(action);
      };

      ipcRenderer.on("native-menu:action", handleAction);

      return () => {
        ipcRenderer.removeListener("native-menu:action", handleAction);
      };
    },
    quit: () => ipcRenderer.invoke("app:quit"),
  },
  project: {
    create: () => ipcRenderer.invoke("project:create"),
    open: () => ipcRenderer.invoke("project:open"),
    save: (payload) => ipcRenderer.invoke("project:save", payload),
    saveAs: (payload) => ipcRenderer.invoke("project:save-as", payload),
    exportCanvasImage: (payload) =>
      ipcRenderer.invoke("project:export-canvas-image", payload),
    exportGroupImages: (payload) =>
      ipcRenderer.invoke("project:export-group-images", payload),
    exportTasksHtml: (payload) =>
      ipcRenderer.invoke("project:export-tasks-html", payload),
    exportTasksTxt: (payload) =>
      ipcRenderer.invoke("project:export-tasks-txt", payload),
    exportSwatchAco: (payload) =>
      ipcRenderer.invoke("project:export-swatch-aco", payload),
    importTasks: () => ipcRenderer.invoke("project:import-tasks"),
    getRecentFiles: () => ipcRenderer.invoke("project:get-recent-files"),
    onOperationProgress: (listener) => {
      const handleProgress = (
        _event: Electron.IpcRendererEvent,
        progress: ProjectOperationProgress,
      ) => {
        listener(progress);
      };

      ipcRenderer.on("project:operation-progress", handleProgress);

      return () => {
        ipcRenderer.removeListener("project:operation-progress", handleProgress);
      };
    },
  },
  window: {
    setTitle: (payload) => ipcRenderer.invoke("window:set-title", payload),
    focus: () => ipcRenderer.invoke("window:focus"),
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleAlwaysOnTop: () => ipcRenderer.invoke("window:toggle-always-on-top"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    getControlsState: () => ipcRenderer.invoke("window:get-controls-state"),
    getCursorScreenPointSync: () =>
      ipcRenderer.sendSync("window:get-cursor-screen-point-sync"),
    dipToScreenPointSync: (payload) => {
      const nextPayload = sanitizeWindowPosition(payload);
      if (!nextPayload) {
        return { x: 0, y: 0 };
      }

      return ipcRenderer.sendSync("window:dip-to-screen-point-sync", nextPayload);
    },
    screenToDipPointSync: (payload) => {
      const nextPayload = sanitizeWindowPosition(payload);
      if (!nextPayload) {
        return { x: 0, y: 0 };
      }

      return ipcRenderer.sendSync("window:screen-to-dip-point-sync", nextPayload);
    },
    dipToScreenRectSync: (payload) => {
      const nextPayload = sanitizeWindowBounds(payload);
      if (!nextPayload) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      return ipcRenderer.sendSync("window:dip-to-screen-rect-sync", nextPayload);
    },
    screenToDipRectSync: (payload) => {
      const nextPayload = sanitizeWindowBounds(payload);
      if (!nextPayload) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      return ipcRenderer.sendSync("window:screen-to-dip-rect-sync", nextPayload);
    },
    getPosition: () => ipcRenderer.invoke("window:get-position"),
    getPositionSync: () => ipcRenderer.sendSync("window:get-position-sync"),
    getBounds: () => ipcRenderer.invoke("window:get-bounds"),
    getBoundsSync: () => ipcRenderer.sendSync("window:get-bounds-sync"),
    setPosition: (payload) => {
      const nextPayload = sanitizeWindowPosition(payload);
      if (!nextPayload) {
        return Promise.resolve();
      }

      return ipcRenderer.invoke("window:set-position", nextPayload);
    },
    setPositionImmediate: (payload) => {
      const nextPayload = sanitizeWindowPosition(payload);
      if (!nextPayload) {
        return;
      }

      ipcRenderer.send("window:set-position-immediate", nextPayload);
    },
    setBounds: (payload) => {
      const nextPayload = sanitizeWindowBounds(payload);
      if (!nextPayload) {
        return Promise.resolve();
      }

      return ipcRenderer.invoke("window:set-bounds", nextPayload);
    },
    setBoundsSync: (payload) => {
      const nextPayload = sanitizeWindowBounds(payload);
      if (!nextPayload) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      return ipcRenderer.sendSync("window:set-bounds-sync", nextPayload);
    },
    setBoundsImmediate: (payload) => {
      const nextPayload = sanitizeWindowBounds(payload);
      if (!nextPayload) {
        return;
      }

      ipcRenderer.send("window:set-bounds-immediate", nextPayload);
    },
    setIgnoreMouseEvents: (payload) =>
      ipcRenderer.invoke("window:set-ignore-mouse-events", payload),
    getOpacity: () => ipcRenderer.invoke("window:get-opacity"),
    setOpacity: (payload) => ipcRenderer.invoke("window:set-opacity", payload),
  },
  clipboard: {
    writeImageFromDataUrl: (payload) =>
      ipcRenderer.invoke("clipboard:write-image-data-url", payload),
    readImageAsDataUrl: () => ipcRenderer.invoke("clipboard:read-image-data-url"),
  },
  import: {
    fetchRemoteImageDataUrl: (payload) =>
      ipcRenderer.invoke("import:fetch-remote-image-data-url", payload),
    convertImageToDotGain20DataUrl: (payload) =>
      ipcRenderer.invoke("import:convert-image-dot-gain-20-data-url", payload),
    getDotGain20TransferTable: () =>
      ipcRenderer.invoke("import:get-dot-gain-20-transfer-table"),
    getDotGain20CaptureLookupTable: () =>
      ipcRenderer.invoke("import:get-dot-gain-20-capture-lookup-table"),
    extractImageSwatches: (payload) =>
      ipcRenderer.invoke("import:extract-image-swatches", payload),
  },
  capture: {
    listSources: () => ipcRenderer.invoke("capture:list-sources"),
    openWindow: (payload) => ipcRenderer.invoke("capture:open-window", payload),
    updateWindowAspect: (payload) =>
      ipcRenderer.invoke("capture:update-window-aspect", payload),
    setToolbarVisibility: (payload) =>
      ipcRenderer.invoke("capture:set-toolbar-visibility", payload),
    onWindowFocusChanged: (listener: CaptureWindowFocusListener) => {
      const handleFocusChanged = (
        _event: Electron.IpcRendererEvent,
        focused: boolean,
      ) => {
        listener(focused);
      };

      ipcRenderer.on("capture:window-focus-changed", handleFocusChanged);

      return () => {
        ipcRenderer.removeListener(
          "capture:window-focus-changed",
          handleFocusChanged,
        );
      };
    },
  },
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
