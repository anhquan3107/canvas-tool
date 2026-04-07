import { contextBridge, ipcRenderer } from "electron";
import type {
  CaptureWindowFocusListener,
  DesktopApi,
  NativeMenuAction,
} from "../shared/types/ipc";

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
  },
  window: {
    setTitle: (payload) => ipcRenderer.invoke("window:set-title", payload),
    focus: () => ipcRenderer.invoke("window:focus"),
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleAlwaysOnTop: () => ipcRenderer.invoke("window:toggle-always-on-top"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    getControlsState: () => ipcRenderer.invoke("window:get-controls-state"),
    getPosition: () => ipcRenderer.invoke("window:get-position"),
    getPositionSync: () => ipcRenderer.sendSync("window:get-position-sync"),
    getBounds: () => ipcRenderer.invoke("window:get-bounds"),
    getBoundsSync: () => ipcRenderer.sendSync("window:get-bounds-sync"),
    setPosition: (payload) => ipcRenderer.invoke("window:set-position", payload),
    setPositionImmediate: (payload) =>
      ipcRenderer.send("window:set-position-immediate", payload),
    setBounds: (payload) => ipcRenderer.invoke("window:set-bounds", payload),
    setBoundsImmediate: (payload) =>
      ipcRenderer.send("window:set-bounds-immediate", payload),
    setIgnoreMouseEvents: (payload) =>
      ipcRenderer.invoke("window:set-ignore-mouse-events", payload),
    getOpacity: () => ipcRenderer.invoke("window:get-opacity"),
    setOpacity: (payload) => ipcRenderer.invoke("window:set-opacity", payload),
  },
  clipboard: {
    writeImageFromDataUrl: (payload) =>
      ipcRenderer.invoke("clipboard:write-image-data-url", payload),
  },
  import: {
    fetchRemoteImageDataUrl: (payload) =>
      ipcRenderer.invoke("import:fetch-remote-image-data-url", payload),
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
