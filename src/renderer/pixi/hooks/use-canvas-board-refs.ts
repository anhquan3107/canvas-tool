import { useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import type { ReferenceGroup } from "@shared/types/project";
import { ZERO_INSETS } from "@renderer/pixi/constants";
import type {
  ActiveAnnotationSessionState,
  ActiveItemDragState,
  ActiveSelectionBoxState,
  ActiveSelectionTransformState,
  CanvasBoardProps,
  CropRect,
  CropSession,
  TransformHandle,
} from "@renderer/pixi/types";

export interface FrameMeta {
  width: number;
  height: number;
  isCapture: boolean;
}

interface UseCanvasBoardRefsOptions
  extends Pick<
    CanvasBoardProps,
    | "group"
    | "surfaceOpacity"
    | "showSwatches"
    | "activeTool"
    | "doodleMode"
    | "doodleColor"
    | "doodleSize"
    | "selectedItemIds"
    | "cropSession"
    | "onSelectionChange"
    | "onViewChange"
    | "onItemsPatch"
    | "onAnnotationsChange"
    | "onItemDoubleClick"
    | "onCanvasSizePreviewChange"
    | "onExportReady"
  > {}

export const useCanvasBoardRefs = ({
  group,
  surfaceOpacity = 1,
  showSwatches = true,
  activeTool,
  doodleMode,
  doodleColor,
  doodleSize,
  selectedItemIds,
  cropSession,
  onSelectionChange,
  onViewChange,
  onItemsPatch,
  onAnnotationsChange,
  onItemDoubleClick,
  onCanvasSizePreviewChange,
  onExportReady,
}: UseCanvasBoardRefsOptions) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cursorOverlayRef = useRef<HTMLDivElement | null>(null);
  const selectionMarqueeRef = useRef<HTMLDivElement | null>(null);
  const selectedBoundsOverlayRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardContainerRef = useRef<Container | null>(null);
  const boardGraphicRef = useRef<Graphics | null>(null);
  const gridGraphicRef = useRef<Graphics | null>(null);
  const itemLayerRef = useRef<Container | null>(null);
  const annotationMaskRef = useRef<Graphics | null>(null);
  const annotationLayerRef = useRef<Graphics | null>(null);
  const annotationPreviewLayerRef = useRef<Graphics | null>(null);
  const frameByIdRef = useRef(new Map<string, Graphics>());
  const itemNodeByIdRef = useRef(new Map<string, Container>());
  const frameMetaByIdRef = useRef(new Map<string, FrameMeta>());
  const selectionIdsRef = useRef(selectedItemIds);
  const groupRef = useRef(group);
  const surfaceOpacityRef = useRef(surfaceOpacity);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onItemsPatchRef = useRef(onItemsPatch);
  const onViewChangeRef = useRef(onViewChange);
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  const onItemDoubleClickRef = useRef(onItemDoubleClick);
  const onCanvasSizePreviewChangeRef = useRef(onCanvasSizePreviewChange);
  const onExportReadyRef = useRef(onExportReady);
  const activeToolRef = useRef(activeTool);
  const showSwatchesRef = useRef(showSwatches);
  const doodleModeRef = useRef(doodleMode);
  const doodleColorRef = useRef(doodleColor);
  const doodleSizeRef = useRef(doodleSize);
  const renderTokenRef = useRef(0);
  const viewCommitTimerRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const activePanPointerIdRef = useRef<number | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const cancelWheelZoomAnimationRef = useRef<(() => void) | null>(null);
  const previewInsetsRef = useRef(ZERO_INSETS);
  const activeItemDragRef = useRef<ActiveItemDragState | null>(null);
  const activeSelectionTransformRef =
    useRef<ActiveSelectionTransformState | null>(null);
  const activeSelectionBoxRef = useRef<ActiveSelectionBoxState | null>(null);
  const activeAnnotationSessionRef =
    useRef<ActiveAnnotationSessionState | null>(null);
  const activeCropHandleRef = useRef<{
    handle: TransformHandle;
    startRect: CropRect;
    imageBounds: { minX: number; minY: number; maxX: number; maxY: number };
  } | null>(null);
  const updateSelectedBoundsOverlayRef = useRef<() => void>(() => {});
  const spacePanActiveRef = useRef(false);
  const lastPointerClientRef = useRef<{
    clientX: number;
    clientY: number;
    pointerType: string;
    pressure: number;
    buttons: number;
  } | null>(null);
  const lastItemPressRef = useRef<{ itemId: string; time: number } | null>(null);
  const cropSessionRef = useRef<CropSession | null>(cropSession);

  return {
    hostRef,
    cursorOverlayRef,
    selectionMarqueeRef,
    selectedBoundsOverlayRef,
    appRef,
    boardContainerRef,
    boardGraphicRef,
    gridGraphicRef,
    itemLayerRef,
    annotationMaskRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    frameByIdRef,
    itemNodeByIdRef,
    frameMetaByIdRef,
    selectionIdsRef,
    groupRef,
    surfaceOpacityRef,
    onSelectionChangeRef,
    onItemsPatchRef,
    onViewChangeRef,
    onAnnotationsChangeRef,
    onItemDoubleClickRef,
    onCanvasSizePreviewChangeRef,
    onExportReadyRef,
    activeToolRef,
    showSwatchesRef,
    doodleModeRef,
    doodleColorRef,
    doodleSizeRef,
    renderTokenRef,
    viewCommitTimerRef,
    isPanningRef,
    activePanPointerIdRef,
    panStartRef,
    panOriginRef,
    cancelWheelZoomAnimationRef,
    previewInsetsRef,
    activeItemDragRef,
    activeSelectionTransformRef,
    activeSelectionBoxRef,
    activeAnnotationSessionRef,
    activeCropHandleRef,
    updateSelectedBoundsOverlayRef,
    spacePanActiveRef,
    lastPointerClientRef,
    lastItemPressRef,
    cropSessionRef,
  };
};
