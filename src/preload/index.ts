import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/types/ipc";

const desktopApi: DesktopApi = {
  app: {
    getVersion: () => ipcRenderer.invoke("app:get-version"),
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
  },
  clipboard: {
    writeImageFromDataUrl: (payload) =>
      ipcRenderer.invoke("clipboard:write-image-data-url", payload),
  },
  import: {
    fetchRemoteImageDataUrl: (payload) =>
      ipcRenderer.invoke("import:fetch-remote-image-data-url", payload),
  },
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
