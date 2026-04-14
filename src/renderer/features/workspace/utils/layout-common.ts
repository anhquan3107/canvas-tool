import type { ReferenceGroup } from "@shared/types/project";
import { DEFAULT_VIEW_ZOOM_BASELINE } from "@shared/project-defaults";
import { BOARD_EXPANSION_PADDING } from "@renderer/pixi/constants";
import type { ImagePatch } from "@renderer/features/workspace/types";

export const CANVAS_EXPANSION_PADDING = BOARD_EXPANSION_PADDING;
export const MIN_CANVAS_WIDTH = 360;
export const MIN_CANVAS_HEIGHT = 240;

export type LayoutItem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
  zIndex?: number;
  visible?: boolean;
};

export const getVisualBounds = (item: LayoutItem) => {
  const safeWidth = Math.max(1, item.width);
  const safeHeight = Math.max(1, item.height);
  const safeScaleX =
    Number.isFinite(item.scaleX) && item.scaleX && item.scaleX !== 0
      ? Math.abs(item.scaleX)
      : 1;
  const safeScaleY =
    Number.isFinite(item.scaleY) && item.scaleY && item.scaleY !== 0
      ? Math.abs(item.scaleY)
      : 1;

  return {
    minX: item.x,
    minY: item.y,
    maxX: item.x + safeWidth * safeScaleX,
    maxY: item.y + safeHeight * safeScaleY,
  };
};

