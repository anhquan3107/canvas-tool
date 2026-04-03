import { useCallback, useEffect, type PointerEvent as ReactPointerEvent } from "react";
import type { RefObject } from "react";
import type { Container } from "pixi.js";
import { BOARD_EXPANSION_PADDING, ZERO_INSETS } from "@renderer/pixi/constants";
import type {
  ActiveSelectionTransformState,
  CropRect,
  CropSession,
  TransformHandle,
} from "@renderer/pixi/types";
import type { CanvasItem, CaptureItem, ImageItem, ReferenceGroup } from "@shared/types/project";

interface UseCanvasBoardTransformOptions {
  hostRef: RefObject<HTMLDivElement | null>;
  boardContainerRef: RefObject<Container | null>;
  itemNodeByIdRef: RefObject<Map<string, Container>>;
  groupRef: RefObject<ReferenceGroup>;
  selectedItemIds: string[];
  cropSessionRef: RefObject<CropSession | null>;
  activeSelectionTransformRef: RefObject<ActiveSelectionTransformState | null>;
  activeCropHandleRef: RefObject<{
    handle: TransformHandle;
    startRect: CropRect;
    imageBounds: { minX: number; minY: number; maxX: number; maxY: number };
  } | null>;
  previewInsetsRef: RefObject<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>;
  setPreviewInsets: (nextInsets: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }) => void;
  updateSelectedBoundsOverlayRef: RefObject<() => void>;
  onCanvasSizePreviewChangeRef: RefObject<
    ((size: { width: number; height: number } | null) => void) | undefined
  >;
  onItemsPatchRef: RefObject<(updates: Record<string, any>) => void>;
  onCropRectChange?: (rect: CropRect) => void;
}

