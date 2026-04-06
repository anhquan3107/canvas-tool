import { useEffect } from "react";
import { drawItemFrame } from "@renderer/pixi/utils/item-frame";
import type { CanvasBoardProps } from "@renderer/pixi/types";
import type { useCanvasBoardRefs } from "@renderer/pixi/hooks/use-canvas-board-refs";

const SELECTION_DIM_ALPHA = 0.34;
const SELECTION_HIGHLIGHT_NAME = "selection-highlight";

interface UseCanvasBoardSyncOptions
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
  > {
  refs: ReturnType<typeof useCanvasBoardRefs>;
  hideDoodleCursor: () => void;
  updateDoodleCursor: (
    clientX: number,
    clientY: number,
    pointerState?: {
      pointerType: string;
      pressure: number;
      buttons: number;
    },
  ) => void;
  drawBoardSurface: () => void;
}

export const useCanvasBoardSync = ({
  refs,
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
  hideDoodleCursor,
  updateDoodleCursor,
  drawBoardSurface,
}: UseCanvasBoardSyncOptions) => {
  useEffect(() => {
    refs.selectionIdsRef.current = selectedItemIds;
    refs.frameByIdRef.current.forEach((frame, id) => {
      const meta = refs.frameMetaByIdRef.current.get(id);
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

    refs.itemNodeByIdRef.current.forEach((itemNode, id) => {
      const hasSelection = selectedItemIds.length > 0;
      const isSelected = selectedItemIds.includes(id);
      itemNode.alpha = hasSelection ? (isSelected ? 1 : SELECTION_DIM_ALPHA) : 1;

      const highlightOverlay = itemNode.getChildByName(
        SELECTION_HIGHLIGHT_NAME,
      );
      if (!highlightOverlay) {
        return;
      }

      highlightOverlay.alpha = hasSelection && isSelected ? 0.08 : 0;
      highlightOverlay.visible = !hasSelection || isSelected;
    });
  }, [refs, selectedItemIds]);

  useEffect(() => {
    refs.groupRef.current = group;
  }, [group, refs]);

  useEffect(() => {
    refs.cropSessionRef.current = cropSession;
  }, [cropSession, refs]);

  useEffect(() => {
    refs.onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange, refs]);

  useEffect(() => {
    refs.onItemsPatchRef.current = onItemsPatch;
  }, [onItemsPatch, refs]);

  useEffect(() => {
    refs.onViewChangeRef.current = onViewChange;
  }, [onViewChange, refs]);

  useEffect(() => {
    refs.onAnnotationsChangeRef.current = onAnnotationsChange;
  }, [onAnnotationsChange, refs]);

  useEffect(() => {
    refs.onItemDoubleClickRef.current = onItemDoubleClick;
  }, [onItemDoubleClick, refs]);

  useEffect(() => {
    refs.onCanvasSizePreviewChangeRef.current = onCanvasSizePreviewChange;
  }, [onCanvasSizePreviewChange, refs]);

  useEffect(() => {
    refs.onExportReadyRef.current = onExportReady;
  }, [onExportReady, refs]);

  useEffect(() => {
    refs.showSwatchesRef.current = showSwatches;
  }, [refs, showSwatches]);

  useEffect(() => {
    refs.surfaceOpacityRef.current = surfaceOpacity;
    drawBoardSurface();
  }, [drawBoardSurface, refs, surfaceOpacity]);

  useEffect(() => {
    refs.activeToolRef.current = activeTool;
    if (activeTool !== "doodle") {
      hideDoodleCursor();
      return;
    }

    const lastPointer = refs.lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [activeTool, hideDoodleCursor, refs, updateDoodleCursor]);

  useEffect(() => {
    refs.doodleModeRef.current = doodleMode;
    const lastPointer = refs.lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [doodleMode, refs, updateDoodleCursor]);

  useEffect(() => {
    refs.doodleColorRef.current = doodleColor;
    const lastPointer = refs.lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [doodleColor, refs, updateDoodleCursor]);

  useEffect(() => {
    refs.doodleSizeRef.current = doodleSize;
    const lastPointer = refs.lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [doodleSize, refs, updateDoodleCursor]);
};
