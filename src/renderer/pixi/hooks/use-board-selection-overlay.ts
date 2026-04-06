import { useCallback, type MutableRefObject } from "react";
import type { Container } from "pixi.js";
import type {
  ActiveItemDragState,
  ActiveSelectionBoxState,
  ActiveSelectionTransformState,
  CropSession,
} from "@renderer/pixi/types";
import type { ReferenceGroup } from "@shared/types/project";

interface UseBoardSelectionOverlayOptions {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  selectionMarqueeRef: MutableRefObject<HTMLDivElement | null>;
  selectedBoundsOverlayRef: MutableRefObject<HTMLDivElement | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  itemNodeByIdRef: MutableRefObject<Map<string, Container>>;
  groupRef: MutableRefObject<ReferenceGroup>;
  selectionIdsRef: MutableRefObject<string[]>;
  activeItemDragRef: MutableRefObject<ActiveItemDragState | null>;
  activeSelectionTransformRef: MutableRefObject<ActiveSelectionTransformState | null>;
  activeSelectionBoxRef: MutableRefObject<ActiveSelectionBoxState | null>;
  cropSessionRef: MutableRefObject<CropSession | null>;
  onSelectionChangeRef: MutableRefObject<(itemIds: string[]) => void>;
  clientPointToWorld: (clientX: number, clientY: number) => { x: number; y: number } | null;
}

