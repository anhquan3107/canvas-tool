import {
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { CanvasItem, ImageItem, ReferenceGroup } from "@shared/types/project";
import type { ImagePatch, ToastKind } from "@renderer/features/workspace/types";

interface UseWorkspaceClipboardActionsOptions {
  activeGroup: ReferenceGroup | undefined;
  clipboardItems: CanvasItem[];
  selectedItemIds: string[];
  addGroupItems: (groupId: string, items: CanvasItem[]) => void;
  removeGroupItems: (groupId: string, itemIds: string[]) => void;
  patchGroupItems: (groupId: string, updates: Record<string, ImagePatch>) => void;
  flipItems: (groupId: string, itemIds: string[]) => void;
  setClipboardItems: Dispatch<SetStateAction<CanvasItem[]>>;
  setSelectedItemIds: Dispatch<SetStateAction<string[]>>;
  pushToast: (kind: ToastKind, message: string) => void;
  runHistoryBatch: (callback: () => void) => void;
  ensureCanvasFitsItems: (
    groupId: string,
    items: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      scaleX?: number;
      scaleY?: number;
      visible?: boolean;
    }>,
    currentSize: { width: number; height: number },
    currentView?: { zoom: number; panX: number; panY: number },
  ) => void;
}

export const useWorkspaceClipboardActions = ({
  activeGroup,
  clipboardItems,
  selectedItemIds,
  addGroupItems,
  removeGroupItems,
  patchGroupItems,
  flipItems,
  setClipboardItems,
  setSelectedItemIds,
  pushToast,
  runHistoryBatch,
  ensureCanvasFitsItems,
}: UseWorkspaceClipboardActionsOptions) => {
  const copySelectedItemsToClipboard = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected items to copy.");
      return;
    }

    const selectedItems = activeGroup.items
      .filter((item) => selectedItemIds.includes(item.id))
      .sort((left, right) => left.zIndex - right.zIndex);

    if (selectedItems.length === 0) {
      pushToast("info", "No selected items to copy.");
      return;
    }

    setClipboardItems(structuredClone(selectedItems));
    pushToast("success", `Copied ${selectedItems.length} item(s) to clipboard.`);
  }, [activeGroup, pushToast, selectedItemIds, setClipboardItems]);

  const cutSelectedItems = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected items to cut.");
      return;
    }

    if (activeGroup.locked) {
      pushToast("info", "Canvas is locked.");
      return;
    }

    const selectedItems = activeGroup.items
      .filter((item) => selectedItemIds.includes(item.id))
      .sort((left, right) => left.zIndex - right.zIndex);

    if (selectedItems.length === 0) {
      pushToast("info", "No selected items to cut.");
      return;
    }

    setClipboardItems(structuredClone(selectedItems));
    runHistoryBatch(() => {
      removeGroupItems(activeGroup.id, selectedItemIds);
      setSelectedItemIds([]);
    });
    pushToast("success", "Selected item(s) cut.");
  }, [
    activeGroup,
    pushToast,
    removeGroupItems,
    runHistoryBatch,
    selectedItemIds,
    setClipboardItems,
    setSelectedItemIds,
  ]);

  const pasteClipboardItems = useCallback(() => {
    if (!activeGroup || clipboardItems.length === 0) {
      pushToast("info", "Clipboard is empty.");
      return;
    }

    if (activeGroup.locked) {
      pushToast("info", "Canvas is locked.");
      return;
    }

    const maxExistingZ = activeGroup.items.reduce(
      (acc, item) => Math.max(acc, item.zIndex),
      -1,
    );

    const duplicates = clipboardItems.map((item, index) => ({
      ...structuredClone(item),
      id: crypto.randomUUID(),
      x: item.x + 24,
      y: item.y + 24,
      zIndex: maxExistingZ + index + 1,
    }));

    runHistoryBatch(() => {
      addGroupItems(activeGroup.id, duplicates);
      setSelectedItemIds(duplicates.map((item) => item.id));
      ensureCanvasFitsItems(
        activeGroup.id,
        [...activeGroup.items, ...duplicates],
        activeGroup.canvasSize,
        {
          zoom: activeGroup.zoom,
          panX: activeGroup.panX,
          panY: activeGroup.panY,
        },
      );
    });

    pushToast("success", `Pasted ${duplicates.length} item(s).`);
  }, [
    activeGroup,
    addGroupItems,
    clipboardItems,
    ensureCanvasFitsItems,
    pushToast,
    runHistoryBatch,
    setSelectedItemIds,
  ]);

  const deleteSelectedItems = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected images to delete.");
      return;
    }

    if (activeGroup.locked) {
      pushToast("info", "Canvas is locked.");
      return;
    }

    runHistoryBatch(() => {
      removeGroupItems(activeGroup.id, selectedItemIds);
      setSelectedItemIds([]);
    });
    pushToast("success", "Selected image(s) deleted.");
  }, [
    activeGroup,
    pushToast,
    removeGroupItems,
    runHistoryBatch,
    selectedItemIds,
    setSelectedItemIds,
  ]);

  const flipSelectedItemsHorizontally = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected images to flip.");
      return;
    }

    if (activeGroup.locked) {
      pushToast("info", "Canvas is locked.");
      return;
    }

    runHistoryBatch(() => {
      flipItems(activeGroup.id, selectedItemIds);
    });
    pushToast("success", "Selected image(s) flipped horizontally.");
  }, [activeGroup, flipItems, pushToast, runHistoryBatch, selectedItemIds]);

  const applyCropToSelectedImage = useCallback(
    (cropRect: { left: number; top: number; right: number; bottom: number }) => {
      if (!activeGroup || selectedItemIds.length !== 1) {
        pushToast("info", "Select exactly one image to crop.");
        return;
      }

      if (activeGroup.locked) {
        pushToast("info", "Canvas is locked.");
        return;
      }

      const targetItem = activeGroup.items.find(
        (item): item is ImageItem =>
          item.id === selectedItemIds[0] && item.type === "image",
      );

      if (!targetItem) {
        pushToast("info", "Select exactly one image to crop.");
        return;
      }

      const safeScaleX =
        Number.isFinite(targetItem.scaleX) && targetItem.scaleX !== 0
          ? Math.abs(targetItem.scaleX)
          : 1;
      const safeScaleY =
        Number.isFinite(targetItem.scaleY) && targetItem.scaleY !== 0
          ? Math.abs(targetItem.scaleY)
          : 1;
      const currentCropX = targetItem.cropX ?? 0;
      const currentCropY = targetItem.cropY ?? 0;
      const currentCropWidth =
        targetItem.cropWidth ?? targetItem.originalWidth ?? targetItem.width;
      const currentCropHeight =
        targetItem.cropHeight ?? targetItem.originalHeight ?? targetItem.height;
      const normalizedLeft = Math.max(0, Math.min(cropRect.left, 0.98));
      const normalizedTop = Math.max(0, Math.min(cropRect.top, 0.98));
      const normalizedRight = Math.max(
        normalizedLeft + 0.02,
        Math.min(1, cropRect.right),
      );
      const normalizedBottom = Math.max(
        normalizedTop + 0.02,
        Math.min(1, cropRect.bottom),
      );
      const nextCropWidth = Math.max(
        1,
        Math.round((normalizedRight - normalizedLeft) * currentCropWidth),
      );
      const nextCropHeight = Math.max(
        1,
        Math.round((normalizedBottom - normalizedTop) * currentCropHeight),
      );
      const nextCropX = Math.round(
        currentCropX +
          (targetItem.flippedX ? 1 - normalizedRight : normalizedLeft) *
            currentCropWidth,
      );
      const nextCropY = Math.round(currentCropY + normalizedTop * currentCropHeight);

      const visualWidth = targetItem.width * safeScaleX;
      const visualHeight = targetItem.height * safeScaleY;
      const visualMinX = targetItem.x;
      const visualMinY = targetItem.y;
      const nextVisualMinX = visualMinX + normalizedLeft * visualWidth;
      const nextVisualMinY = visualMinY + normalizedTop * visualHeight;
      const nextVisualWidth = (normalizedRight - normalizedLeft) * visualWidth;
      const nextWidth = Math.max(12, Math.round(nextVisualWidth / safeScaleX));
      const nextHeight = Math.max(
        12,
        Math.round(((normalizedBottom - normalizedTop) * visualHeight) / safeScaleY),
      );
      const nextX = Math.round(nextVisualMinX);
      const nextY = Math.round(nextVisualMinY);

      runHistoryBatch(() => {
        patchGroupItems(activeGroup.id, {
          [targetItem.id]: {
            x: nextX,
            y: nextY,
            width: nextWidth,
            height: nextHeight,
            cropX: nextCropX,
            cropY: nextCropY,
            cropWidth: nextCropWidth,
            cropHeight: nextCropHeight,
          },
        });
      });

      pushToast("success", "Image cropped.");
    },
    [activeGroup, patchGroupItems, pushToast, runHistoryBatch, selectedItemIds],
  );

  return {
    copySelectedItemsToClipboard,
    cutSelectedItems,
    pasteClipboardItems,
    deleteSelectedItems,
    flipSelectedItemsHorizontally,
    applyCropToSelectedImage,
  };
};
