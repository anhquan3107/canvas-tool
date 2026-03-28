import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/types/ipc";

const desktopApi: DesktopApi = {
  app: {
    getVersion: () => ipcRenderer.invoke("app:get-version"),
    quit: () => ipcRenderer.invoke("app:quit"),
  },
  project: {
    create: () => ipcRenderer.invoke("project:create"),
    open: () => ipcRenderer.invoke("project:open"),
    save: (payload) => ipcRenderer.invoke("project:save", payload),
    saveAs: (payload) => ipcRenderer.invoke("project:save-as", payload),
    getRecentFiles: () => ipcRenderer.invoke("project:get-recent-files"),
  },
  window: {
    setTitle: (payload) => ipcRenderer.invoke("window:set-title", payload),
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleAlwaysOnTop: () => ipcRenderer.invoke("window:toggle-always-on-top"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    getControlsState: () => ipcRenderer.invoke("window:get-controls-state"),
  },
  clipboard: {
    writeImageFromDataUrl: (payload) =>
      ipcRenderer.invoke("clipboard:write-image-data-url", payload),
  },
  import: {
    fetchRemoteImageDataUrl: (payload) =>
      ipcRenderer.invoke("import:fetch-remote-image-data-url", payload),
  },
  capture: {
    listSources: () => ipcRenderer.invoke("capture:list-sources"),
    openWindow: (payload) => ipcRenderer.invoke("capture:open-window", payload),
  },
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
