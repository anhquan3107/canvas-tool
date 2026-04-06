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
  surfaceOpacity?: number;
  showSwatches?: boolean;
  activeTool: ToolMode | null;
  doodleMode: DoodleMode;
  doodleColor: string;
  doodleSize: number;
  selectedItemIds: string[];
  cropSession: CropSession | null;
  onCropRectChange?: (rect: CropRect) => void;
  onSelectionChange: (itemIds: string[]) => void;
  onViewChange: (zoom: number, panX: number, panY: number) => void;
  onItemsPatch: (updates: Record<string, CanvasItemPatch>) => void;
  onAnnotationsChange: (annotations: AnnotationStroke[]) => void;
  onItemDoubleClick?: (itemId: string) => void;
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
  visualWidth: number;
  visualHeight: number;
}

export interface ActiveItemDragState {
  pointerId: number;
  itemId: string;
  itemLayer: Container;
  startPointer: { x: number; y: number };
  items: DragItemState[];
  patchBuffer: Record<string, CanvasItemPatch>;
  hasMoved: boolean;
  zIndexApplied: boolean;
}

export interface ActiveSelectionBoxState {
  pointerId: number;
  startClient: { x: number; y: number };
  additive: boolean;
  baseSelection: string[];
}

export interface ActiveAnnotationSessionState {
  pointerId: number;
  mode: DoodleMode;
  draftStroke: AnnotationStroke | null;
  annotations: AnnotationStroke[];
  lastPoint: { x: number; y: number };
  changed: boolean;
  outsideCanvas: boolean;
}

export interface CropRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CropSession {
  itemId: string;
  rect: CropRect;
}

export type TransformHandle = "nw" | "ne" | "se" | "sw";

export interface ActiveSelectionTransformState {
  handle: TransformHandle;
  anchor: { x: number; y: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  items: Array<{
    itemId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    resolvedScaleX: number;
    flippedX: boolean;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>;
  patchBuffer: Record<string, CanvasItemPatch>;
  hasChanged: boolean;
}
