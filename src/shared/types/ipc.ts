import type { Project } from "./project";

export interface ProjectOpenResult {
  project: Project;
  filePath: string;
}

export interface ProjectSaveRequest {
  project: Project;
  filePath?: string;
}

export interface ProjectSaveResult {
  filePath: string;
}

export interface ProjectExportResult {
  filePath: string;
}

export interface AppWindowState {
  title: string;
  fileName?: string;
}

export interface AppWindowControlsState {
  isMaximized: boolean;
}

export interface ClipboardWriteImageRequest {
  dataUrl: string;
}

export interface RemoteImageFetchRequest {
  url: string;
}

export interface DesktopApi {
  app: {
    getVersion: () => Promise<string>;
  };
  project: {
    create: () => Promise<Project>;
    open: () => Promise<ProjectOpenResult | null>;
    save: (payload: ProjectSaveRequest) => Promise<ProjectSaveResult>;
    saveAs: (payload: ProjectSaveRequest) => Promise<ProjectSaveResult | null>;
    getRecentFiles: () => Promise<string[]>;
  };
  window: {
    setTitle: (payload: AppWindowState) => Promise<void>;
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<AppWindowControlsState>;
    close: () => Promise<void>;
    getControlsState: () => Promise<AppWindowControlsState>;
  };
  clipboard: {
    writeImageFromDataUrl: (
      payload: ClipboardWriteImageRequest,
    ) => Promise<boolean>;
  };
  import: {
    fetchRemoteImageDataUrl: (
      payload: RemoteImageFetchRequest,
    ) => Promise<string | null>;
  };
}
