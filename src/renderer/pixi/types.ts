import type { Container, Texture } from "pixi.js";
import type {
  AnnotationStroke,
  CaptureItem,
  CanvasItemBase,
  ReferenceGroup,
} from "@shared/types/project";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";

export type CanvasItemPatch = Partial<Omit<CanvasItemBase, "id" | "type">>;

export interface CanvasInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CanvasSizePreview {
  width: number;
  height: number;
}

export interface CanvasBoardProps {
  group: ReferenceGroup;
  activeTool: ToolMode | null;
  snapEnabled: boolean;
  doodleMode: DoodleMode;
  doodleColor: string;
  doodleSize: number;
  selectedItemIds: string[];
  onSelectionChange: (itemIds: string[]) => void;
  onViewChange: (zoom: number, panX: number, panY: number) => void;
  onItemsPatch: (updates: Record<string, CanvasItemPatch>) => void;
  onAnnotationsChange: (annotations: AnnotationStroke[]) => void;
  onCanvasSizePreviewChange?: (size: CanvasSizePreview | null) => void;
  onExportReady?: (exportCanvas: (() => string | null) | null) => void;
}

export interface CaptureSession {
  sourceId: string;
  quality: CaptureItem["quality"];
  stream: MediaStream;
  video: HTMLVideoElement;
  texture: Texture;
}

export interface DragItemState {
  itemId: string;
  itemNode: Container;
  startPos: { x: number; y: number };
  width: number;
  height: number;
}

export interface ActiveItemDragState {
  itemId: string;
  itemLayer: Container;
  startPointer: { x: number; y: number };
  items: DragItemState[];
  patchBuffer: Record<string, CanvasItemPatch>;
  hasMoved: boolean;
  zIndexApplied: boolean;
}

export interface ActiveSelectionBoxState {
  startClient: { x: number; y: number };
  additive: boolean;
  baseSelection: string[];
}

export interface ActiveAnnotationSessionState {
  mode: DoodleMode;
  draftStroke: AnnotationStroke | null;
  annotations: AnnotationStroke[];
  lastPoint: { x: number; y: number };
  changed: boolean;
}
