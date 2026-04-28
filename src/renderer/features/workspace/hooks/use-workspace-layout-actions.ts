import { useCallback } from "react";
import type {
  CanvasItem,
  ImageItem,
  LayoutMode,
  ReferenceGroup,
} from "@shared/types/project";
import { DEFAULT_EMPTY_GROUP_CANVAS_SIZE } from "@shared/project-defaults";
import { normalizePreviewSize } from "@renderer/features/import/import-queue";
import type { ImagePatch, ToastKind } from "@renderer/features/workspace/types";
import {
  buildArrangeSelectedItemsUpdates,
  buildAutoArrangeUpdates,
} from "@renderer/features/workspace/utils/layout";
import { useI18n } from "@renderer/i18n";

const getStableArrangeSize = (item: CanvasItem) => {
  if (item.type !== "image") {
    return {
      width: item.width,
      height: item.height,
    };
  }

  const imageItem = item as ImageItem;
  const sourceWidth =
    imageItem.cropWidth ?? imageItem.originalWidth ?? imageItem.width;
  const sourceHeight =
    imageItem.cropHeight ?? imageItem.originalHeight ?? imageItem.height;

  return normalizePreviewSize(sourceWidth, sourceHeight);
};

const isWithinArrangeTolerance = (
  nextValue: number | undefined,
  currentValue: number,
  tolerance = 2,
) => {
  if (nextValue === undefined) {
    return true;
  }

  return Math.abs(nextValue - currentValue) <= tolerance;
};

interface UseWorkspaceLayoutActionsOptions {
  activeGroup: ReferenceGroup | undefined;
  selectedItemIds: string[];
  patchGroupItems: (groupId: string, updates: Record<string, ImagePatch>) => void;
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

export const useWorkspaceLayoutActions = ({
  activeGroup,
  selectedItemIds,
  patchGroupItems,
  pushToast,
  runHistoryBatch,
  ensureCanvasFitsItems,
}: UseWorkspaceLayoutActionsOptions) => {
  const { copy } = useI18n();
  const hasMeaningfulPatchChanges = useCallback(
    (updates: Record<string, ImagePatch>) => {
      if (!activeGroup) {
        return false;
      }

      return Object.entries(updates).some(([itemId, patch]) => {
        const currentItem = activeGroup.items.find((item) => item.id === itemId);
        if (!currentItem) {
          return true;
        }

        return (
          !isWithinArrangeTolerance(patch.x, currentItem.x) ||
          !isWithinArrangeTolerance(patch.y, currentItem.y) ||
          !isWithinArrangeTolerance(patch.width, currentItem.width) ||
          !isWithinArrangeTolerance(patch.height, currentItem.height) ||
          (patch.scaleX !== undefined &&
            !isWithinArrangeTolerance(patch.scaleX, currentItem.scaleX)) ||
          (patch.scaleY !== undefined &&
            !isWithinArrangeTolerance(patch.scaleY, currentItem.scaleY)) ||
          (patch.zIndex !== undefined && patch.zIndex !== currentItem.zIndex) ||
          (patch.visible !== undefined && patch.visible !== currentItem.visible)
        );
      });
    },
    [activeGroup],
  );

  const arrangeSelectedItems = useCallback(
    (mode: LayoutMode) => {
      if (!activeGroup || selectedItemIds.length === 0) {
        pushToast("info", copy.toasts.noSelectedItemsToArrange);
        return;
      }

      const selectedItems = activeGroup.items
        .filter((item) => selectedItemIds.includes(item.id))
        .sort((left, right) => left.zIndex - right.zIndex);

      if (selectedItems.length === 0) {
        pushToast("info", copy.toasts.noSelectedItemsToArrange);
        return;
      }

      const updates = buildArrangeSelectedItemsUpdates(selectedItems, mode);

      runHistoryBatch(() => {
        patchGroupItems(activeGroup.id, updates);

        const nextItems = activeGroup.items.map((item) => ({
          ...item,
          ...updates[item.id],
        }));
        ensureCanvasFitsItems(activeGroup.id, nextItems, activeGroup.canvasSize, {
          zoom: activeGroup.zoom,
          panX: activeGroup.panX,
          panY: activeGroup.panY,
        });
      });

      pushToast("success", copy.toasts.selectedItemsAutoArranged);
    },
    [
      activeGroup,
      copy.toasts.noSelectedItemsToArrange,
      copy.toasts.selectedItemsAutoArranged,
      ensureCanvasFitsItems,
      patchGroupItems,
      pushToast,
      runHistoryBatch,
      selectedItemIds,
    ],
  );

  const autoArrange = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    const visibleItems = activeGroup.items
      .filter((item) => item.visible)
      .sort((left, right) => left.zIndex - right.zIndex);

    if (visibleItems.length === 0) {
      pushToast("info", copy.toasts.nothingToArrange);
      return;
    }

    const arrangeItems = visibleItems.map((item) => {
      const stableSize = getStableArrangeSize(item);
      return {
        ...item,
        width: stableSize.width,
        height: stableSize.height,
      };
    });

    const updates = buildAutoArrangeUpdates(
      arrangeItems,
      Math.min(
        activeGroup.canvasSize.width,
        DEFAULT_EMPTY_GROUP_CANVAS_SIZE.width,
      ),
    );

    visibleItems.forEach((item) => {
      updates[item.id] = {
        ...updates[item.id],
        scaleX: 1,
        scaleY: 1,
      };
    });

    if (!hasMeaningfulPatchChanges(updates)) {
      return;
    }

    runHistoryBatch(() => {
      patchGroupItems(activeGroup.id, updates);

      const nextItems = activeGroup.items.map((item) => ({
        ...item,
        ...updates[item.id],
      }));

      ensureCanvasFitsItems(
        activeGroup.id,
        nextItems,
        activeGroup.canvasSize,
        {
          zoom: activeGroup.zoom,
          panX: activeGroup.panX,
          panY: activeGroup.panY,
        },
      );
    });

    pushToast("success", copy.toasts.itemsArrangedAcrossCanvas);
  }, [
    activeGroup,
    copy.toasts.itemsArrangedAcrossCanvas,
    copy.toasts.nothingToArrange,
    ensureCanvasFitsItems,
    hasMeaningfulPatchChanges,
    patchGroupItems,
    pushToast,
    runHistoryBatch,
  ]);

  return {
    arrangeSelectedItems,
    autoArrange,
  };
};
