import { useEffect, useRef, useState } from "react";
import {
  Application,
  Container,
  Graphics,
  Rectangle,
} from "pixi.js";
import type { CaptureItem } from "@shared/types/project";
import { useCaptureSessions } from "@renderer/pixi/hooks/use-capture-sessions";
import { useCanvasBoardAnnotations } from "@renderer/pixi/hooks/use-canvas-board-annotations";
import { useCanvasBoardBootstrap } from "@renderer/pixi/hooks/use-canvas-board-bootstrap";
import { useCanvasBoardDrag } from "@renderer/pixi/hooks/use-canvas-board-drag";
import { useCanvasBoardScene } from "@renderer/pixi/hooks/use-canvas-board-scene";
import { useCanvasBoardView } from "@renderer/pixi/hooks/use-canvas-board-view";
import { ZERO_INSETS } from "@renderer/pixi/constants";
import type {
  ActiveAnnotationSessionState,
  ActiveItemDragState,
  ActiveSelectionBoxState,
  CanvasBoardProps,
} from "@renderer/pixi/types";
import { drawItemFrame } from "@renderer/pixi/utils/item-frame";

export const CanvasBoard = ({
  group,
  activeTool,
  snapEnabled,
  doodleMode,
  doodleColor,
  doodleSize,
  selectedItemIds,
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
  const appRef = useRef<Application | null>(null);
  const boardContainerRef = useRef<Container | null>(null);
  const boardGraphicRef = useRef<Graphics | null>(null);
  const gridGraphicRef = useRef<Graphics | null>(null);
  const itemLayerRef = useRef<Container | null>(null);
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
  const snapEnabledRef = useRef(snapEnabled);
  const doodleModeRef = useRef(doodleMode);
  const doodleColorRef = useRef(doodleColor);
  const doodleSizeRef = useRef(doodleSize);
  const renderTokenRef = useRef(0);
  const viewCommitTimerRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const previewInsetsRef = useRef(ZERO_INSETS);
  const activeItemDragRef = useRef<ActiveItemDragState | null>(null);
  const activeSelectionBoxRef = useRef<ActiveSelectionBoxState | null>(null);
  const activeAnnotationSessionRef =
    useRef<ActiveAnnotationSessionState | null>(null);
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);
  const lastItemPressRef = useRef<{ itemId: string; time: number } | null>(null);
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
  }, [selectedItemIds]);

  useEffect(() => {
    groupRef.current = group;
  }, [group]);

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
    snapEnabledRef.current = snapEnabled;
  }, [snapEnabled]);

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
    updateDoodleCursor,
    drawBoardSurface,
    setPreviewInsets,
    commitView,
    scheduleViewCommit,
    syncViewFromGroup,
    clientPointToCanvas,
    updateSelectionMarquee,
  } = useCanvasBoardView({
    hostRef,
    cursorOverlayRef,
    selectionMarqueeRef,
    boardContainerRef,
    boardGraphicRef,
    groupRef,
    selectionIdsRef,
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
  });

  const {
    redrawAnnotations,
    startAnnotationSession,
    updateAnnotationSession,
    commitAnnotationSession,
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
      boardContainerRef,
      snapEnabledRef,
      groupRef,
      onItemsPatchRef,
      setPreviewInsets,
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
    annotationLayerRef,
    annotationPreviewLayerRef,
    viewCommitTimerRef,
    isPanningRef,
    panStartRef,
    panOriginRef,
    activeItemDragRef,
    activeSelectionBoxRef,
    activeAnnotationSessionRef,
    activeToolRef,
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

    redrawAnnotations(group.annotations);
  }, [appReady, group.annotations, redrawAnnotations]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    drawBoardSurface();
  }, [appReady, drawBoardSurface, group.canvasColor, group.canvasSize.height, group.canvasSize.width]);

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
  }, [appReady, group.panX, group.panY, group.zoom, syncViewFromGroup]);

  useEffect(
    () => () => {
      onCanvasSizePreviewChangeRef.current?.(null);
      onExportReadyRef.current?.(null);
    },
    [],
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
      <div className="canvas-selection-marquee" ref={selectionMarqueeRef} />
      <div className="canvas-cursor-overlay" ref={cursorOverlayRef} />
    </div>
  );
};
