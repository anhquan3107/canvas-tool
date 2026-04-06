import { useCallback, useState } from "react";
import { useCaptureSessions } from "@renderer/pixi/hooks/use-capture-sessions";
import { useCanvasBoardAnnotations } from "@renderer/pixi/hooks/use-canvas-board-annotations";
import { useCanvasBoardBootstrap } from "@renderer/pixi/hooks/use-canvas-board-bootstrap";
import { useCanvasBoardDrag } from "@renderer/pixi/hooks/use-canvas-board-drag";
import { useCanvasBoardEffects } from "@renderer/pixi/hooks/use-canvas-board-effects";
import { useCanvasBoardExport } from "@renderer/pixi/hooks/use-canvas-board-export";
import { useCanvasBoardRefs } from "@renderer/pixi/hooks/use-canvas-board-refs";
import { useCanvasBoardScene } from "@renderer/pixi/hooks/use-canvas-board-scene";
import { useCanvasBoardSync } from "@renderer/pixi/hooks/use-canvas-board-sync";
import { useCanvasBoardTransform } from "@renderer/pixi/hooks/use-canvas-board-transform";
import { useCanvasBoardView } from "@renderer/pixi/hooks/use-canvas-board-view";
import type { CanvasBoardProps } from "@renderer/pixi/types";

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
  onCanvasSizePreviewChange,
  onExportReady,
}: CanvasBoardProps) => {
  const refs = useCanvasBoardRefs({
    group,
    surfaceOpacity,
    showSwatches,
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
  });
  const { captureSessionByIdRef, stopCaptureSession, ensureCaptureSession } =
    useCaptureSessions();
  const [appReady, setAppReady] = useState(false);
  const boardFilter = `blur(${group.filters.blur}px) grayscale(${group.filters.grayscale}%)`;

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
    hostRef: refs.hostRef,
    cursorOverlayRef: refs.cursorOverlayRef,
    selectionMarqueeRef: refs.selectionMarqueeRef,
    selectedBoundsOverlayRef: refs.selectedBoundsOverlayRef,
    boardContainerRef: refs.boardContainerRef,
    boardGraphicRef: refs.boardGraphicRef,
    annotationMaskRef: refs.annotationMaskRef,
    itemNodeByIdRef: refs.itemNodeByIdRef,
    groupRef: refs.groupRef,
    surfaceOpacityRef: refs.surfaceOpacityRef,
    selectionIdsRef: refs.selectionIdsRef,
    activeItemDragRef: refs.activeItemDragRef,
    activeSelectionBoxRef: refs.activeSelectionBoxRef,
    onSelectionChangeRef: refs.onSelectionChangeRef,
    onViewChangeRef: refs.onViewChangeRef,
    onCanvasSizePreviewChangeRef: refs.onCanvasSizePreviewChangeRef,
    viewCommitTimerRef: refs.viewCommitTimerRef,
    previewInsetsRef: refs.previewInsetsRef,
    activeToolRef: refs.activeToolRef,
    doodleModeRef: refs.doodleModeRef,
    doodleColorRef: refs.doodleColorRef,
    doodleSizeRef: refs.doodleSizeRef,
    lastPointerClientRef: refs.lastPointerClientRef,
    activeSelectionTransformRef: refs.activeSelectionTransformRef,
    cropSessionRef: refs.cropSessionRef,
  });

  useCanvasBoardSync({
    refs,
    group,
    surfaceOpacity,
    showSwatches,
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
    hideDoodleCursor,
    updateDoodleCursor,
    drawBoardSurface,
  });

  const { handleTransformHandlePointerDown } = useCanvasBoardTransform({
    hostRef: refs.hostRef,
    boardContainerRef: refs.boardContainerRef,
    itemNodeByIdRef: refs.itemNodeByIdRef,
    groupRef: refs.groupRef,
    selectedItemIds,
    cropSessionRef: refs.cropSessionRef,
    activeSelectionTransformRef: refs.activeSelectionTransformRef,
    activeCropHandleRef: refs.activeCropHandleRef,
    previewInsetsRef: refs.previewInsetsRef,
    setPreviewInsets,
    updateSelectedBoundsOverlayRef: refs.updateSelectedBoundsOverlayRef,
    onCanvasSizePreviewChangeRef: refs.onCanvasSizePreviewChangeRef,
    onItemsPatchRef: refs.onItemsPatchRef,
    onCropRectChange,
  });

  const {
    redrawAnnotations,
    startAnnotationSession,
    updateAnnotationSession,
    commitAnnotationSession,
    cancelAnnotationSession,
  } = useCanvasBoardAnnotations({
    annotationLayerRef: refs.annotationLayerRef,
    annotationPreviewLayerRef: refs.annotationPreviewLayerRef,
    groupRef: refs.groupRef,
    selectionIdsRef: refs.selectionIdsRef,
    onSelectionChangeRef: refs.onSelectionChangeRef,
    onAnnotationsChangeRef: refs.onAnnotationsChangeRef,
    activeAnnotationSessionRef: refs.activeAnnotationSessionRef,
    doodleModeRef: refs.doodleModeRef,
    doodleColorRef: refs.doodleColorRef,
    doodleSizeRef: refs.doodleSizeRef,
    clientPointToCanvas,
  });

  const { updateDraggedItemPosition, commitDraggedItemPatch } =
    useCanvasBoardDrag({
      activeItemDragRef: refs.activeItemDragRef,
      hostRef: refs.hostRef,
      boardContainerRef: refs.boardContainerRef,
      groupRef: refs.groupRef,
      onItemsPatchRef: refs.onItemsPatchRef,
      setPreviewInsets,
      updateSelectedBoundsOverlay,
      scheduleViewCommit,
    });

  const preserveLiveBoardView = useCallback(() => {
    const boardContainer = refs.boardContainerRef.current;
    if (!boardContainer) {
      return;
    }

    refs.groupRef.current = {
      ...refs.groupRef.current,
      zoom: boardContainer.scale.x,
      panX: boardContainer.x,
      panY: boardContainer.y,
    };
  }, [refs]);

  const rebuildScene = useCanvasBoardScene({
    hostRef: refs.hostRef,
    boardContainerRef: refs.boardContainerRef,
    boardGraphicRef: refs.boardGraphicRef,
    gridGraphicRef: refs.gridGraphicRef,
    itemLayerRef: refs.itemLayerRef,
    annotationLayerRef: refs.annotationLayerRef,
    annotationPreviewLayerRef: refs.annotationPreviewLayerRef,
    frameByIdRef: refs.frameByIdRef,
    itemNodeByIdRef: refs.itemNodeByIdRef,
    frameMetaByIdRef: refs.frameMetaByIdRef,
    selectionIdsRef: refs.selectionIdsRef,
    groupRef: refs.groupRef,
    onSelectionChangeRef: refs.onSelectionChangeRef,
    onItemDoubleClickRef: refs.onItemDoubleClickRef,
    activeToolRef: refs.activeToolRef,
    showSwatchesRef: refs.showSwatchesRef,
    renderTokenRef: refs.renderTokenRef,
    activeItemDragRef: refs.activeItemDragRef,
    activeSelectionBoxRef: refs.activeSelectionBoxRef,
    isPanningRef: refs.isPanningRef,
    activePanPointerIdRef: refs.activePanPointerIdRef,
    panStartRef: refs.panStartRef,
    panOriginRef: refs.panOriginRef,
    cancelWheelZoomAnimationRef: refs.cancelWheelZoomAnimationRef,
    spacePanActiveRef: refs.spacePanActiveRef,
    lastItemPressRef: refs.lastItemPressRef,
    ensureCaptureSession,
    drawBoardSurface,
    syncViewFromGroup,
    hideSelectionMarquee,
    redrawAnnotations,
    startAnnotationSession,
  });

  useCanvasBoardBootstrap({
    hostRef: refs.hostRef,
    appRef: refs.appRef,
    boardContainerRef: refs.boardContainerRef,
    boardGraphicRef: refs.boardGraphicRef,
    gridGraphicRef: refs.gridGraphicRef,
    itemLayerRef: refs.itemLayerRef,
    annotationMaskRef: refs.annotationMaskRef,
    annotationLayerRef: refs.annotationLayerRef,
    annotationPreviewLayerRef: refs.annotationPreviewLayerRef,
    viewCommitTimerRef: refs.viewCommitTimerRef,
    isPanningRef: refs.isPanningRef,
    panStartRef: refs.panStartRef,
    panOriginRef: refs.panOriginRef,
    cancelWheelZoomAnimationRef: refs.cancelWheelZoomAnimationRef,
    activeItemDragRef: refs.activeItemDragRef,
    activeSelectionBoxRef: refs.activeSelectionBoxRef,
    activeAnnotationSessionRef: refs.activeAnnotationSessionRef,
    activeToolRef: refs.activeToolRef,
    activePanPointerIdRef: refs.activePanPointerIdRef,
    spacePanActiveRef: refs.spacePanActiveRef,
    selectionIdsRef: refs.selectionIdsRef,
    onSelectionChangeRef: refs.onSelectionChangeRef,
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

  useCanvasBoardEffects({
    refs,
    appReady,
    group,
    activeTool,
    selectedItemIds,
    cropSession,
    showSwatches,
    preserveLiveBoardView,
    rebuildScene,
    drawBoardSurface,
    redrawAnnotations,
    cancelAnnotationSession,
    updateSelectedBoundsOverlay,
    syncViewFromGroup,
    stopCaptureSession,
    captureSessionByIdRef,
    updateDoodleCursor,
  });

  useCanvasBoardExport({
    refs,
    appReady,
    group,
    hideSelectedBoundsOverlay,
  });

  return (
    <div className="canvas-host">
      <div
        className="canvas-surface"
        ref={refs.hostRef}
        style={{
          filter: boardFilter,
          cursor: activeTool === "doodle" ? "none" : "default",
        }}
      />
      <div
        className={`canvas-selected-bounds ${cropSession ? "crop-mode" : ""}`}
        ref={refs.selectedBoundsOverlayRef}
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
      <div className="canvas-selection-marquee" ref={refs.selectionMarqueeRef} />
      <div className="canvas-cursor-overlay" ref={refs.cursorOverlayRef} />
    </div>
  );
};