export const useCanvasBoardTransform = ({
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
  onCropRectChange,
}: UseCanvasBoardTransformOptions) => {
  const getItemBounds = useCallback((item: CanvasItem) => {
    const safeWidth = Number.isFinite(item.width) && item.width > 1 ? item.width : 180;
    const safeHeight =
      Number.isFinite(item.height) && item.height > 1 ? item.height : 120;
    const safeScaleX =
      Number.isFinite(item.scaleX) && item.scaleX !== 0 ? item.scaleX : 1;
    const safeScaleY =
      Number.isFinite(item.scaleY) && item.scaleY !== 0 ? item.scaleY : 1;
    const resolvedScaleX = item.flippedX ? -safeScaleX : safeScaleX;
    const visualWidth = safeWidth * Math.abs(safeScaleX);
    const visualHeight = safeHeight * Math.abs(safeScaleY);

    return {
      minX: item.x,
      minY: item.y,
      maxX: item.x + visualWidth,
      maxY: item.y + visualHeight,
      width: safeWidth,
      height: safeHeight,
      scaleX: safeScaleX,
      scaleY: safeScaleY,
      resolvedScaleX,
      flippedX: item.flippedX,
    };
  }, []);

  const clientPointToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const host = hostRef.current;
      const boardContainer = boardContainerRef.current;
      if (!host || !boardContainer) {
        return null;
      }

      const rect = host.getBoundingClientRect();
      return {
        x: (clientX - rect.left - boardContainer.x) / boardContainer.scale.x,
        y: (clientY - rect.top - boardContainer.y) / boardContainer.scale.y,
      };
    },
    [boardContainerRef, hostRef],
  );

  const applyScaleTransform = useCallback(
    (clientX: number, clientY: number, lockAspectRatio = false) => {
      const activeTransform = activeSelectionTransformRef.current;
      if (!activeTransform) {
        return;
      }

      const pointerWorld = clientPointToWorld(clientX, clientY);
      if (!pointerWorld) {
        return;
      }

      const minWidth = 24;
      const minHeight = 24;
      let nextMinX = activeTransform.bounds.minX;
      let nextMaxX = activeTransform.bounds.maxX;
      let nextMinY = activeTransform.bounds.minY;
      let nextMaxY = activeTransform.bounds.maxY;

      switch (activeTransform.handle) {
        case "nw":
          nextMinX = Math.min(pointerWorld.x, activeTransform.anchor.x - minWidth);
          nextMinY = Math.min(pointerWorld.y, activeTransform.anchor.y - minHeight);
          break;
        case "ne":
          nextMaxX = Math.max(pointerWorld.x, activeTransform.anchor.x + minWidth);
          nextMinY = Math.min(pointerWorld.y, activeTransform.anchor.y - minHeight);
          break;
        case "se":
          nextMaxX = Math.max(pointerWorld.x, activeTransform.anchor.x + minWidth);
          nextMaxY = Math.max(pointerWorld.y, activeTransform.anchor.y + minHeight);
          break;
        case "sw":
          nextMinX = Math.min(pointerWorld.x, activeTransform.anchor.x - minWidth);
          nextMaxY = Math.max(pointerWorld.y, activeTransform.anchor.y + minHeight);
          break;
      }

      const startWidth = Math.max(
        1,
        activeTransform.bounds.maxX - activeTransform.bounds.minX,
      );
      const startHeight = Math.max(
        1,
        activeTransform.bounds.maxY - activeTransform.bounds.minY,
      );
      let nextWidth = Math.max(minWidth, nextMaxX - nextMinX);
      let nextHeight = Math.max(minHeight, nextMaxY - nextMinY);

      if (lockAspectRatio) {
        const aspectRatio = startWidth / startHeight;
        const widthRatio = nextWidth / startWidth;
        const heightRatio = nextHeight / startHeight;

        if (widthRatio >= heightRatio) {
          nextHeight = Math.max(minHeight, nextWidth / aspectRatio);
        } else {
          nextWidth = Math.max(minWidth, nextHeight * aspectRatio);
        }

        switch (activeTransform.handle) {
          case "nw":
            nextMinX = activeTransform.anchor.x - nextWidth;
            nextMinY = activeTransform.anchor.y - nextHeight;
            break;
          case "ne":
            nextMaxX = activeTransform.anchor.x + nextWidth;
            nextMinY = activeTransform.anchor.y - nextHeight;
            break;
          case "se":
            nextMaxX = activeTransform.anchor.x + nextWidth;
            nextMaxY = activeTransform.anchor.y + nextHeight;
            break;
          case "sw":
            nextMinX = activeTransform.anchor.x - nextWidth;
            nextMaxY = activeTransform.anchor.y + nextHeight;
            break;
        }
      }

      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      activeTransform.items.forEach((itemState) => {
        const node = itemNodeByIdRef.current.get(itemState.itemId);
        if (!node) {
          return;
        }

        const relativeMinX =
          (itemState.minX - activeTransform.bounds.minX) / startWidth;
        const relativeMaxX =
          (itemState.maxX - activeTransform.bounds.minX) / startWidth;
        const relativeMinY =
          (itemState.minY - activeTransform.bounds.minY) / startHeight;
        const relativeMaxY =
          (itemState.maxY - activeTransform.bounds.minY) / startHeight;

        const itemMinX = nextMinX + relativeMinX * nextWidth;
        const itemMaxX = nextMinX + relativeMaxX * nextWidth;
        const itemMinY = nextMinY + relativeMinY * nextHeight;
        const itemMaxY = nextMinY + relativeMaxY * nextHeight;
        const visualWidth = Math.max(12, itemMaxX - itemMinX);
        const visualHeight = Math.max(12, itemMaxY - itemMinY);
        const nextScaleX = Math.max(0.08, visualWidth / itemState.width);
        const nextScaleY = Math.max(0.08, visualHeight / itemState.height);
        const nextResolvedScaleX =
          Math.sign(itemState.resolvedScaleX) * nextScaleX;
        const nextX = itemMinX;

        node.position.set(nextX, itemMinY);
        node.scale.set(nextResolvedScaleX, nextScaleY);
        activeTransform.patchBuffer[itemState.itemId] = {
          x: Math.round(nextX),
          y: Math.round(itemMinY),
          scaleX: nextScaleX,
          scaleY: nextScaleY,
        };
        activeTransform.hasChanged = true;

        minX = Math.min(minX, itemMinX);
        minY = Math.min(minY, itemMinY);
        maxX = Math.max(maxX, itemMaxX);
        maxY = Math.max(maxY, itemMaxY);
      });

      let nextInsets = ZERO_INSETS;
      if (
        Number.isFinite(minX) &&
        Number.isFinite(minY) &&
        Number.isFinite(maxX) &&
        Number.isFinite(maxY)
      ) {
        nextInsets = {
          left:
            minX < 0 ? Math.ceil(-minX + BOARD_EXPANSION_PADDING) : 0,
          top:
            minY < 0 ? Math.ceil(-minY + BOARD_EXPANSION_PADDING) : 0,
          right:
            maxX > groupRef.current.canvasSize.width
              ? Math.ceil(
                  maxX -
                    groupRef.current.canvasSize.width +
                    BOARD_EXPANSION_PADDING,
                )
              : 0,
          bottom:
            maxY > groupRef.current.canvasSize.height
              ? Math.ceil(
                  maxY -
                    groupRef.current.canvasSize.height +
                    BOARD_EXPANSION_PADDING,
                )
              : 0,
        };
      }

      setPreviewInsets(nextInsets);
      updateSelectedBoundsOverlayRef.current();
    },
    [
      activeSelectionTransformRef,
      clientPointToWorld,
      groupRef,
      itemNodeByIdRef,
      onCanvasSizePreviewChangeRef,
      previewInsetsRef,
      setPreviewInsets,
      updateSelectedBoundsOverlayRef,
    ],
  );

  const commitScaleTransform = useCallback(() => {
    const activeTransform = activeSelectionTransformRef.current;
    activeSelectionTransformRef.current = null;

    if (!activeTransform) {
      return;
    }

    setPreviewInsets(ZERO_INSETS);

    if (activeTransform.hasChanged && Object.keys(activeTransform.patchBuffer).length > 0) {
      onItemsPatchRef.current({ ...activeTransform.patchBuffer });
      return;
    }

    updateSelectedBoundsOverlayRef.current();
  }, [
    activeSelectionTransformRef,
    onItemsPatchRef,
    setPreviewInsets,
    updateSelectedBoundsOverlayRef,
  ]);

  const applyCropHandle = useCallback(
    (clientX: number, clientY: number) => {
      const activeCropHandle = activeCropHandleRef.current;
      const session = cropSessionRef.current;
      if (!activeCropHandle || !session || !onCropRectChange) {
        return;
      }

      const pointerWorld = clientPointToWorld(clientX, clientY);
      if (!pointerWorld) {
        return;
      }

      const imageWidth = Math.max(
        1,
        activeCropHandle.imageBounds.maxX - activeCropHandle.imageBounds.minX,
      );
      const imageHeight = Math.max(
        1,
        activeCropHandle.imageBounds.maxY - activeCropHandle.imageBounds.minY,
      );
      const normalizedX = Math.min(
        1,
        Math.max(
          0,
          (pointerWorld.x - activeCropHandle.imageBounds.minX) / imageWidth,
        ),
      );
      const normalizedY = Math.min(
        1,
        Math.max(
          0,
          (pointerWorld.y - activeCropHandle.imageBounds.minY) / imageHeight,
        ),
      );
      const nextRect = { ...activeCropHandle.startRect };
      const minSize = 0.04;

      switch (activeCropHandle.handle) {
        case "nw":
          nextRect.left = Math.min(normalizedX, nextRect.right - minSize);
          nextRect.top = Math.min(normalizedY, nextRect.bottom - minSize);
          break;
        case "ne":
          nextRect.right = Math.max(normalizedX, nextRect.left + minSize);
          nextRect.top = Math.min(normalizedY, nextRect.bottom - minSize);
          break;
        case "se":
          nextRect.right = Math.max(normalizedX, nextRect.left + minSize);
          nextRect.bottom = Math.max(normalizedY, nextRect.top + minSize);
          break;
        case "sw":
          nextRect.left = Math.min(normalizedX, nextRect.right - minSize);
          nextRect.bottom = Math.max(normalizedY, nextRect.top + minSize);
          break;
      }

      onCropRectChange(nextRect);
    },
    [activeCropHandleRef, clientPointToWorld, cropSessionRef, onCropRectChange],
  );

  const handleTransformHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const group = groupRef.current;
      if (!group || selectedItemIds.length === 0) {
        return;
      }

      const handle = event.currentTarget.dataset.handle as TransformHandle | undefined;
      if (!handle) {
        return;
      }

      if (cropSessionRef.current) {
        const cropTarget = group.items.find(
          (item): item is ImageItem =>
            item.id === cropSessionRef.current?.itemId && item.type === "image",
        );

        if (!cropTarget) {
          return;
        }

        const imageBounds = getItemBounds(cropTarget);
        activeCropHandleRef.current = {
          handle,
          startRect: cropSessionRef.current.rect,
          imageBounds,
        };
        return;
      }

      if (group.locked) {
        return;
      }

      const selectedItems = group.items.filter(
        (item): item is ImageItem | CaptureItem =>
          selectedItemIds.includes(item.id) && item.visible && !item.locked,
      );

      if (selectedItems.length === 0) {
        return;
      }

      const itemStates = selectedItems.map((item) => {
        const bounds = getItemBounds(item);
        return {
          itemId: item.id,
          x: item.x,
          y: item.y,
          width: bounds.width,
          height: bounds.height,
          scaleX: bounds.scaleX,
          scaleY: bounds.scaleY,
          resolvedScaleX: bounds.resolvedScaleX,
          flippedX: bounds.flippedX,
          minX: bounds.minX,
          minY: bounds.minY,
          maxX: bounds.maxX,
          maxY: bounds.maxY,
        };
      });

      const minX = Math.min(...itemStates.map((item) => item.minX));
      const minY = Math.min(...itemStates.map((item) => item.minY));
      const maxX = Math.max(...itemStates.map((item) => item.maxX));
      const maxY = Math.max(...itemStates.map((item) => item.maxY));

      const anchor =
        handle === "nw"
          ? { x: maxX, y: maxY }
          : handle === "ne"
            ? { x: minX, y: maxY }
            : handle === "se"
              ? { x: minX, y: minY }
              : { x: maxX, y: minY };

      activeSelectionTransformRef.current = {
        handle,
        anchor,
        bounds: { minX, minY, maxX, maxY },
        items: itemStates,
        patchBuffer: {},
        hasChanged: false,
      };
    },
    [
      activeCropHandleRef,
      activeSelectionTransformRef,
      cropSessionRef,
      getItemBounds,
      groupRef,
      selectedItemIds,
    ],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (activeCropHandleRef.current) {
        applyCropHandle(event.clientX, event.clientY);
        return;
      }

      if (activeSelectionTransformRef.current) {
        applyScaleTransform(event.clientX, event.clientY, !event.shiftKey);
      }
    };

    const handlePointerUp = () => {
      if (activeCropHandleRef.current) {
        activeCropHandleRef.current = null;
        return;
      }

      if (activeSelectionTransformRef.current) {
        commitScaleTransform();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    activeCropHandleRef,
    activeSelectionTransformRef,
    applyCropHandle,
    applyScaleTransform,
    commitScaleTransform,
  ]);

  return {
    handleTransformHandlePointerDown,
  };
};
