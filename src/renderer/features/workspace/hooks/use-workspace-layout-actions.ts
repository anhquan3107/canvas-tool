import { useCallback } from "react";
import type { LayoutMode, ReferenceGroup } from "@shared/types/project";
import type { ImagePatch, ToastKind } from "@renderer/features/workspace/types";
import {
  buildArrangeSelectedItemsUpdates,
  buildAutoArrangeUpdates,
} from "@renderer/features/workspace/utils/layout";

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
  const arrangeSelectedItems = useCallback(
    (mode: LayoutMode) => {
      if (!activeGroup || selectedItemIds.length === 0) {
        pushToast("info", "No selected items to arrange.");
        return;
      }

      const selectedItems = activeGroup.items
        .filter((item) => selectedItemIds.includes(item.id))
        .sort((left, right) => left.zIndex - right.zIndex);

      if (selectedItems.length === 0) {
        pushToast("info", "No selected items to arrange.");
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

      pushToast(
        "success",
        "Selected items auto arranged.",
      );
    },
    [
      activeGroup,
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
      pushToast("info", "Nothing to arrange.");
      return;
    }

    const updates = buildAutoArrangeUpdates(
      visibleItems,
      activeGroup.canvasSize.width,
    );

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

    pushToast("success", "Items arranged across the canvas.");
  }, [
    activeGroup,
    ensureCanvasFitsItems,
    patchGroupItems,
    pushToast,
    runHistoryBatch,
  ]);

  return {
    arrangeSelectedItems,
    autoArrange,
  };
};
