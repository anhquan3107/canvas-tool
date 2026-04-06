import type { MutableRefObject } from "react";
import type {
  ActiveAnnotationSessionState,
  ActiveItemDragState,
  ActiveSelectionBoxState,
} from "@renderer/pixi/types";
import { MARQUEE_DRAG_THRESHOLD } from "@renderer/pixi/constants";
import { getNormalizedPointerData } from "@renderer/pixi/utils/pointer";

interface CreateBoardGlobalPointerHandlersOptions {
  isPanningRef: MutableRefObject<boolean>;
  activePanPointerIdRef: MutableRefObject<number | null>;
  panStartRef: MutableRefObject<{ x: number; y: number }>;
  panOriginRef: MutableRefObject<{ x: number; y: number }>;
  activeItemDragRef: MutableRefObject<ActiveItemDragState | null>;
  activeSelectionBoxRef: MutableRefObject<ActiveSelectionBoxState | null>;
  activeAnnotationSessionRef: MutableRefObject<ActiveAnnotationSessionState | null>;
  activeToolRef: MutableRefObject<string | null>;
  spacePanActiveRef: MutableRefObject<boolean>;
  selectionIdsRef: MutableRefObject<string[]>;
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
  updateAnnotationSession: (pointer: {
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType: string;
    pressure: number;
  }) => void;
  updateSelectionMarquee: (clientX: number, clientY: number) => void;
  updateDraggedItemPosition: (clientX: number, clientY: number) => void;
  commitAnnotationSession: () => void;
  commitDraggedItemPatch: () => void;
  hideSelectionMarquee: () => void;
  commitView: () => void;
  drawBoardSurface: () => void;
  updateSelectedBoundsOverlay: () => void;
  onSelectionChangeRef: MutableRefObject<(itemIds: string[]) => void>;
  boardGraphicRef: MutableRefObject<{ cursor: string } | null>;
  boardContainerRef: MutableRefObject<{ x: number; y: number } | null>;
}

export const createBoardGlobalPointerHandlers = ({
  isPanningRef,
  activePanPointerIdRef,
  panStartRef,
  panOriginRef,
  activeItemDragRef,
  activeSelectionBoxRef,
  activeAnnotationSessionRef,
  activeToolRef,
  spacePanActiveRef,
  selectionIdsRef,
  hideDoodleCursor,
  updateDoodleCursor,
  updateAnnotationSession,
  updateSelectionMarquee,
  updateDraggedItemPosition,
  commitAnnotationSession,
  commitDraggedItemPatch,
  hideSelectionMarquee,
  commitView,
  drawBoardSurface,
  updateSelectedBoundsOverlay,
  onSelectionChangeRef,
  boardGraphicRef,
  boardContainerRef,
}: CreateBoardGlobalPointerHandlersOptions) => {
  const isTypingTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  };

  const onPointerLeave = () => {
    hideDoodleCursor();
  };

  const onPointerMove = (event: PointerEvent) => {
    const pointer = getNormalizedPointerData(event);
    updateDoodleCursor(pointer.clientX, pointer.clientY, pointer);

    if (
      activeAnnotationSessionRef.current &&
      activeAnnotationSessionRef.current.pointerId === pointer.pointerId
    ) {
      updateAnnotationSession(pointer);
      return;
    }

    if (
      activeSelectionBoxRef.current &&
      activeSelectionBoxRef.current.pointerId === pointer.pointerId
    ) {
      updateSelectionMarquee(pointer.clientX, pointer.clientY);
      return;
    }

    if (
      activeItemDragRef.current &&
      activeItemDragRef.current.pointerId === pointer.pointerId
    ) {
      updateDraggedItemPosition(pointer.clientX, pointer.clientY);
      return;
    }

    const currentBoard = boardContainerRef.current;
    if (
      !isPanningRef.current ||
      !currentBoard ||
      activePanPointerIdRef.current !== pointer.pointerId
    ) {
      return;
    }

    currentBoard.x =
      panOriginRef.current.x + (pointer.clientX - panStartRef.current.x);
    currentBoard.y =
      panOriginRef.current.y + (pointer.clientY - panStartRef.current.y);
    drawBoardSurface();
    updateSelectedBoundsOverlay();
  };

  const onPointerUp = (event: PointerEvent) => {
    const pointer = getNormalizedPointerData(event);

    if (
      activeAnnotationSessionRef.current &&
      activeAnnotationSessionRef.current.pointerId === pointer.pointerId
    ) {
      commitAnnotationSession();
    }

    if (
      activeSelectionBoxRef.current &&
      activeSelectionBoxRef.current.pointerId === pointer.pointerId
    ) {
      const selectionBox = activeSelectionBoxRef.current;
      const movedDistance = Math.hypot(
        pointer.clientX - selectionBox.startClient.x,
        pointer.clientY - selectionBox.startClient.y,
      );

      if (
        movedDistance < MARQUEE_DRAG_THRESHOLD &&
        !selectionBox.additive
      ) {
        selectionIdsRef.current = [];
        onSelectionChangeRef.current([]);
      }

      activeSelectionBoxRef.current = null;
      hideSelectionMarquee();
    }

    if (
      activeItemDragRef.current &&
      activeItemDragRef.current.pointerId === pointer.pointerId
    ) {
      commitDraggedItemPatch();
    }

    if (
      !isPanningRef.current ||
      activePanPointerIdRef.current !== pointer.pointerId
    ) {
      return;
    }

    isPanningRef.current = false;
    activePanPointerIdRef.current = null;
    if (boardGraphicRef.current) {
      boardGraphicRef.current.cursor =
        activeToolRef.current === "doodle" && !spacePanActiveRef.current
          ? "none"
          : "grab";
    }
    commitView();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    if (event.code !== "Space") {
      return;
    }

    spacePanActiveRef.current = true;
    if (boardGraphicRef.current && !isPanningRef.current) {
      boardGraphicRef.current.cursor = "grab";
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code !== "Space") {
      return;
    }

    spacePanActiveRef.current = false;
    if (boardGraphicRef.current && !isPanningRef.current) {
      boardGraphicRef.current.cursor =
        activeToolRef.current === "doodle" ? "none" : "grab";
      activePanPointerIdRef.current = null;
    }
  };

  return {
    onPointerLeave,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onKeyUp,
  };
};