export const useBoardSelectionOverlay = ({
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
}: UseBoardSelectionOverlayOptions) => {
  const hideSelectionMarquee = useCallback(() => {
    const marquee = selectionMarqueeRef.current;
    if (!marquee) {
      return;
    }

    marquee.style.opacity = "0";
    marquee.style.transform = "translate(-9999px, -9999px)";
    marquee.style.width = "0px";
    marquee.style.height = "0px";
  }, [selectionMarqueeRef]);

  const hideSelectedBoundsOverlay = useCallback(() => {
    const boundsOverlay = selectedBoundsOverlayRef.current;
    if (!boundsOverlay) {
      return;
    }

    boundsOverlay.style.opacity = "0";
    boundsOverlay.style.transform = "translate(-9999px, -9999px)";
    boundsOverlay.style.width = "0px";
    boundsOverlay.style.height = "0px";
  }, [selectedBoundsOverlayRef]);

  const updateSelectionMarquee = useCallback(
    (clientX: number, clientY: number) => {
      const marquee = selectionMarqueeRef.current;
      const host = hostRef.current;
      const selectionBox = activeSelectionBoxRef.current;
      if (!marquee || !host || !selectionBox) {
        return;
      }

      const hostRect = host.getBoundingClientRect();
      const startLeft = selectionBox.startClient.x - hostRect.left;
      const startTop = selectionBox.startClient.y - hostRect.top;
      const currentLeft = clientX - hostRect.left;
      const currentTop = clientY - hostRect.top;

      const left = Math.min(startLeft, currentLeft);
      const top = Math.min(startTop, currentTop);
      const width = Math.abs(currentLeft - startLeft);
      const height = Math.abs(currentTop - startTop);

      marquee.style.opacity = width > 0 || height > 0 ? "1" : "0";
      marquee.style.transform = `translate(${left}px, ${top}px)`;
      marquee.style.width = `${width}px`;
      marquee.style.height = `${height}px`;

      const startWorld = clientPointToWorld(
        selectionBox.startClient.x,
        selectionBox.startClient.y,
      );
      const endWorld = clientPointToWorld(clientX, clientY);
      if (!startWorld || !endWorld) {
        return;
      }

      const minX = Math.min(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const maxY = Math.max(startWorld.y, endWorld.y);

      const hitIds = groupRef.current.items
        .filter((item) => item.visible)
        .filter(
          (item) =>
            item.x < maxX &&
            item.x + item.width > minX &&
            item.y < maxY &&
            item.y + item.height > minY,
        )
        .map((item) => item.id);

      const nextSelection = selectionBox.additive
        ? Array.from(new Set([...selectionBox.baseSelection, ...hitIds]))
        : hitIds;

      selectionIdsRef.current = nextSelection;
      onSelectionChangeRef.current(nextSelection);
    },
    [
      activeSelectionBoxRef,
      clientPointToWorld,
      groupRef,
      hostRef,
      onSelectionChangeRef,
      selectionIdsRef,
      selectionMarqueeRef,
    ],
  );

  const updateSelectedBoundsOverlay = useCallback(() => {
    const host = hostRef.current;
    const boardContainer = boardContainerRef.current;
    const boundsOverlay = selectedBoundsOverlayRef.current;
    if (!host || !boardContainer || !boundsOverlay) {
      return;
    }

    if (selectionIdsRef.current.length === 0) {
      hideSelectedBoundsOverlay();
      return;
    }

    const selectedItems = groupRef.current.items.filter(
      (item) => item.visible && selectionIdsRef.current.includes(item.id),
    );

    if (selectedItems.length === 0) {
      hideSelectedBoundsOverlay();
      return;
    }

    const activeDrag = activeItemDragRef.current;
    const activeTransform = activeSelectionTransformRef.current;
    const usingLiveNodes = Boolean(activeDrag?.hasMoved || activeTransform?.hasChanged);

    const selectedBounds = selectedItems.map((item) => {
      const itemNode = itemNodeByIdRef.current.get(item.id);
      const width = Number.isFinite(item.width) && item.width > 1 ? item.width : 180;
      const height =
        Number.isFinite(item.height) && item.height > 1 ? item.height : 120;

      if (usingLiveNodes && itemNode) {
        const leftX = itemNode.position.x + (0 - itemNode.pivot.x) * itemNode.scale.x;
        const rightX =
          itemNode.position.x + (width - itemNode.pivot.x) * itemNode.scale.x;
        const topY = itemNode.position.y + (0 - itemNode.pivot.y) * itemNode.scale.y;
        const bottomY =
          itemNode.position.y + (height - itemNode.pivot.y) * itemNode.scale.y;
        const minItemX = Math.min(leftX, rightX);
        const minItemY = Math.min(topY, bottomY);
        const maxItemX = Math.max(leftX, rightX);
        const maxItemY = Math.max(topY, bottomY);

        return {
          minX: minItemX,
          minY: minItemY,
          maxX: maxItemX,
          maxY: maxItemY,
        };
      }

      const scaleX =
        Number.isFinite(item.scaleX) && item.scaleX !== 0 ? item.scaleX : 1;
      const scaleY =
        Number.isFinite(item.scaleY) && item.scaleY !== 0 ? item.scaleY : 1;
      const visualWidth = width * Math.abs(scaleX);
      const visualHeight = height * Math.abs(scaleY);

      return {
        minX: item.x,
        minY: item.y,
        maxX: item.x + visualWidth,
        maxY: item.y + visualHeight,
      };
    });

    let minX = Math.min(...selectedBounds.map((item) => item.minX));
    let minY = Math.min(...selectedBounds.map((item) => item.minY));
    let maxX = Math.max(...selectedBounds.map((item) => item.maxX));
    let maxY = Math.max(...selectedBounds.map((item) => item.maxY));

    const cropSession = cropSessionRef.current;
    if (
      cropSession &&
      selectedItems.length === 1 &&
      selectedItems[0]?.type === "image" &&
      selectedItems[0].id === cropSession.itemId
    ) {
      const visualWidth = maxX - minX;
      const visualHeight = maxY - minY;
      const cropMinX = minX + visualWidth * cropSession.rect.left;
      const cropMinY = minY + visualHeight * cropSession.rect.top;
      const cropMaxX = minX + visualWidth * cropSession.rect.right;
      const cropMaxY = minY + visualHeight * cropSession.rect.bottom;
      minX = cropMinX;
      minY = cropMinY;
      maxX = cropMaxX;
      maxY = cropMaxY;
    }

    const left = boardContainer.x + minX * boardContainer.scale.x;
    const top = boardContainer.y + minY * boardContainer.scale.y;
    const width = (maxX - minX) * boardContainer.scale.x;
    const height = (maxY - minY) * boardContainer.scale.y;

    boundsOverlay.style.opacity = "1";
    boundsOverlay.style.transform = `translate(${left}px, ${top}px)`;
    boundsOverlay.style.width = `${Math.max(0, width)}px`;
    boundsOverlay.style.height = `${Math.max(0, height)}px`;
  }, [
    activeItemDragRef,
    activeSelectionTransformRef,
    boardContainerRef,
    cropSessionRef,
    groupRef,
    hideSelectedBoundsOverlay,
    hostRef,
    itemNodeByIdRef,
    selectedBoundsOverlayRef,
    selectionIdsRef,
  ]);

  return {
    hideSelectionMarquee,
    hideSelectedBoundsOverlay,
    updateSelectionMarquee,
    updateSelectedBoundsOverlay,
  };
};