export const getFocusedGroupView = (
  items: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX?: number;
    scaleY?: number;
  }>,
  canvasSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
) => {
  if (items.length === 0) {
    return null;
  }

  const bounds = items.reduce(
    (acc, item) => {
      const visualBounds = getVisualBounds({
        id: "",
        ...item,
      });
      return {
        minX: Math.min(acc.minX, visualBounds.minX),
        minY: Math.min(acc.minY, visualBounds.minY),
        maxX: Math.max(acc.maxX, visualBounds.maxX),
        maxY: Math.max(acc.maxY, visualBounds.maxY),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  const viewportWidth = Math.max(420, viewportSize.width);
  const viewportHeight = Math.max(320, viewportSize.height);
  const fitPadding = 64;
  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);

  const fitZoom = Math.max(
    0.18,
    Math.min(
      viewportWidth / (boundsWidth + fitPadding * 2),
      viewportHeight / (boundsHeight + fitPadding * 2),
      1,
    ),
  );
  const baselineZoom = fitZoom * DEFAULT_VIEW_ZOOM_BASELINE;

  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const centerY = (bounds.minY + bounds.maxY) * 0.5;

  const unclampedPanX = viewportWidth * 0.5 - centerX * baselineZoom;
  const unclampedPanY = viewportHeight * 0.5 - centerY * baselineZoom;

  const scaledCanvasWidth = canvasSize.width * baselineZoom;
  const scaledCanvasHeight = canvasSize.height * baselineZoom;
  const panX =
    scaledCanvasWidth <= viewportWidth
      ? (viewportWidth - scaledCanvasWidth) * 0.5
      : Math.min(
          24,
          Math.max(viewportWidth - scaledCanvasWidth - 24, unclampedPanX),
        );
  const panY =
    scaledCanvasHeight <= viewportHeight
      ? (viewportHeight - scaledCanvasHeight) * 0.5
      : Math.min(
          24,
          Math.max(viewportHeight - scaledCanvasHeight - 24, unclampedPanY),
        );

  return {
    zoom: baselineZoom,
    panX,
    panY,
  };
};

export const calculateImportVisibilitySnapshot = (
  activeGroup: ReferenceGroup | undefined,
  lastImportedItemIds: string[],
) => {
  if (!activeGroup || lastImportedItemIds.length === 0) {
    return null;
  }

  const importedSet = new Set(lastImportedItemIds);
  const importedItems = activeGroup.items.filter(
    (item): item is Extract<(typeof activeGroup.items)[number], { type: "image" }> =>
      item.type === "image" && importedSet.has(item.id),
  );

  if (importedItems.length === 0) {
    return {
      total: 0,
      visible: 0,
      ready: 0,
      blocked: 0,
      offCanvas: 0,
    };
  }

  const offCanvas = importedItems.filter((item) => {
    const right = item.x + item.width;
    const bottom = item.y + item.height;
    return (
      right < 0 ||
      bottom < 0 ||
      item.x > activeGroup.canvasSize.width ||
      item.y > activeGroup.canvasSize.height
    );
  }).length;

  return {
    total: importedItems.length,
    visible: importedItems.filter((item) => item.visible).length,
    ready: importedItems.filter((item) => item.previewStatus === "ready").length,
    blocked: importedItems.filter((item) => item.previewStatus === "blocked").length,
    offCanvas,
  };
};

export const getCanvasExpansionPlan = (
  items: LayoutItem[],
  currentSize: { width: number; height: number },
) => {
  const visibleItems = items.filter((item) => item.visible !== false);
  if (visibleItems.length === 0) {
    return null;
  }

  const visualBounds = visibleItems.map(getVisualBounds);
  const minX = Math.min(...visualBounds.map((item) => item.minX));
  const minY = Math.min(...visualBounds.map((item) => item.minY));
  const expandLeft = Math.max(
    0,
    Math.ceil(
      Math.max(0, -minX) + (minX < 0 ? CANVAS_EXPANSION_PADDING : 0),
    ),
  );
  const expandTop = Math.max(
    0,
    Math.ceil(
      Math.max(0, -minY) + (minY < 0 ? CANVAS_EXPANSION_PADDING : 0),
    ),
  );

  const normalizedItems =
    expandLeft > 0 || expandTop > 0
      ? items.map((item) => ({
          ...item,
          x: item.x + expandLeft,
          y: item.y + expandTop,
        }))
      : items;
  const normalizedVisibleItems = normalizedItems.filter(
    (item) => item.visible !== false,
  );

  const requiredWidth = Math.max(
    currentSize.width + expandLeft,
    ...normalizedVisibleItems.map((item) => {
      const visualBounds = getVisualBounds(item);
      return Math.ceil(visualBounds.maxX + CANVAS_EXPANSION_PADDING);
    }),
  );
  const requiredHeight = Math.max(
    currentSize.height + expandTop,
    ...normalizedVisibleItems.map((item) => {
      const visualBounds = getVisualBounds(item);
      return Math.ceil(visualBounds.maxY + CANVAS_EXPANSION_PADDING);
    }),
  );

  const shiftedUpdates =
    expandLeft > 0 || expandTop > 0
      ? (Object.fromEntries(
          normalizedItems.map((item) => [
            item.id,
            { x: Math.round(item.x), y: Math.round(item.y) },
          ]),
        ) as Record<string, ImagePatch>)
      : null;

  return {
    expandLeft,
    expandTop,
    requiredWidth,
    requiredHeight,
    shiftedUpdates,
  };
};

export const getFittedCanvas = (group: ReferenceGroup) => {
  const visibleItems = group.items.filter((item) => item.visible !== false);
  if (visibleItems.length === 0) {
    return null;
  }

  const visualBounds = visibleItems.map(getVisualBounds);
  const minX = Math.min(...visualBounds.map((item) => item.minX));
  const minY = Math.min(...visualBounds.map((item) => item.minY));
  const maxX = Math.max(...visualBounds.map((item) => item.maxX));
  const maxY = Math.max(...visualBounds.map((item) => item.maxY));
  const shiftX = Math.round(CANVAS_EXPANSION_PADDING - minX);
  const shiftY = Math.round(CANVAS_EXPANSION_PADDING - minY);
  const nextWidth = Math.max(
    MIN_CANVAS_WIDTH,
    Math.ceil(maxX - minX + CANVAS_EXPANSION_PADDING * 2),
  );
  const nextHeight = Math.max(
    MIN_CANVAS_HEIGHT,
    Math.ceil(maxY - minY + CANVAS_EXPANSION_PADDING * 2),
  );
  const updates = Object.fromEntries(
    group.items.map((item) => [
      item.id,
      { x: Math.round(item.x + shiftX), y: Math.round(item.y + shiftY) },
    ]),
  ) as Record<string, ImagePatch>;

  return {
    canvasSize: { width: nextWidth, height: nextHeight },
    updates,
  };
};
