import { useEffect, type MutableRefObject } from "react";
import type { CaptureItem, ReferenceGroup } from "@shared/types/project";
import { ZERO_INSETS } from "@renderer/pixi/constants";
import type { CanvasBoardProps } from "@renderer/pixi/types";
import type { useCanvasBoardRefs } from "@renderer/pixi/hooks/use-canvas-board-refs";

interface UseCanvasBoardEffectsOptions
  extends Pick<CanvasBoardProps, "group" | "activeTool" | "selectedItemIds" | "cropSession"> {
  refs: ReturnType<typeof useCanvasBoardRefs>;
  appReady: boolean;
  showSwatches: boolean;
  preserveLiveBoardView: () => void;
  rebuildScene: () => void;
  drawBoardSurface: () => void;
  redrawAnnotations: (annotations?: ReferenceGroup["annotations"]) => void;
  cancelAnnotationSession: () => void;
  updateSelectedBoundsOverlay: () => void;
  syncViewFromGroup: () => void;
  stopCaptureSession: (captureId: string) => void;
  captureSessionByIdRef: MutableRefObject<Map<string, unknown>>;
  updateDoodleCursor: (
    clientX: number,
    clientY: number,
    pointerState?: {
      pointerType: string;
      pressure: number;
      buttons: number;
    },
  ) => void;
}

export const useCanvasBoardEffects = ({
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
}: UseCanvasBoardEffectsOptions) => {
  useEffect(() => {
    refs.updateSelectedBoundsOverlayRef.current = updateSelectedBoundsOverlay;
  }, [refs, updateSelectedBoundsOverlay]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    refs.cancelWheelZoomAnimationRef.current?.();
    if (refs.viewCommitTimerRef.current !== null) {
      window.clearTimeout(refs.viewCommitTimerRef.current);
      refs.viewCommitTimerRef.current = null;
    }

    preserveLiveBoardView();
    rebuildScene();
  }, [appReady, preserveLiveBoardView, rebuildScene, showSwatches, refs]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const board = refs.boardGraphicRef.current;
    const doodleActive = activeTool === "doodle";

    if (board && !refs.isPanningRef.current) {
      board.cursor = doodleActive ? "none" : "grab";
    }

    const itemById = new Map(group.items.map((item) => [item.id, item]));
    refs.itemNodeByIdRef.current.forEach((itemNode, itemId) => {
      const item = itemById.get(itemId);
      if (!item) {
        return;
      }

      itemNode.eventMode = doodleActive ? "none" : "static";
      itemNode.cursor =
        doodleActive || group.locked || item.locked ? "default" : "move";
    });
  }, [appReady, activeTool, group.items, group.locked, refs]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    refs.cancelWheelZoomAnimationRef.current?.();
    if (refs.viewCommitTimerRef.current !== null) {
      window.clearTimeout(refs.viewCommitTimerRef.current);
      refs.viewCommitTimerRef.current = null;
    }

    preserveLiveBoardView();

    refs.previewInsetsRef.current = ZERO_INSETS;
    refs.onCanvasSizePreviewChangeRef.current?.(null);
    rebuildScene();
  }, [
    appReady,
    group.id,
    group.items,
    group.canvasSize.width,
    group.canvasSize.height,
    preserveLiveBoardView,
    rebuildScene,
    refs,
  ]);

  useEffect(() => {
    const activeCaptureIds = new Set(
      group.items
        .filter((item): item is CaptureItem => item.type === "capture")
        .map((item) => item.id),
    );

    captureSessionByIdRef.current.forEach((_value, captureId) => {
      if (!activeCaptureIds.has(captureId)) {
        stopCaptureSession(captureId);
      }
    });
  }, [captureSessionByIdRef, group.id, group.items, stopCaptureSession]);

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

    const lastPointer = refs.lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [appReady, group.zoom, refs, updateDoodleCursor]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const boardContainer = refs.boardContainerRef.current;
    const hasExternalViewChange =
      boardContainer &&
      (Math.abs(boardContainer.x - group.panX) > 0.75 ||
        Math.abs(boardContainer.y - group.panY) > 0.75 ||
        Math.abs(boardContainer.scale.x - group.zoom) > 0.001);

    if (refs.isPanningRef.current && hasExternalViewChange) {
      refs.isPanningRef.current = false;
      refs.activePanPointerIdRef.current = null;
      if (refs.boardGraphicRef.current) {
        refs.boardGraphicRef.current.cursor =
          refs.activeToolRef.current === "doodle" && !refs.spacePanActiveRef.current
            ? "none"
            : "grab";
      }
    }

    if (
      refs.isPanningRef.current ||
      refs.activeItemDragRef.current ||
      refs.activeAnnotationSessionRef.current ||
      refs.activeSelectionBoxRef.current
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
    refs,
    syncViewFromGroup,
    updateSelectedBoundsOverlay,
  ]);
};
