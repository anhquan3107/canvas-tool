import type { LayoutMode } from "@shared/types/project";
import { SNAP_GAP } from "@renderer/pixi/constants";
import type { ImagePatch } from "@renderer/features/workspace/types";
import { buildAutoArrangeUpdates } from "@renderer/features/workspace/utils/layout-horizontal";
import type { LayoutItem } from "@renderer/features/workspace/utils/layout-common";

export const buildArrangeSelectedItemsUpdates = (
  items: LayoutItem[],
  _mode: LayoutMode,
) => {
  if (items.length === 0) {
    return {} as Record<string, ImagePatch>;
  }

  const selectedItems = [...items].sort(
    (left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0),
  );
  const anchorX = Math.min(...selectedItems.map((item) => item.x));
  const anchorY = Math.min(...selectedItems.map((item) => item.y));
  const maxX = Math.max(...selectedItems.map((item) => item.x + item.width));
  const selectionWidth = Math.max(
    240,
    Math.ceil(maxX - anchorX + SNAP_GAP * 2),
  );

  const arrangedUpdates = buildAutoArrangeUpdates(
    selectedItems.map((item) => ({
      id: item.id,
      width: item.width,
      height: item.height,
      zIndex: item.zIndex ?? 0,
      visible: item.visible,
    })),
    selectionWidth,
  );

  const offsetX = anchorX - SNAP_GAP;
  const offsetY = anchorY - SNAP_GAP;

  return Object.fromEntries(
    Object.entries(arrangedUpdates).map(([itemId, patch]) => [
      itemId,
      {
        x: Math.round((patch.x ?? 0) + offsetX),
        y: Math.round((patch.y ?? 0) + offsetY),
        width: patch.width,
        height: patch.height,
      },
    ]),
  ) as Record<string, ImagePatch>;
};
