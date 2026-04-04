import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, NativeMenuAction } from "../shared/types/ipc";

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
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleAlwaysOnTop: () => ipcRenderer.invoke("window:toggle-always-on-top"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    getControlsState: () => ipcRenderer.invoke("window:get-controls-state"),
    getPosition: () => ipcRenderer.invoke("window:get-position"),
    setPosition: (payload) => ipcRenderer.invoke("window:set-position", payload),
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
  },
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
