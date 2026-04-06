import { DEFAULT_EMPTY_GROUP_CANVAS_SIZE } from "@shared/project-defaults";
import { SNAP_GAP } from "@renderer/pixi/constants";
import type { ImagePatch } from "@renderer/features/workspace/types";

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
  const totalArea = visibleItems.reduce((sum, item) => sum + item.width * item.height, 0);

  const buildLayoutForWidth = (availableWidth: number) => {
    const estimatedRowCount = Math.max(
      1,
      Math.round(
        Math.sqrt(
          Math.max(1, totalArea) /
            Math.max(
              1,
              availableWidth * (DEFAULT_EMPTY_GROUP_CANVAS_SIZE.height * 0.9),
            ),
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

    const rowHeights = rows.map((row) => {
      const totalAspectRatio = row.reduce(
        (sum, item) => sum + item.width / Math.max(1, item.height),
        0,
      );

      return Math.max(
        80,
        Math.round(
          (availableWidth - padding * Math.max(0, row.length - 1)) /
            Math.max(totalAspectRatio, 0.0001),
        ),
      );
    });

    const totalHeight =
      padding +
      rowHeights.reduce((sum, rowHeight) => sum + rowHeight + padding, 0);
    const outerWidth = availableWidth + padding * 2;
    const lastRowLength = rows.at(-1)?.length ?? 0;

    return {
      availableWidth,
      rows,
      rowHeights,
      totalHeight,
      outerWidth,
      score:
        Math.abs(outerWidth - totalHeight) +
        (lastRowLength === 1 && rows.length > 1 ? 120 : 0),
    };
  };

  const widestItem = Math.max(...visibleItems.map((item) => item.width));
  const squareWidthHint = Math.max(
    240,
    Math.round(Math.sqrt(Math.max(1, totalArea))),
    widestItem,
  );
  const baseWidth = Math.max(240, canvasWidth - padding * 2, squareWidthHint);
  const minCandidateWidth = Math.max(
    240,
    Math.min(baseWidth, Math.round(squareWidthHint * 0.72)),
  );
  const maxCandidateWidth = Math.max(
    baseWidth,
    Math.round(squareWidthHint * 1.38),
  );
  const candidateStep = Math.max(
    20,
    Math.round((maxCandidateWidth - minCandidateWidth) / 14),
  );

  let bestLayout = buildLayoutForWidth(baseWidth);

  for (
    let candidateWidth = minCandidateWidth;
    candidateWidth <= maxCandidateWidth;
    candidateWidth += candidateStep
  ) {
    const candidateLayout = buildLayoutForWidth(candidateWidth);
    if (candidateLayout.score < bestLayout.score) {
      bestLayout = candidateLayout;
    }
  }

  const updates: Record<string, ImagePatch> = {};
  let cursorY = padding;

  bestLayout.rows.forEach((row, rowIndex) => {
    const rowHeight = bestLayout.rowHeights[rowIndex];
    let cursorX = padding;

    row.forEach((item, index) => {
      const aspectRatio = item.width / Math.max(1, item.height);
      const nextHeight = rowHeight;
      const remainingWidth = bestLayout.availableWidth - (cursorX - padding);
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
