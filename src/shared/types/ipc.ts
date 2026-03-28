import type { Project } from "./project";
import type { CaptureItem } from "./project";

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

export interface SwatchExportRequest {
  swatches: Array<{
    colorHex: string;
    name?: string;
  }>;
  name?: string;
}

export interface AppWindowState {
  title: string;
  fileName?: string;
}

export interface AppWindowControlsState {
  isMaximized: boolean;
  isAlwaysOnTop: boolean;
}

export interface ClipboardWriteImageRequest {
  dataUrl: string;
}

export interface RemoteImageFetchRequest {
  url: string;
}

export interface DesktopCaptureSource {
  id: string;
  name: string;
  kind: "window" | "screen";
  thumbnailDataUrl: string | null;
  appIconDataUrl: string | null;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

export interface DesktopCaptureStreamRequest {
  sourceId: string;
  sourceName: string;
  quality: CaptureItem["quality"];
}

export interface OpenCaptureWindowRequest {
  sourceId: string;
  sourceName: string;
  quality: CaptureItem["quality"];
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface DesktopApi {
  app: {
    getVersion: () => Promise<string>;
    quit: () => Promise<void>;
  };
  project: {
    create: () => Promise<Project>;
    open: () => Promise<ProjectOpenResult | null>;
    save: (payload: ProjectSaveRequest) => Promise<ProjectSaveResult>;
    saveAs: (payload: ProjectSaveRequest) => Promise<ProjectSaveResult | null>;
    exportSwatchAco: (
      payload: SwatchExportRequest,
    ) => Promise<ProjectExportResult | null>;
    getRecentFiles: () => Promise<string[]>;
  };
  window: {
    setTitle: (payload: AppWindowState) => Promise<void>;
    minimize: () => Promise<void>;
    toggleAlwaysOnTop: () => Promise<AppWindowControlsState>;
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
  capture: {
    listSources: () => Promise<DesktopCaptureSource[]>;
    openWindow: (payload: OpenCaptureWindowRequest) => Promise<void>;
  };
}
