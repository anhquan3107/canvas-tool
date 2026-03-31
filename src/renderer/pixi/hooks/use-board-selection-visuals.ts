import { Graphics, Container } from "pixi.js";

export const SELECTION_DIM_ALPHA = 0.34;
export const SELECTION_HIGHLIGHT_ALPHA = 0.08;
export const SELECTION_HIGHLIGHT_NAME = "selection-highlight";

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

  highlightOverlay.alpha =
    hasSelection && isSelected ? SELECTION_HIGHLIGHT_ALPHA : 0;
  highlightOverlay.visible = !hasSelection || isSelected;
};
