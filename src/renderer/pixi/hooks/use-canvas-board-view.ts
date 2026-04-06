import type { MutableRefObject } from "react";
import type { Container, Graphics } from "pixi.js";
import type { NormalizedPointerData } from "@renderer/pixi/utils/pointer";
import type {
  ActiveSelectionTransformState,
  ActiveItemDragState,
  ActiveSelectionBoxState,
  CanvasInsets,
  CanvasSizePreview,
  CropSession,
} from "@renderer/pixi/types";
import type { ReferenceGroup } from "@shared/types/project";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";
import { useBoardCoordinateConversion } from "@renderer/pixi/hooks/use-board-coordinate-conversion";
import { useBoardCursorOverlay } from "@renderer/pixi/hooks/use-board-cursor-overlay";
import { useBoardSelectionOverlay } from "@renderer/pixi/hooks/use-board-selection-overlay";
import { useBoardSurfaceDraw } from "@renderer/pixi/hooks/use-board-surface-draw";
import { useBoardViewCommit } from "@renderer/pixi/hooks/use-board-view-commit";

interface UseCanvasBoardViewOptions {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  cursorOverlayRef: MutableRefObject<HTMLDivElement | null>;
  selectionMarqueeRef: MutableRefObject<HTMLDivElement | null>;
  selectedBoundsOverlayRef: MutableRefObject<HTMLDivElement | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  boardGraphicRef: MutableRefObject<Graphics | null>;
  annotationMaskRef: MutableRefObject<Graphics | null>;
  itemNodeByIdRef: MutableRefObject<Map<string, Container>>;
  groupRef: MutableRefObject<ReferenceGroup>;
  surfaceOpacityRef: MutableRefObject<number>;
  selectionIdsRef: MutableRefObject<string[]>;
  activeItemDragRef: MutableRefObject<ActiveItemDragState | null>;
  activeSelectionTransformRef: MutableRefObject<ActiveSelectionTransformState | null>;
  activeSelectionBoxRef: MutableRefObject<ActiveSelectionBoxState | null>;
  cropSessionRef: MutableRefObject<CropSession | null>;
  onSelectionChangeRef: MutableRefObject<(itemIds: string[]) => void>;
  onViewChangeRef: MutableRefObject<(zoom: number, panX: number, panY: number) => void>;
  onCanvasSizePreviewChangeRef: MutableRefObject<
    ((size: CanvasSizePreview | null) => void) | undefined
  >;
  viewCommitTimerRef: MutableRefObject<number | null>;
  previewInsetsRef: MutableRefObject<CanvasInsets>;
  activeToolRef: MutableRefObject<ToolMode | null>;
  doodleModeRef: MutableRefObject<DoodleMode>;
  doodleColorRef: MutableRefObject<string>;
  doodleSizeRef: MutableRefObject<number>;
  lastPointerClientRef: MutableRefObject<
    Pick<NormalizedPointerData, "clientX" | "clientY" | "pointerType" | "pressure" | "buttons"> | null
  >;
}

export const useCanvasBoardView = ({
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
  activeSelectionTransformRef,
  activeSelectionBoxRef,
  cropSessionRef,
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
}: UseCanvasBoardViewOptions) => {
  const { hideDoodleCursor, updateDoodleCursor } = useBoardCursorOverlay({
    hostRef,
    cursorOverlayRef,
    boardContainerRef,
    activeToolRef,
    doodleModeRef,
    doodleColorRef,
    doodleSizeRef,
    lastPointerClientRef,
  });

  const { drawBoardSurface, setPreviewInsets } = useBoardSurfaceDraw({
    hostRef,
    boardContainerRef,
    boardGraphicRef,
    annotationMaskRef,
    groupRef,
    surfaceOpacityRef,
    previewInsetsRef,
    onCanvasSizePreviewChangeRef,
  });

  const { commitView, scheduleViewCommit, syncViewFromGroup } = useBoardViewCommit({
    boardContainerRef,
    groupRef,
    viewCommitTimerRef,
    onViewChangeRef,
    drawBoardSurface,
  });

  const { clientPointToCanvas, clientPointToWorld } =
    useBoardCoordinateConversion({
      hostRef,
      boardContainerRef,
      groupRef,
    });

  const {
    hideSelectionMarquee,
    hideSelectedBoundsOverlay,
    updateSelectionMarquee,
    updateSelectedBoundsOverlay,
  } = useBoardSelectionOverlay({
    hostRef,
    selectionMarqueeRef,
    selectedBoundsOverlayRef,
    boardContainerRef,
    itemNodeByIdRef,
    groupRef,
    selectionIdsRef,
    activeItemDragRef,
    activeSelectionTransformRef,
    activeSelectionBoxRef,
    cropSessionRef,
    onSelectionChangeRef,
    clientPointToWorld,
  });

  return {
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
    clientPointToWorld,
    updateSelectionMarquee,
    updateSelectedBoundsOverlay,
  };
};
