import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Application,
  Container,
  Graphics,
  Rectangle,
} from "pixi.js";
import type { CanvasItem, CaptureItem, ImageItem } from "@shared/types/project";
import { useCaptureSessions } from "@renderer/pixi/hooks/use-capture-sessions";
import { useCanvasBoardAnnotations } from "@renderer/pixi/hooks/use-canvas-board-annotations";
import { useCanvasBoardBootstrap } from "@renderer/pixi/hooks/use-canvas-board-bootstrap";
import { useCanvasBoardDrag } from "@renderer/pixi/hooks/use-canvas-board-drag";
import { useCanvasBoardScene } from "@renderer/pixi/hooks/use-canvas-board-scene";
import { useCanvasBoardTransform } from "@renderer/pixi/hooks/use-canvas-board-transform";
import { useCanvasBoardView } from "@renderer/pixi/hooks/use-canvas-board-view";
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
import { drawItemFrame } from "@renderer/pixi/utils/item-frame";

const SELECTION_DIM_ALPHA = 0.34;
const SELECTION_HIGHLIGHT_NAME = "selection-highlight";

export const CanvasBoard = ({
  group,
  activeTool,
  doodleMode,
  doodleColor,
  doodleSize,
  selectedItemIds,
  cropSession,
  onCropRectChange,
  onSelectionChange,
  onViewChange,
  onItemsPatch,
  onAnnotationsChange,
  onItemDoubleClick,
  onCanvasSizePreviewChange,
  onExportReady,
}: CanvasBoardProps) => {
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
  const frameMetaByIdRef = useRef(
    new Map<string, { width: number; height: number; isCapture: boolean }>(),
  );
  const { captureSessionByIdRef, stopCaptureSession, ensureCaptureSession } =
    useCaptureSessions();
  const selectionIdsRef = useRef(selectedItemIds);
  const groupRef = useRef(group);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onItemsPatchRef = useRef(onItemsPatch);
  const onViewChangeRef = useRef(onViewChange);
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  const onItemDoubleClickRef = useRef(onItemDoubleClick);
  const onCanvasSizePreviewChangeRef = useRef(onCanvasSizePreviewChange);
  const onExportReadyRef = useRef(onExportReady);
  const activeToolRef = useRef(activeTool);
  const doodleModeRef = useRef(doodleMode);
  const doodleColorRef = useRef(doodleColor);
  const doodleSizeRef = useRef(doodleSize);
  const renderTokenRef = useRef(0);
  const viewCommitTimerRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
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
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);
  const lastItemPressRef = useRef<{ itemId: string; time: number } | null>(null);
  const cropSessionRef = useRef<CropSession | null>(cropSession);
  const [appReady, setAppReady] = useState(false);
  const boardFilter = `blur(${group.filters.blur}px) grayscale(${group.filters.grayscale}%)`;

  useEffect(() => {
    selectionIdsRef.current = selectedItemIds;
    frameByIdRef.current.forEach((frame, id) => {
      const meta = frameMetaByIdRef.current.get(id);
      if (!meta) {
        return;
      }

      drawItemFrame(
        frame,
        meta.width,
        meta.height,
        meta.isCapture,
        selectedItemIds.includes(id),
      );
    });

    itemNodeByIdRef.current.forEach((itemNode, id) => {
      const hasSelection = selectedItemIds.length > 0;
      const isSelected = selectedItemIds.includes(id);
      itemNode.alpha = hasSelection ? (isSelected ? 1 : SELECTION_DIM_ALPHA) : 1;

      const highlightOverlay = itemNode.getChildByName(
        SELECTION_HIGHLIGHT_NAME,
      ) as Graphics | null;
      if (!highlightOverlay) {
        return;
      }

      highlightOverlay.alpha = hasSelection && isSelected ? 0.08 : 0;
      highlightOverlay.visible = !hasSelection || isSelected;
    });
  }, [selectedItemIds]);

  useEffect(() => {
    groupRef.current = group;
  }, [group]);

  useEffect(() => {
    cropSessionRef.current = cropSession;
  }, [cropSession]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onItemsPatchRef.current = onItemsPatch;
  }, [onItemsPatch]);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    onAnnotationsChangeRef.current = onAnnotationsChange;
  }, [onAnnotationsChange]);

  useEffect(() => {
    onItemDoubleClickRef.current = onItemDoubleClick;
  }, [onItemDoubleClick]);

  useEffect(() => {
    onCanvasSizePreviewChangeRef.current = onCanvasSizePreviewChange;
  }, [onCanvasSizePreviewChange]);

  useEffect(() => {
    onExportReadyRef.current = onExportReady;
  }, [onExportReady]);

  useEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== "doodle") {
      hideDoodleCursor();
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [activeTool]);

  useEffect(() => {
    doodleModeRef.current = doodleMode;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [doodleMode]);

  useEffect(() => {
    doodleColorRef.current = doodleColor;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [doodleColor]);

  useEffect(() => {
    doodleSizeRef.current = doodleSize;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [doodleSize]);

  const {
    hideDoodleCursor,
    hideSelectionMarquee,
    hideSelectedBoundsOverlay,
    updateDoodleCursor,
    drawBoardSurface,
    setPreviewInsets,
    commitView,
    scheduleViewCommit,
    syncViewFromGroup,
    clientPointToCanvas,
    updateSelectedBoundsOverlay,
    updateSelectionMarquee,
  } = useCanvasBoardView({
    hostRef,
    cursorOverlayRef,
    selectionMarqueeRef,
    selectedBoundsOverlayRef,
    boardContainerRef,
    boardGraphicRef,
    annotationMaskRef,
    itemNodeByIdRef,
    groupRef,
    selectionIdsRef,
    activeItemDragRef,
    activeSelectionBoxRef,
    onSelectionChangeRef,
    onViewChangeRef,
    onCanvasSizePreviewChangeRef,
    viewCommitTimerRef,
    previewInsetsRef,
    activeToolRef,
    doodleModeRef,
    doodleColorRef,
    doodleSizeRef,
    lastPointerClientRef,
    activeSelectionTransformRef,
    cropSessionRef,
  });

  const { handleTransformHandlePointerDown } = useCanvasBoardTransform({
    hostRef,
    boardContainerRef,
    itemNodeByIdRef,
    groupRef,
    selectedItemIds,
    cropSessionRef,
    activeSelectionTransformRef,
    activeCropHandleRef,
    previewInsetsRef,
    setPreviewInsets,
    updateSelectedBoundsOverlayRef,
    onCanvasSizePreviewChangeRef,
    onItemsPatchRef,
    onCropRectChange,
  });

  useEffect(() => {
    updateSelectedBoundsOverlayRef.current = updateSelectedBoundsOverlay;
  }, [updateSelectedBoundsOverlay]);

  const {
    redrawAnnotations,
    startAnnotationSession,
    updateAnnotationSession,
    commitAnnotationSession,
    cancelAnnotationSession,
  } = useCanvasBoardAnnotations({
    annotationLayerRef,
    annotationPreviewLayerRef,
    groupRef,
    selectionIdsRef,
    onSelectionChangeRef,
    onAnnotationsChangeRef,
    activeAnnotationSessionRef,
    doodleModeRef,
    doodleColorRef,
    doodleSizeRef,
    clientPointToCanvas,
  });

  const { updateDraggedItemPosition, commitDraggedItemPatch } =
    useCanvasBoardDrag({
      activeItemDragRef,
      hostRef,
      boardContainerRef,
      groupRef,
      onItemsPatchRef,
      setPreviewInsets,
      updateSelectedBoundsOverlay,
      scheduleViewCommit,
    });

  const rebuildScene = useCanvasBoardScene({
    hostRef,
    boardContainerRef,
    boardGraphicRef,
    gridGraphicRef,
    itemLayerRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    frameByIdRef,
    itemNodeByIdRef,
    frameMetaByIdRef,
    selectionIdsRef,
    groupRef,
    onSelectionChangeRef,
    activeToolRef,
    renderTokenRef,
    activeItemDragRef,
    activeSelectionBoxRef,
    isPanningRef,
    panStartRef,
    panOriginRef,
    cancelWheelZoomAnimationRef,
    spacePanActiveRef,
    lastItemPressRef,
    onItemDoubleClickRef,
    ensureCaptureSession,
    drawBoardSurface,
    syncViewFromGroup,
    hideSelectionMarquee,
    redrawAnnotations,
    startAnnotationSession,
  });

  useCanvasBoardBootstrap({
    hostRef,
    appRef,
    boardContainerRef,
    boardGraphicRef,
    gridGraphicRef,
    itemLayerRef,
    annotationMaskRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    viewCommitTimerRef,
    isPanningRef,
    panStartRef,
    panOriginRef,
    cancelWheelZoomAnimationRef,
    activeItemDragRef,
    activeSelectionBoxRef,
    activeAnnotationSessionRef,
    activeToolRef,
    spacePanActiveRef,
    selectionIdsRef,
    onSelectionChangeRef,
    hideDoodleCursor,
    updateDoodleCursor,
    updateAnnotationSession,
    updateSelectionMarquee,
    updateDraggedItemPosition,
    commitAnnotationSession,
    commitDraggedItemPatch,
    hideSelectionMarquee,
    commitView,
    scheduleViewCommit,
    drawBoardSurface,
    updateSelectedBoundsOverlay,
    rebuildScene,
    setAppReady,
    stopCaptureSession,
    captureSessionByIdRef,
  });

  useEffect(() => {
    if (!appReady) {
      return;
    }

    previewInsetsRef.current = ZERO_INSETS;
    onCanvasSizePreviewChangeRef.current?.(null);
    rebuildScene();
  }, [
    appReady,
    group.id,
    group.items,
    group.canvasSize.width,
    group.canvasSize.height,
    activeTool,
    rebuildScene,
  ]);

  useEffect(() => {
    const activeCaptureIds = new Set(
      group.items
        .filter((item): item is CaptureItem => item.type === "capture")
        .map((item) => item.id),
    );

    captureSessionByIdRef.current.forEach((_, captureId) => {
      if (!activeCaptureIds.has(captureId)) {
        stopCaptureSession(captureId);
      }
    });
  }, [group.id, group.items, stopCaptureSession]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    if (group.annotations.length === 0) {
      cancelAnnotationSession();
    }

    redrawAnnotations(group.annotations);
  }, [appReady, cancelAnnotationSession, group.annotations, redrawAnnotations]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, selectedItemIds, updateSelectedBoundsOverlay]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, cropSession, updateSelectedBoundsOverlay]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, group.items, updateSelectedBoundsOverlay]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    drawBoardSurface();
    updateSelectedBoundsOverlay();
  }, [
    appReady,
    drawBoardSurface,
    group.canvasColor,
    group.canvasSize.height,
    group.canvasSize.width,
    updateSelectedBoundsOverlay,
  ]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [appReady, group.zoom, updateDoodleCursor]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    if (
      isPanningRef.current ||
      activeItemDragRef.current ||
      activeAnnotationSessionRef.current ||
      activeSelectionBoxRef.current
    ) {
      return;
    }

    syncViewFromGroup();
    updateSelectedBoundsOverlay();
  }, [
    appReady,
    group.panX,
    group.panY,
    group.zoom,
    syncViewFromGroup,
    updateSelectedBoundsOverlay,
  ]);

  useEffect(
    () => () => {
      onCanvasSizePreviewChangeRef.current?.(null);
      onExportReadyRef.current?.(null);
      hideSelectedBoundsOverlay();
    },
    [hideSelectedBoundsOverlay],
  );

  useEffect(() => {
    if (!appReady) {
      onExportReadyRef.current?.(null);
      return;
    }

    onExportReadyRef.current?.(() => {
      const app = appRef.current;
      const boardContainer = boardContainerRef.current;

      if (!app || !boardContainer) {
        return null;
      }

      const previousX = boardContainer.x;
      const previousY = boardContainer.y;
      const previousScaleX = boardContainer.scale.x;
      const previousScaleY = boardContainer.scale.y;

      try {
        boardContainer.position.set(0, 0);
        boardContainer.scale.set(1, 1);

        const exportCanvas = app.renderer.extract.canvas({
          target: boardContainer,
          frame: new Rectangle(0, 0, group.canvasSize.width, group.canvasSize.height),
          resolution: Math.max(window.devicePixelRatio || 1, 2),
        });

        if (
          !exportCanvas ||
          typeof (exportCanvas as HTMLCanvasElement).toDataURL !== "function"
        ) {
          return null;
        }

        return (exportCanvas as HTMLCanvasElement).toDataURL("image/png");
      } finally {
        boardContainer.position.set(previousX, previousY);
        boardContainer.scale.set(previousScaleX, previousScaleY);
      }
    });

    return () => {
      const notifyExportReady = onExportReadyRef.current;
      notifyExportReady?.(null);
    };
  }, [appReady, group.canvasSize.height, group.canvasSize.width]);

  return (
    <div className="canvas-host">
      <div
        className="canvas-surface"
        ref={hostRef}
        style={{
          filter: boardFilter,
          cursor: activeTool === "doodle" ? "none" : "default",
        }}
      />
      <div
        className={`canvas-selected-bounds ${cropSession ? "crop-mode" : ""}`}
        ref={selectedBoundsOverlayRef}
      >
        <button
          type="button"
          className="canvas-transform-handle handle-nw"
          data-handle="nw"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-ne"
          data-handle="ne"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-se"
          data-handle="se"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-sw"
          data-handle="sw"
          onPointerDown={handleTransformHandlePointerDown}
        />
      </div>
      <div className="canvas-selection-marquee" ref={selectionMarqueeRef} />
      <div className="canvas-cursor-overlay" ref={cursorOverlayRef} />
    </div>
  );
};
