import { Container, Graphics } from "pixi.js";
import type { CanvasItem } from "@shared/types/project";

export const SELECTION_DIM_ALPHA = 0.34;
export const SELECTION_HIGHLIGHT_ALPHA = 0.08;
export const SELECTION_HIGHLIGHT_NAME = "selection-highlight";

const compareItemsForSelectionRenderOrder = (
  left: Pick<CanvasItem, "id" | "zIndex">,
  right: Pick<CanvasItem, "id" | "zIndex">,
  selectionIds: Set<string>,
) => {
  const leftSelected = selectionIds.has(left.id);
  const rightSelected = selectionIds.has(right.id);

  if (leftSelected !== rightSelected) {
    return leftSelected ? 1 : -1;
  }

  return left.zIndex - right.zIndex;
};

export const applySelectionVisualState = (
  itemNode: Container,
  itemId: string,
  selectionIds: string[],
) => {
  const hasSelection = selectionIds.length > 0;
  const isSelected = selectionIds.includes(itemId);
  itemNode.alpha = hasSelection ? (isSelected ? 1 : SELECTION_DIM_ALPHA) : 1;

  const highlightOverlay = itemNode.getChildByName(
    SELECTION_HIGHLIGHT_NAME,
  ) as Graphics | null;
  if (!highlightOverlay) {
    return;
  }

  highlightOverlay.alpha = 0;
  highlightOverlay.visible = false;
};

export const syncSelectionItemOrder = (
  itemLayer: Container | null,
  itemNodeById: Map<string, Container>,
  items: CanvasItem[],
  selectionIds: string[],
) => {
  if (!itemLayer) {
    return;
  }

  const selectionSet = new Set(selectionIds);
  const orderedItems = items
    .filter((item) => item.visible)
    .slice()
    .sort((left, right) =>
      compareItemsForSelectionRenderOrder(left, right, selectionSet),
    );

  orderedItems.forEach((item) => {
    const itemNode = itemNodeById.get(item.id);
    if (itemNode) {
      itemLayer.addChild(itemNode);
    }
  });
};
