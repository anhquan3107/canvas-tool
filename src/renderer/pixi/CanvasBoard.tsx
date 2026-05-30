import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Application,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Graphics,
  Rectangle,
} from "pixi.js";
import {
  applySelectionVisualState,
  syncSelectionItemOrder,
} from "@renderer/pixi/hooks/use-board-selection-visuals";
import { refreshBoardImageVisuals } from "@renderer/pixi/hooks/use-board-item-render";
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
import type { NormalizedPointerData } from "@renderer/pixi/utils/pointer";

export const CanvasBoard = ({
  group,
  surfaceOpacity = 1,
  showSwatches = true,
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
  onLockedInteraction,
  onCanvasSizePreviewChange,
  onExportReady,
}: CanvasBoardProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cursorOverlayRef = useRef<HTMLDivElement | null>(null);
  const selectionMarqueeRef = useRef<HTMLDivElement | null>(null);
  const selectedBoundsOverlayRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardContainerRef = useRef<Container | null>(null);
  const contentLayerRef = useRef<Container | null>(null);
  const boardGraphicRef = useRef<Graphics | null>(null);
  const gridGraphicRef = useRef<Graphics | null>(null);
  const itemLayerRef = useRef<Container | null>(null);
  const annotationMaskRef = useRef<Graphics | null>(null);
  const annotationLayerRef = useRef<Graphics | null>(null);
  const annotationPreviewLayerRef = useRef<Graphics | null>(null);
  const frameById = useMemo(() => new Map<string, Graphics>(), []);
  const itemNodeById = useMemo(() => new Map<string, Container>(), []);
  const frameMetaById = useMemo(
    () => new Map<string, { width: number; height: number; isCapture: boolean }>(),
    [],
  );
  const frameByIdRef = useRef(frameById);
  const itemNodeByIdRef = useRef(itemNodeById);
  const frameMetaByIdRef = useRef(frameMetaById);
  const { captureSessionByIdRef, stopCaptureSession, ensureCaptureSession } =
    useCaptureSessions();
  const selectionIdsRef = useRef(selectedItemIds);
  const groupRef = useRef(group);
  const surfaceOpacityRef = useRef(surfaceOpacity);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onItemsPatchRef = useRef(onItemsPatch);
  const onViewChangeRef = useRef(onViewChange);
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  const onItemDoubleClickRef = useRef(onItemDoubleClick);
  const onLockedInteractionRef = useRef(onLockedInteraction);
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
  const lastPointerClientRef = useRef<
    Pick<
      NormalizedPointerData,
      "clientX" | "clientY" | "pointerType" | "pressure" | "buttons"
    > | null
  >(null);
  const lastItemPressRef = useRef<{ itemId: string; time: number } | null>(null);
  const cropSessionRef = useRef<CropSession | null>(cropSession);
  const [appReady, setAppReady] = useState(false);
  const contentBlurFilterRef = useRef<BlurFilter | null>(null);
  const contentColorMatrixFilterRef = useRef<ColorMatrixFilter | null>(null);
  const lastAppliedGrayscaleRef = useRef(group.filters.grayscale);

  useLayoutEffect(() => {
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
      applySelectionVisualState(itemNode, id, selectedItemIds);
    });

    syncSelectionItemOrder(
      itemLayerRef.current,
      itemNodeByIdRef.current,
      group.items,
      selectedItemIds,
    );
  }, [group.items, selectedItemIds]);

  useLayoutEffect(() => {
    groupRef.current = group;
  }, [group]);

  useLayoutEffect(() => {
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
    onLockedInteractionRef.current = onLockedInteraction;
  }, [onLockedInteraction]);

  useEffect(() => {
    onCanvasSizePreviewChangeRef.current = onCanvasSizePreviewChange;
  }, [onCanvasSizePreviewChange]);

  useEffect(() => {
    onExportReadyRef.current = onExportReady;
  }, [onExportReady]);

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
    surfaceOpacityRef,
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

  useLayoutEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== "doodle") {
      hideDoodleCursor();
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [activeTool, hideDoodleCursor, updateDoodleCursor]);

  useLayoutEffect(() => {
    doodleModeRef.current = doodleMode;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [doodleMode, updateDoodleCursor]);

  useLayoutEffect(() => {
    doodleColorRef.current = doodleColor;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [doodleColor, updateDoodleCursor]);

  useLayoutEffect(() => {
    doodleSizeRef.current = doodleSize;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [doodleSize, updateDoodleCursor]);

  useLayoutEffect(() => {
    surfaceOpacityRef.current = surfaceOpacity;
    drawBoardSurface();
  }, [drawBoardSurface, surfaceOpacity]);

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
    onLockedInteractionRef,
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
      previewInsetsRef,
      onItemsPatchRef,
      setPreviewInsets,
      updateSelectedBoundsOverlay,
      scheduleViewCommit,
    });

  const preserveLiveBoardView = useCallback(() => {
    const boardContainer = boardContainerRef.current;
    if (!boardContainer) {
      return;
    }

    groupRef.current = {
      ...groupRef.current,
      zoom: boardContainer.scale.x,
      panX: boardContainer.x,
      panY: boardContainer.y,
    };
  }, []);

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
    onLockedInteractionRef,
    activeToolRef,
    showSwatchesRef,
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

  useEffect(() => {
    showSwatchesRef.current = showSwatches;

    if (!appReady) {
      return;
    }

    cancelWheelZoomAnimationRef.current?.();
    if (viewCommitTimerRef.current !== null) {
      window.clearTimeout(viewCommitTimerRef.current);
      viewCommitTimerRef.current = null;
    }

    preserveLiveBoardView();
    rebuildScene();
  }, [appReady, preserveLiveBoardView, rebuildScene, showSwatches]);

  useCanvasBoardBootstrap({
    hostRef,
    appRef,
    boardContainerRef,
    contentLayerRef,
    boardGraphicRef,
    gridGraphicRef,
    itemLayerRef,
    annotationMaskRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    groupRef,
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
    onLockedInteractionRef,
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

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    const board = boardGraphicRef.current;
    const doodleActive = activeTool === "doodle";

    if (board && !isPanningRef.current) {
      board.cursor = doodleActive ? "none" : "default";
    }

    const itemById = new Map(group.items.map((item) => [item.id, item]));
    itemNodeByIdRef.current.forEach((itemNode, itemId) => {
      const item = itemById.get(itemId);
      if (!item) {
        return;
      }

      itemNode.eventMode = doodleActive ? "none" : "static";
      itemNode.cursor =
        doodleActive || group.locked || item.locked ? "default" : "move";
    });
  }, [appReady, activeTool, group.items, group.locked]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    cancelWheelZoomAnimationRef.current?.();
    const hasUncommittedLocalViewChange = viewCommitTimerRef.current !== null;
    if (hasUncommittedLocalViewChange) {
      commitView();
    } else if (viewCommitTimerRef.current !== null) {
      window.clearTimeout(viewCommitTimerRef.current);
      viewCommitTimerRef.current = null;
    }

    const hasLivePreviewInsets =
      previewInsetsRef.current.left !== 0 ||
      previewInsetsRef.current.top !== 0 ||
      previewInsetsRef.current.right !== 0 ||
      previewInsetsRef.current.bottom !== 0;
    const boardContainer = boardContainerRef.current;
    const hasExternalViewChange =
      boardContainer &&
      (Math.abs(boardContainer.x - group.panX) > 0.75 ||
        Math.abs(boardContainer.y - group.panY) > 0.75 ||
        Math.abs(boardContainer.scale.x - group.zoom) > 0.001);

    // When a drag/transform preview expanded left or top, group state already
    // contains the corrected committed pan. Reusing the temporary preview pan
    // here would reintroduce the snap on rebuild.
    // Likewise, opening a different file can keep the same group id
    // ("canvas-main"); in that case the stored file view must win over the
    // previous live board view.
    if (!hasLivePreviewInsets && (!hasExternalViewChange || hasUncommittedLocalViewChange)) {
      preserveLiveBoardView();
    }

    if (!activeItemDragRef.current && !activeSelectionTransformRef.current) {
      previewInsetsRef.current = ZERO_INSETS;
      onCanvasSizePreviewChangeRef.current?.(null);
    }
    rebuildScene();
  }, [
    appReady,
    group.id,
    group.items,
    group.canvasSize.width,
    group.canvasSize.height,
    group.panX,
    group.panY,
    group.zoom,
    preserveLiveBoardView,
    rebuildScene,
    commitView,
  ]);

  useEffect(() => {
    if (!appReady) {
      lastAppliedGrayscaleRef.current = group.filters.grayscale;
      return;
    }

    if (lastAppliedGrayscaleRef.current === group.filters.grayscale) {
      return;
    }

    lastAppliedGrayscaleRef.current = group.filters.grayscale;
    const renderToken = ++renderTokenRef.current;

    group.items.forEach((item) => {
      if (item.type !== "image") {
        return;
      }

      const itemNode = itemNodeByIdRef.current.get(item.id);
      const frameMeta = frameMetaByIdRef.current.get(item.id);
      if (!itemNode || !frameMeta) {
        return;
      }

      refreshBoardImageVisuals({
        item,
        itemNode,
        safeWidth: frameMeta.width,
        safeHeight: frameMeta.height,
        canvasZoom: group.zoom,
        dotGain20BlackAndWhite: group.filters.grayscale > 0,
        renderToken,
        renderTokenRef,
      });
    });
  }, [appReady, group.filters.grayscale, group.id, group.items, group.zoom]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    const contentLayer = contentLayerRef.current;
    if (!contentLayer) {
      return;
    }

    const filters = [];

    if (group.filters.blur > 0) {
      const blurFilter =
        contentBlurFilterRef.current ??
        new BlurFilter({ strength: group.filters.blur, quality: 2, kernelSize: 5 });
      blurFilter.strength = group.filters.blur;
      contentBlurFilterRef.current = blurFilter;
      filters.push(blurFilter);
    }

    if (group.filters.grayscale > 0) {
      const colorMatrixFilter =
        contentColorMatrixFilterRef.current ?? new ColorMatrixFilter();
      colorMatrixFilter.reset();
      colorMatrixFilter.saturate(
        -Math.min(1, Math.max(0, group.filters.grayscale / 100)),
        false,
      );
      contentColorMatrixFilterRef.current = colorMatrixFilter;
      filters.push(colorMatrixFilter);
    }

    contentLayer.filters = filters.length > 0 ? filters : null;
  }, [appReady, group.filters.blur, group.filters.grayscale]);

  useEffect(() => {
    const activeCaptureIds = new Set<string>();
    for (const item of group.items) {
      if (item.type === "capture") {
        activeCaptureIds.add(item.id);
      }
    }

    const captureSessionById = captureSessionByIdRef.current;
    captureSessionById.forEach((_, captureId) => {
      if (!activeCaptureIds.has(captureId)) {
        stopCaptureSession(captureId);
      }
    });
  }, [captureSessionByIdRef, group.id, group.items, stopCaptureSession]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    if (group.annotations.length === 0) {
      cancelAnnotationSession();
    }

    redrawAnnotations(group.annotations);
  }, [appReady, cancelAnnotationSession, group.annotations, redrawAnnotations]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, selectedItemIds, updateSelectedBoundsOverlay]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, cropSession, updateSelectedBoundsOverlay]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, group.items, updateSelectedBoundsOverlay]);

  useLayoutEffect(() => {
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

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [appReady, group.zoom, updateDoodleCursor]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    const boardContainer = boardContainerRef.current;
    const hasExternalViewChange =
      boardContainer &&
      (Math.abs(boardContainer.x - group.panX) > 0.75 ||
        Math.abs(boardContainer.y - group.panY) > 0.75 ||
        Math.abs(boardContainer.scale.x - group.zoom) > 0.001);

    if (isPanningRef.current && hasExternalViewChange) {
      isPanningRef.current = false;
      if (boardGraphicRef.current) {
        boardGraphicRef.current.cursor =
          activeToolRef.current === "doodle" && !spacePanActiveRef.current
            ? "none"
            : "default";
      }
    }

    if (
      isPanningRef.current ||
      activeItemDragRef.current ||
      activeAnnotationSessionRef.current ||
      activeSelectionBoxRef.current
    ) {
      return;
    }

    if (hasExternalViewChange) {
      cancelWheelZoomAnimationRef.current?.();
      if (viewCommitTimerRef.current !== null) {
        window.clearTimeout(viewCommitTimerRef.current);
        viewCommitTimerRef.current = null;
      }
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
    () => {
      const onCanvasSizePreviewChange = onCanvasSizePreviewChangeRef.current;
      const onExportReady = onExportReadyRef.current;

      return () => {
        onCanvasSizePreviewChange?.(null);
        onExportReady?.(null);
        hideSelectedBoundsOverlay();
      };
    },
    [hideSelectedBoundsOverlay],
  );

  useEffect(() => {
    if (!appReady) {
      onExportReadyRef.current?.(null);
      return;
    }

    const notifyExportReady = onExportReadyRef.current;
    notifyExportReady?.(() => {
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
          resolution: 1,
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
      notifyExportReady?.(null);
    };
  }, [appReady, group.canvasSize.height, group.canvasSize.width]);

  return (
    <div className="canvas-host">
      <div
        className="canvas-surface"
        ref={hostRef}
        style={{
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
          aria-label="Resize selection from top-left"
          data-handle="nw"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-ne"
          aria-label="Resize selection from top-right"
          data-handle="ne"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-se"
          aria-label="Resize selection from bottom-right"
          data-handle="se"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-sw"
          aria-label="Resize selection from bottom-left"
          data-handle="sw"
          onPointerDown={handleTransformHandlePointerDown}
        />
      </div>
      <div className="canvas-selection-marquee" ref={selectionMarqueeRef} />
      <div className="canvas-cursor-overlay" ref={cursorOverlayRef} />
    </div>
  );
};
