import { useCallback, type MutableRefObject } from "react";
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
} from "@renderer/pixi/types";

interface UseCanvasBoardDragOptions {
  activeItemDragRef: MutableRefObject<ActiveItemDragState | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  snapEnabledRef: MutableRefObject<boolean>;
  groupRef: MutableRefObject<ReferenceGroup>;
  onItemsPatchRef: MutableRefObject<
    (updates: Record<string, CanvasItemPatch>) => void
  >;
  setPreviewInsets: (nextInsets: CanvasInsets) => void;
}

export const useCanvasBoardDrag = ({
  activeItemDragRef,
  boardContainerRef,
  snapEnabledRef,
  groupRef,
  onItemsPatchRef,
  setPreviewInsets,
}: UseCanvasBoardDragOptions) => {
  const updateDraggedItemPosition = useCallback(
    (clientX: number, clientY: number) => {
      const activeDrag = activeItemDragRef.current;
      const boardContainer = boardContainerRef.current;
      if (!activeDrag || !boardContainer) {
        return;
      }

      const deltaX =
        (clientX - activeDrag.startPointer.x) / boardContainer.scale.x;
      const deltaY =
        (clientY - activeDrag.startPointer.y) / boardContainer.scale.y;
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

      if (snapEnabledRef.current) {
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
      }

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

        item.itemNode.position.set(resolvedX, resolvedY);
        activeDrag.patchBuffer[item.itemId] = {
          ...activeDrag.patchBuffer[item.itemId],
          x: Math.round(resolvedX),
          y: Math.round(resolvedY),
        };

        minX = Math.min(minX, resolvedX);
        minY = Math.min(minY, resolvedY);
        maxX = Math.max(maxX, resolvedX + item.width);
        maxY = Math.max(maxY, resolvedY + item.height);
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
    },
    [
      activeItemDragRef,
      boardContainerRef,
      groupRef,
      setPreviewInsets,
      snapEnabledRef,
    ],
  );

  const commitDraggedItemPatch = useCallback(() => {
    const activeDrag = activeItemDragRef.current;
    if (!activeDrag) {
      return;
    }

    activeItemDragRef.current = null;

    if (!activeDrag.hasMoved) {
      setPreviewInsets(ZERO_INSETS);
      return;
    }

    if (Object.keys(activeDrag.patchBuffer).length > 0) {
      onItemsPatchRef.current({ ...activeDrag.patchBuffer });
      return;
    }

    setPreviewInsets(ZERO_INSETS);
  }, [activeItemDragRef, onItemsPatchRef, setPreviewInsets]);

  return {
    updateDraggedItemPosition,
    commitDraggedItemPatch,
  };
};
