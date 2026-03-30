import type { Project, Task } from "./project";
import type { CaptureItem } from "./project";
import type { AppSettings } from "./project";
import type { ShortcutBindings } from "../shortcuts";

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

export interface CanvasImageExportRequest {
  dataUrl: string;
  name?: string;
}

export interface GroupImagesExportRequest {
  images: Array<{
    assetPath: string;
    label?: string;
  }>;
  groupName?: string;
}

export interface TasksHtmlExportRequest {
  projectTitle: string;
  tasks: Task[];
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

export interface ImageSwatchExtractRequest {
  source: string;
  colorCount?: number;
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
  sourceKind?: DesktopCaptureSource["kind"];
  quality: CaptureItem["quality"];
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface DesktopApi {
  app: {
    getVersion: () => Promise<string>;
    getSettings: () => Promise<AppSettings>;
    saveShortcutBindings: (
      bindings: ShortcutBindings,
    ) => Promise<ShortcutBindings>;
    markTitleBarTooltipSeen: (tooltipId: string) => Promise<string[]>;
    resetTitleBarTooltips: () => Promise<string[]>;
    quit: () => Promise<void>;
  };
  project: {
    create: () => Promise<Project>;
    open: () => Promise<ProjectOpenResult | null>;
    save: (payload: ProjectSaveRequest) => Promise<ProjectSaveResult>;
    saveAs: (payload: ProjectSaveRequest) => Promise<ProjectSaveResult | null>;
    exportCanvasImage: (
      payload: CanvasImageExportRequest,
    ) => Promise<ProjectExportResult | null>;
    exportGroupImages: (
      payload: GroupImagesExportRequest,
    ) => Promise<ProjectExportResult | null>;
    exportTasksHtml: (
      payload: TasksHtmlExportRequest,
    ) => Promise<ProjectExportResult | null>;
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
    extractImageSwatches: (
      payload: ImageSwatchExtractRequest,
    ) => Promise<
      Array<{
        id: string;
        colorHex: string;
        origin: "image";
        label?: string;
      }>
    >;
  };
  capture: {
    listSources: () => Promise<DesktopCaptureSource[]>;
    openWindow: (payload: OpenCaptureWindowRequest) => Promise<void>;
  };
}
