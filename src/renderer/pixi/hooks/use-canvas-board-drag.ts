import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { Container } from "pixi.js";
import type { ReferenceGroup } from "@shared/types/project";
import {
  BOARD_EXPANSION_PADDING,
  ITEM_DRAG_THRESHOLD,
  SNAP_GAP,
  SNAP_THRESHOLD,
  ZERO_INSETS,
} from "@renderer/pixi/constants";
import type {
  ActiveItemDragState,
  CanvasInsets,
  CanvasItemPatch,
  CanvasBoardViewState,
} from "@renderer/pixi/types";

interface UseCanvasBoardDragOptions {
  activeItemDragRef: MutableRefObject<ActiveItemDragState | null>;
  hostRef: MutableRefObject<HTMLDivElement | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  groupRef: MutableRefObject<ReferenceGroup>;
  previewInsetsRef: MutableRefObject<CanvasInsets>;
  onItemsPatchRef: MutableRefObject<
    (
      updates: Record<string, CanvasItemPatch>,
      currentView?: CanvasBoardViewState,
    ) => void
  >;
  setPreviewInsets: (nextInsets: CanvasInsets) => void;
  updateSelectedBoundsOverlay: () => void;
  scheduleViewCommit: (delay?: number) => void;
}

export const useCanvasBoardDrag = ({
  activeItemDragRef,
  hostRef,
  boardContainerRef,
  groupRef,
  previewInsetsRef,
  onItemsPatchRef,
  setPreviewInsets,
  updateSelectedBoundsOverlay,
  scheduleViewCommit,
}: UseCanvasBoardDragOptions) => {
  const autoPanFrameRef = useRef<number | null>(null);
  const lastDragPointerRef = useRef<{ x: number; y: number } | null>(null);

  const applyPointerResistance = useCallback(
    (value: number, min: number, max: number) => {
      const overflowLimit = 84;
      const overflowResistance = 0.14;

      if (value < min) {
        return min - Math.min(overflowLimit, (min - value) * overflowResistance);
      }

      if (value > max) {
        return max + Math.min(overflowLimit, (value - max) * overflowResistance);
      }

      return value;
    },
    [],
  );

  const cancelAutoPanLoop = useCallback(() => {
    if (autoPanFrameRef.current !== null) {
      window.cancelAnimationFrame(autoPanFrameRef.current);
      autoPanFrameRef.current = null;
    }
  }, []);

  const updateDraggedItemPosition = useCallback(
    (clientX: number, clientY: number) => {
      const activeDrag = activeItemDragRef.current;
      const boardContainer = boardContainerRef.current;
      const host = hostRef.current;
      if (!activeDrag || !boardContainer || !host) {
        cancelAutoPanLoop();
        return;
      }

      lastDragPointerRef.current = { x: clientX, y: clientY };

      const hostRect = host.getBoundingClientRect();
      const edgeThreshold = 52;
      const maxAutoPanStep = 8;

      const rightOverrun = clientX - (hostRect.right - edgeThreshold);
      const leftOverrun = hostRect.left + edgeThreshold - clientX;
      const bottomOverrun = clientY - (hostRect.bottom - edgeThreshold);
      const topOverrun = hostRect.top + edgeThreshold - clientY;

      const panDeltaX =
        (rightOverrun > 0
          ? -Math.min(maxAutoPanStep, rightOverrun * 0.12)
          : 0) +
        (leftOverrun > 0
          ? Math.min(maxAutoPanStep, leftOverrun * 0.12)
          : 0);
      const panDeltaY =
        (bottomOverrun > 0
          ? -Math.min(maxAutoPanStep, bottomOverrun * 0.12)
          : 0) +
        (topOverrun > 0
          ? Math.min(maxAutoPanStep, topOverrun * 0.12)
          : 0);

      if (panDeltaX !== 0 || panDeltaY !== 0) {
        boardContainer.x += panDeltaX;
        boardContainer.y += panDeltaY;
        activeDrag.startPointer.x += panDeltaX;
        activeDrag.startPointer.y += panDeltaY;
        scheduleViewCommit(30);

        if (autoPanFrameRef.current === null) {
          autoPanFrameRef.current = window.requestAnimationFrame(() => {
            autoPanFrameRef.current = null;
            const pointer = lastDragPointerRef.current;
            if (!pointer) {
              return;
            }

            updateDraggedItemPosition(pointer.x, pointer.y);
          });
        }
      } else {
        cancelAutoPanLoop();
      }

      const resistedClientX = applyPointerResistance(
        clientX,
        hostRect.left,
        hostRect.right,
      );
      const resistedClientY = applyPointerResistance(
        clientY,
        hostRect.top,
        hostRect.bottom,
      );

      const deltaX =
        (resistedClientX - activeDrag.startPointer.x) / boardContainer.scale.x;
      const deltaY =
        (resistedClientY - activeDrag.startPointer.y) / boardContainer.scale.y;
      const movedDistance = Math.hypot(deltaX, deltaY);

      if (!activeDrag.hasMoved && movedDistance < ITEM_DRAG_THRESHOLD) {
        return;
      }

      if (!activeDrag.hasMoved) {
        activeDrag.hasMoved = true;
      }

      if (!activeDrag.zIndexApplied) {
        const highestZIndex = groupRef.current.items.reduce(
          (acc, entry) => Math.max(acc, entry.zIndex),
          -1,
        );

        activeDrag.items.forEach((dragItem, index) => {
          activeDrag.patchBuffer[dragItem.itemId] = {
            ...activeDrag.patchBuffer[dragItem.itemId],
            zIndex: highestZIndex + index + 1,
          };
          activeDrag.itemLayer.addChild(dragItem.itemNode);
        });

        activeDrag.zIndexApplied = true;
      }

      let translateX = deltaX;
      let translateY = deltaY;

      const dragBounds = activeDrag.items.reduce(
        (acc, item) => ({
          minX: Math.min(acc.minX, item.startPos.x + translateX),
          minY: Math.min(acc.minY, item.startPos.y + translateY),
          maxX: Math.max(acc.maxX, item.startPos.x + translateX + item.width),
          maxY: Math.max(acc.maxY, item.startPos.y + translateY + item.height),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        },
      );

      let snappedOnX = false;
      let snappedOnY = false;

      const selectedSet = new Set(activeDrag.items.map((item) => item.itemId));
      const candidateRects = groupRef.current.items.filter(
        (item) => !selectedSet.has(item.id) && item.visible,
      );

      let snappedTranslateX = translateX;
      let snappedTranslateY = translateY;
      let bestSnapX = SNAP_THRESHOLD + 1;
      let bestSnapY = SNAP_THRESHOLD + 1;

      candidateRects.forEach((item) => {
        const itemRight = item.x + item.width;
        const itemBottom = item.y + item.height;

        const horizontalCandidates = [
          {
            delta: Math.abs(dragBounds.minX - item.x),
            value: item.x - dragBounds.minX + translateX,
          },
          {
            delta: Math.abs(dragBounds.minX - (itemRight + SNAP_GAP)),
            value: itemRight + SNAP_GAP - dragBounds.minX + translateX,
          },
          {
            delta: Math.abs(dragBounds.maxX - (item.x - SNAP_GAP)),
            value: item.x - SNAP_GAP - dragBounds.maxX + translateX,
          },
          {
            delta: Math.abs(dragBounds.maxX - itemRight),
            value: itemRight - dragBounds.maxX + translateX,
          },
        ];

        const verticalCandidates = [
          {
            delta: Math.abs(dragBounds.minY - item.y),
            value: item.y - dragBounds.minY + translateY,
          },
          {
            delta: Math.abs(dragBounds.minY - (itemBottom + SNAP_GAP)),
            value: itemBottom + SNAP_GAP - dragBounds.minY + translateY,
          },
          {
            delta: Math.abs(dragBounds.maxY - (item.y - SNAP_GAP)),
            value: item.y - SNAP_GAP - dragBounds.maxY + translateY,
          },
          {
            delta: Math.abs(dragBounds.maxY - itemBottom),
            value: itemBottom - dragBounds.maxY + translateY,
          },
        ];

        horizontalCandidates.forEach((candidate) => {
          if (candidate.delta < bestSnapX && candidate.delta <= SNAP_THRESHOLD) {
            bestSnapX = candidate.delta;
            snappedTranslateX = candidate.value;
            snappedOnX = true;
          }
        });

        verticalCandidates.forEach((candidate) => {
          if (candidate.delta < bestSnapY && candidate.delta <= SNAP_THRESHOLD) {
            bestSnapY = candidate.delta;
            snappedTranslateY = candidate.value;
            snappedOnY = true;
          }
        });
      });

      translateX = snappedTranslateX;
      translateY = snappedTranslateY;

      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      activeDrag.items.forEach((item) => {
        const resolvedX = snappedOnX
          ? Math.round(item.startPos.x + translateX)
          : item.startPos.x + translateX;
        const resolvedY = snappedOnY
          ? Math.round(item.startPos.y + translateY)
          : item.startPos.y + translateY;
        const committedX = Math.round(resolvedX);
        const committedY = Math.round(resolvedY);

        item.itemNode.position.set(committedX, committedY);
        activeDrag.patchBuffer[item.itemId] = {
          ...activeDrag.patchBuffer[item.itemId],
          x: committedX,
          y: committedY,
        };

        minX = Math.min(minX, committedX);
        minY = Math.min(minY, committedY);
        maxX = Math.max(maxX, committedX + item.visualWidth);
        maxY = Math.max(maxY, committedY + item.visualHeight);
      });

      setPreviewInsets({
        left: minX < 0 ? Math.ceil(-minX + BOARD_EXPANSION_PADDING) : 0,
        top: minY < 0 ? Math.ceil(-minY + BOARD_EXPANSION_PADDING) : 0,
        right:
          maxX > groupRef.current.canvasSize.width
            ? Math.ceil(
                maxX - groupRef.current.canvasSize.width +
                  BOARD_EXPANSION_PADDING,
              )
            : 0,
        bottom:
          maxY > groupRef.current.canvasSize.height
            ? Math.ceil(
                maxY - groupRef.current.canvasSize.height +
                  BOARD_EXPANSION_PADDING,
              )
            : 0,
      });
      updateSelectedBoundsOverlay();
    },
    [
      activeItemDragRef,
      applyPointerResistance,
      cancelAutoPanLoop,
      hostRef,
      boardContainerRef,
      groupRef,
      scheduleViewCommit,
      setPreviewInsets,
      updateSelectedBoundsOverlay,
    ],
  );

  const commitDraggedItemPatch = useCallback(() => {
    const activeDrag = activeItemDragRef.current;
    if (!activeDrag) {
      cancelAutoPanLoop();
      return;
    }

    activeItemDragRef.current = null;
    lastDragPointerRef.current = null;
    cancelAutoPanLoop();

    if (!activeDrag.hasMoved) {
      setPreviewInsets(ZERO_INSETS);
      updateSelectedBoundsOverlay();
      return;
    }

    if (Object.keys(activeDrag.patchBuffer).length > 0) {
      const boardContainer = boardContainerRef.current;
      const currentView = boardContainer
        ? ({
            zoom: boardContainer.scale.x,
            panX: boardContainer.x,
            panY: boardContainer.y,
            previewInsets: { ...previewInsetsRef.current },
          } satisfies CanvasBoardViewState)
        : undefined;
      onItemsPatchRef.current({ ...activeDrag.patchBuffer }, currentView);
      updateSelectedBoundsOverlay();
      return;
    }

    setPreviewInsets(ZERO_INSETS);
    updateSelectedBoundsOverlay();
  }, [
    activeItemDragRef,
    boardContainerRef,
    cancelAutoPanLoop,
    onItemsPatchRef,
    previewInsetsRef,
    setPreviewInsets,
    updateSelectedBoundsOverlay,
  ]);

  useEffect(
    () => () => {
      cancelAutoPanLoop();
    },
    [cancelAutoPanLoop],
  );

  return {
    updateDraggedItemPosition,
    commitDraggedItemPatch,
  };
};
