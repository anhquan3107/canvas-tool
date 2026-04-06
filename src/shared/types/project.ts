import type { ShortcutActionId } from "../shortcuts";

export type LayoutMode = "pinterest-dynamic" | "horizontal";

export interface Project {
  id: string;
  version: number;
  filePath?: string;
  title: string;
  canvasSize: CanvasSize;
  activeGroupId: string;
  groups: ReferenceGroup[];
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  recentFiles: string[];
  lastOpenedFile?: string;
  lastExportPath?: string;
  maxRecentFiles: number;
  windowOpacity?: number;
  windowPlacement?: WindowPlacementSettings;
  shortcuts?: Partial<Record<ShortcutActionId, string>>;
  seenTitleBarTooltips?: string[];
}

export interface WindowBoundsSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

export interface WindowPlacementSettings {
  lastBounds?: WindowBoundsSnapshot;
  layouts?: Record<string, WindowBoundsSnapshot>;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface ReferenceGroup {
  id: string;
  name: string;
  kind: "canvas" | "group";
  order: number;
  locked: boolean;
  canvasColor: string;
  backgroundColor: string;
  canvasSize: CanvasSize;
  zoom: number;
  panX: number;
  panY: number;
  layoutMode: LayoutMode;
  filters: GroupFilters;
  items: CanvasItem[];
  annotations: AnnotationStroke[];
  extractedSwatches: ColorSwatch[];
}

export interface GroupFilters {
  blur: number;
  grayscale: number;
}

export type CanvasItem = ImageItem | CaptureItem;

export interface CanvasItemBase {
  id: string;
  type: "image" | "capture";
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  width: number;
  height: number;
  flippedX: boolean;
  locked: boolean;
  visible: boolean;
  zIndex: number;
}

export interface ImageItem extends CanvasItemBase {
  type: "image";
  assetPath?: string;
  source: "local" | "web" | "clipboard";
  label?: string;
  originalWidth?: number;
  originalHeight?: number;
  fileSizeBytes?: number;
  format?: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  previewStatus?: "ready" | "blocked";
  swatchHex?: string;
  swatches?: ColorSwatch[];
}

export interface CaptureItem extends CanvasItemBase {
  type: "capture";
  sourceId: string;
  sourceName: string;
  quality: "low" | "medium" | "high";
  blur: number;
  grayscale: number;
  refreshMs: number;
}

export interface AnnotationStroke {
  id: string;
  points: number[];
  pressures?: number[];
  color: string;
  size: number;
  tool: "brush" | "eraser";
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  order: number;
  completed?: boolean;
  startDate?: string;
  endDate?: string;
  linkedGroupId?: string;
  todos: TodoItem[];
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
}

export interface ColorSwatch {
  id: string;
  colorHex: string;
  origin: "image" | "group";
  label?: string;
}
