import type { LayoutMode, ReferenceGroup } from "@shared/types/project";
import {
  DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
  DEFAULT_VIEW_ZOOM_BASELINE,
} from "@shared/project-defaults";
import { IMAGE_LAYOUT_GAP, SNAP_GAP } from "@renderer/pixi/constants";
import type { ImagePatch } from "@renderer/features/workspace/types";

export const CANVAS_EXPANSION_PADDING = IMAGE_LAYOUT_GAP;
export const MIN_CANVAS_WIDTH = 360;
export const MIN_CANVAS_HEIGHT = 240;

type LayoutItem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  visible?: boolean;
};

export const buildAutoArrangeUpdates = (
  items: Array<{
    id: string;
    width: number;
    height: number;
    zIndex: number;
    visible?: boolean;
  }>,
  canvasWidth: number,
) => {
  const visibleItems = items
    .filter((item) => item.visible !== false)
    .sort((left, right) => left.zIndex - right.zIndex);

  if (visibleItems.length === 0) {
    return {} as Record<string, ImagePatch>;
  }

  const padding = SNAP_GAP;
  const availableWidth = Math.max(
    240,
    canvasWidth - padding * 2,
  );
  const totalArea = visibleItems.reduce((sum, item) => sum + item.width * item.height, 0);
  const totalAspect = visibleItems.reduce(
    (sum, item) => sum + item.width / Math.max(1, item.height),
    0,
  );
  const estimatedRowCount = Math.max(
    1,
    Math.round(
      Math.sqrt(
        Math.max(1, totalArea) /
          Math.max(1, availableWidth * (DEFAULT_EMPTY_GROUP_CANVAS_SIZE.height * 0.9)),
      ),
    ),
  );
  const targetRowHeight = Math.max(
    120,
    Math.min(
      360,
      Math.round(totalArea / Math.max(1, availableWidth * estimatedRowCount)),
    ),
  );

  const rows: typeof visibleItems[] = [];
  let currentRow: typeof visibleItems = [];
  let currentRowWidthAtTarget = 0;

  visibleItems.forEach((item) => {
    const aspectRatio = item.width / Math.max(1, item.height);
    const projectedWidth = aspectRatio * targetRowHeight;
    const nextWidth =
      currentRowWidthAtTarget +
      projectedWidth +
      (currentRow.length > 0 ? padding : 0);

    currentRow.push(item);
    currentRowWidthAtTarget = nextWidth;

    if (
      currentRow.length > 1 &&
      currentRowWidthAtTarget >= availableWidth * 0.92
    ) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidthAtTarget = 0;
    }
  });

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  if (rows.length > 1 && rows.at(-1)?.length === 1) {
    const lastRow = rows[rows.length - 1];
    const previousRow = rows[rows.length - 2];
    const movedItem = previousRow?.pop();
    if (movedItem) {
      lastRow?.unshift(movedItem);
    }
    if (previousRow && previousRow.length === 0) {
      rows.splice(rows.length - 2, 1);
    }
  }

  const updates: Record<string, ImagePatch> = {};
  let cursorY = padding;

  rows.forEach((row) => {
    const totalAspectRatio = row.reduce(
      (sum, item) => sum + item.width / Math.max(1, item.height),
      0,
    );
    const rowHeight = Math.max(
      80,
      Math.round(
        (availableWidth - padding * Math.max(0, row.length - 1)) /
          Math.max(totalAspectRatio, 0.0001),
      ),
    );

    let cursorX = padding;

    row.forEach((item, index) => {
      const aspectRatio = item.width / Math.max(1, item.height);
      const nextHeight = rowHeight;
      const remainingWidth = availableWidth - (cursorX - padding);
      const isLastInRow = index === row.length - 1;
      const nextWidth = isLastInRow
        ? Math.max(1, Math.round(remainingWidth))
        : Math.max(1, Math.round(nextHeight * aspectRatio));

      updates[item.id] = {
        x: Math.round(cursorX),
        y: Math.round(cursorY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      };

      cursorX += nextWidth + padding;
    });

    cursorY += rowHeight + padding;
  });

  return updates;
};

export const getFocusedGroupView = (
  items: Array<{ x: number; y: number; width: number; height: number }>,
  canvasSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
) => {
  if (items.length === 0) {
    return null;
  }

  const bounds = items.reduce(
    (acc, item) => ({
      minX: Math.min(acc.minX, item.x),
      minY: Math.min(acc.minY, item.y),
      maxX: Math.max(acc.maxX, item.x + item.width),
      maxY: Math.max(acc.maxY, item.y + item.height),
    }),
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

  const minX = Math.min(...visibleItems.map((item) => item.x));
  const minY = Math.min(...visibleItems.map((item) => item.y));
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
    ...normalizedVisibleItems.map((item) =>
      Math.ceil(item.x + item.width + CANVAS_EXPANSION_PADDING),
    ),
  );
  const requiredHeight = Math.max(
    currentSize.height + expandTop,
    ...normalizedVisibleItems.map((item) =>
      Math.ceil(item.y + item.height + CANVAS_EXPANSION_PADDING),
    ),
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

  const minX = Math.min(...visibleItems.map((item) => item.x));
  const minY = Math.min(...visibleItems.map((item) => item.y));
  const maxX = Math.max(...visibleItems.map((item) => item.x + item.width));
  const maxY = Math.max(...visibleItems.map((item) => item.y + item.height));
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

export const buildArrangeSelectedItemsUpdates = (
  items: LayoutItem[],
  mode: LayoutMode,
) => {
  if (items.length === 0) {
    return {} as Record<string, ImagePatch>;
  }

  const selectedItems = [...items].sort(
    (left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0),
  );
  const anchorX = Math.min(...selectedItems.map((item) => item.x));
  const anchorY = Math.min(...selectedItems.map((item) => item.y));
  const gap = SNAP_GAP;
  const updates: Record<string, ImagePatch> = {};

  if (mode === "horizontal") {
    let cursorX = anchorX;
    selectedItems.forEach((item) => {
      updates[item.id] = { x: Math.round(cursorX), y: Math.round(anchorY) };
      cursorX += item.width + gap;
    });
    return updates;
  }

  const columnCount = Math.min(
    4,
    Math.max(2, Math.ceil(Math.sqrt(selectedItems.length))),
  );
  const columnWidth = Math.max(...selectedItems.map((item) => item.width)) + gap;
  const columnHeights = Array.from({ length: columnCount }, () => anchorY);

  selectedItems.forEach((item) => {
    let columnIndex = 0;
    for (let index = 1; index < columnHeights.length; index += 1) {
      if (columnHeights[index] < columnHeights[columnIndex]) {
        columnIndex = index;
      }
    }

    updates[item.id] = {
      x: Math.round(anchorX + columnIndex * columnWidth),
      y: Math.round(columnHeights[columnIndex]),
    };
    columnHeights[columnIndex] += item.height + gap;
  });

  return updates;
};
