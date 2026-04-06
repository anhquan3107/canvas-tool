import { useCallback, type MutableRefObject } from "react";
import { Rectangle, type Container, type Graphics } from "pixi.js";
import { hexToPixiColor } from "@renderer/pixi/utils/color";
import type {
  CanvasInsets,
  CanvasSizePreview,
} from "@renderer/pixi/types";
import type { ReferenceGroup } from "@shared/types/project";

interface UseBoardSurfaceDrawOptions {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  boardGraphicRef: MutableRefObject<Graphics | null>;
  annotationMaskRef: MutableRefObject<Graphics | null>;
  groupRef: MutableRefObject<ReferenceGroup>;
  surfaceOpacityRef: MutableRefObject<number>;
  previewInsetsRef: MutableRefObject<CanvasInsets>;
  onCanvasSizePreviewChangeRef: MutableRefObject<
    ((size: CanvasSizePreview | null) => void) | undefined
  >;
}

export const useBoardSurfaceDraw = ({
  hostRef,
  boardContainerRef,
  boardGraphicRef,
  annotationMaskRef,
  groupRef,
  surfaceOpacityRef,
  previewInsetsRef,
  onCanvasSizePreviewChangeRef,
}: UseBoardSurfaceDrawOptions) => {
  const drawBoardSurface = useCallback(
    (insets = previewInsetsRef.current) => {
      const board = boardGraphicRef.current;
      const annotationMask = annotationMaskRef.current;
      const boardContainer = boardContainerRef.current;
      const host = hostRef.current;
      if (!board) {
        return;
      }

      const scene = groupRef.current;
      const surfaceOpacity = surfaceOpacityRef.current;
      const width = scene.canvasSize.width + insets.left + insets.right;
      const height = scene.canvasSize.height + insets.top + insets.bottom;

      board.clear();
      board.rect(-insets.left, -insets.top, width, height);
      board.fill({
        color: hexToPixiColor(scene.canvasColor),
        alpha: surfaceOpacity,
      });

      if (annotationMask) {
        annotationMask.clear();
        annotationMask.rect(0, 0, scene.canvasSize.width, scene.canvasSize.height);
        annotationMask.fill(0xffffff);
      }

      const surfaceMinX = -insets.left;
      const surfaceMinY = -insets.top;
      const surfaceMaxX = scene.canvasSize.width + insets.right;
      const surfaceMaxY = scene.canvasSize.height + insets.bottom;

      if (!boardContainer || !host) {
        board.hitArea = new Rectangle(
          surfaceMinX,
          surfaceMinY,
          width,
          height,
        );
        return;
      }

      const scaleX =
        Number.isFinite(boardContainer.scale.x) && boardContainer.scale.x !== 0
          ? boardContainer.scale.x
          : 1;
      const scaleY =
        Number.isFinite(boardContainer.scale.y) && boardContainer.scale.y !== 0
          ? boardContainer.scale.y
          : 1;
      const viewportMinX = (-boardContainer.x) / scaleX;
      const viewportMinY = (-boardContainer.y) / scaleY;
      const viewportMaxX = (host.clientWidth - boardContainer.x) / scaleX;
      const viewportMaxY = (host.clientHeight - boardContainer.y) / scaleY;
      const hitMinX = Math.min(surfaceMinX, viewportMinX);
      const hitMinY = Math.min(surfaceMinY, viewportMinY);
      const hitMaxX = Math.max(surfaceMaxX, viewportMaxX);
      const hitMaxY = Math.max(surfaceMaxY, viewportMaxY);

      board.hitArea = new Rectangle(
        hitMinX,
        hitMinY,
        Math.max(1, hitMaxX - hitMinX),
        Math.max(1, hitMaxY - hitMinY),
      );
    },
    [
      annotationMaskRef,
      boardContainerRef,
      boardGraphicRef,
      groupRef,
      hostRef,
      previewInsetsRef,
      surfaceOpacityRef,
    ],
  );

  const setPreviewInsets = useCallback(
    (nextInsets: CanvasInsets) => {
      const currentInsets = previewInsetsRef.current;
      if (
        currentInsets.left === nextInsets.left &&
        currentInsets.top === nextInsets.top &&
        currentInsets.right === nextInsets.right &&
        currentInsets.bottom === nextInsets.bottom
      ) {
        return;
      }

      previewInsetsRef.current = nextInsets;
      drawBoardSurface(nextInsets);

      if (
        nextInsets.left === 0 &&
        nextInsets.top === 0 &&
        nextInsets.right === 0 &&
        nextInsets.bottom === 0
      ) {
        onCanvasSizePreviewChangeRef.current?.(null);
        return;
      }

      const scene = groupRef.current;
      onCanvasSizePreviewChangeRef.current?.({
        width: Math.round(
          scene.canvasSize.width + nextInsets.left + nextInsets.right,
        ),
        height: Math.round(
          scene.canvasSize.height + nextInsets.top + nextInsets.bottom,
        ),
      });
    },
    [drawBoardSurface, groupRef, onCanvasSizePreviewChangeRef, previewInsetsRef],
  );

  return {
    drawBoardSurface,
    setPreviewInsets,
  };
};
