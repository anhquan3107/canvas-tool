import { useCallback, type MutableRefObject } from "react";
import { Rectangle, type Container, type Graphics } from "pixi.js";
import {
  BOARD_CORNER_RADIUS,
  ZERO_INSETS,
} from "@renderer/pixi/constants";
import { hexToPixiColor, hexToRgba } from "@renderer/pixi/utils/color";
import { clamp } from "@renderer/pixi/utils/geometry";
import type {
  ActiveSelectionBoxState,
  CanvasInsets,
  CanvasSizePreview,
} from "@renderer/pixi/types";
import type { ReferenceGroup } from "@shared/types/project";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";

interface UseCanvasBoardViewOptions {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  cursorOverlayRef: MutableRefObject<HTMLDivElement | null>;
  selectionMarqueeRef: MutableRefObject<HTMLDivElement | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  boardGraphicRef: MutableRefObject<Graphics | null>;
  groupRef: MutableRefObject<ReferenceGroup>;
  selectionIdsRef: MutableRefObject<string[]>;
  activeSelectionBoxRef: MutableRefObject<ActiveSelectionBoxState | null>;
  onSelectionChangeRef: MutableRefObject<(itemIds: string[]) => void>;
  onViewChangeRef: MutableRefObject<(zoom: number, panX: number, panY: number) => void>;
  onCanvasSizePreviewChangeRef: MutableRefObject<
    ((size: CanvasSizePreview | null) => void) | undefined
  >;
  viewCommitTimerRef: MutableRefObject<number | null>;
  previewInsetsRef: MutableRefObject<CanvasInsets>;
  activeToolRef: MutableRefObject<ToolMode | null>;
  doodleModeRef: MutableRefObject<DoodleMode>;
  doodleColorRef: MutableRefObject<string>;
  doodleSizeRef: MutableRefObject<number>;
  lastPointerClientRef: MutableRefObject<{ x: number; y: number } | null>;
}

export const useCanvasBoardView = ({
  hostRef,
  cursorOverlayRef,
  selectionMarqueeRef,
  boardContainerRef,
  boardGraphicRef,
  groupRef,
  selectionIdsRef,
  activeSelectionBoxRef,
  onSelectionChangeRef,
  onViewChangeRef,
  onCanvasSizePreviewChangeRef,
  viewCommitTimerRef,
  previewInsetsRef,
  activeToolRef,
  doodleModeRef,
  doodleColorRef,
  doodleSizeRef,
  lastPointerClientRef,
}: UseCanvasBoardViewOptions) => {
  const hideDoodleCursor = useCallback(() => {
    const cursorOverlay = cursorOverlayRef.current;
    if (!cursorOverlay) {
      return;
    }

    cursorOverlay.style.opacity = "0";
  }, [cursorOverlayRef]);

  const hideSelectionMarquee = useCallback(() => {
    const marquee = selectionMarqueeRef.current;
    if (!marquee) {
      return;
    }

    marquee.style.opacity = "0";
    marquee.style.transform = "translate(-9999px, -9999px)";
    marquee.style.width = "0px";
    marquee.style.height = "0px";
  }, [selectionMarqueeRef]);

  const updateDoodleCursor = useCallback(
    (clientX: number, clientY: number) => {
      lastPointerClientRef.current = { x: clientX, y: clientY };

      const host = hostRef.current;
      const cursorOverlay = cursorOverlayRef.current;
      const boardContainer = boardContainerRef.current;
      if (!host || !cursorOverlay || !boardContainer) {
        return;
      }

      if (activeToolRef.current !== "doodle") {
        cursorOverlay.style.opacity = "0";
        return;
      }

      const rect = host.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        cursorOverlay.style.opacity = "0";
        return;
      }

      const size = Math.max(10, doodleSizeRef.current * boardContainer.scale.x);
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const erasing =
        doodleModeRef.current === "erase-line" ||
        doodleModeRef.current === "erase-pixel";

      cursorOverlay.style.width = `${size}px`;
      cursorOverlay.style.height = `${size}px`;
      cursorOverlay.style.transform = `translate(${localX - size * 0.5}px, ${localY - size * 0.5}px)`;
      cursorOverlay.style.borderColor = erasing
        ? "rgba(255, 255, 255, 0.88)"
        : doodleColorRef.current;
      cursorOverlay.style.background = erasing
        ? "rgba(255, 255, 255, 0.08)"
        : hexToRgba(doodleColorRef.current, 0.12);
      cursorOverlay.style.boxShadow = erasing
        ? "0 0 0 1px rgba(0, 0, 0, 0.38), inset 0 0 0 1px rgba(255, 255, 255, 0.08)"
        : `0 0 0 1px rgba(0, 0, 0, 0.36), inset 0 0 0 1px ${hexToRgba(
            doodleColorRef.current,
            0.22,
          )}`;
      cursorOverlay.style.opacity = "1";
    },
    [
      activeToolRef,
      boardContainerRef,
      cursorOverlayRef,
      doodleColorRef,
      doodleModeRef,
      doodleSizeRef,
      hostRef,
      lastPointerClientRef,
    ],
  );

  const drawBoardSurface = useCallback(
    (insets = previewInsetsRef.current) => {
      const board = boardGraphicRef.current;
      if (!board) {
        return;
      }

      const scene = groupRef.current;
      const width = scene.canvasSize.width + insets.left + insets.right;
      const height = scene.canvasSize.height + insets.top + insets.bottom;

      board.clear();
      board.roundRect(
        -insets.left,
        -insets.top,
        width,
        height,
        BOARD_CORNER_RADIUS,
      );
      board.fill(hexToPixiColor(scene.canvasColor));
      board.stroke({ color: 0x2a2a2a, width: 2, alpha: 0.92 });
      board.hitArea = new Rectangle(-insets.left, -insets.top, width, height);
    },
    [boardGraphicRef, groupRef, previewInsetsRef],
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

  const commitView = useCallback(() => {
    const boardContainer = boardContainerRef.current;
    if (!boardContainer) {
      return;
    }

    if (viewCommitTimerRef.current !== null) {
      window.clearTimeout(viewCommitTimerRef.current);
      viewCommitTimerRef.current = null;
    }

    onViewChangeRef.current(
      boardContainer.scale.x,
      boardContainer.x,
      boardContainer.y,
    );
  }, [boardContainerRef, onViewChangeRef, viewCommitTimerRef]);

  const scheduleViewCommit = useCallback(
    (delay = 80) => {
      const boardContainer = boardContainerRef.current;
      if (!boardContainer) {
        return;
      }

      if (viewCommitTimerRef.current !== null) {
        window.clearTimeout(viewCommitTimerRef.current);
      }

      viewCommitTimerRef.current = window.setTimeout(() => {
        viewCommitTimerRef.current = null;
        onViewChangeRef.current(
          boardContainer.scale.x,
          boardContainer.x,
          boardContainer.y,
        );
      }, delay);
    },
    [boardContainerRef, onViewChangeRef, viewCommitTimerRef],
  );

  const syncViewFromGroup = useCallback(() => {
    const boardContainer = boardContainerRef.current;
    if (!boardContainer) {
      return;
    }

    const scene = groupRef.current;
    boardContainer.x = scene.panX;
    boardContainer.y = scene.panY;
    boardContainer.scale.set(scene.zoom, scene.zoom);
  }, [boardContainerRef, groupRef]);

  const clientPointToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const host = hostRef.current;
      const boardContainer = boardContainerRef.current;
      if (!host || !boardContainer) {
        return null;
      }

      const rect = host.getBoundingClientRect();
      const scene = groupRef.current;
      const rawX =
        (clientX - rect.left - boardContainer.x) / boardContainer.scale.x;
      const rawY =
        (clientY - rect.top - boardContainer.y) / boardContainer.scale.y;

      return {
        x: clamp(rawX, 0, scene.canvasSize.width),
        y: clamp(rawY, 0, scene.canvasSize.height),
        insideCanvas:
          rawX >= 0 &&
          rawX <= scene.canvasSize.width &&
          rawY >= 0 &&
          rawY <= scene.canvasSize.height,
      };
    },
    [boardContainerRef, groupRef, hostRef],
  );

  const clientPointToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const host = hostRef.current;
      const boardContainer = boardContainerRef.current;
      if (!host || !boardContainer) {
        return null;
      }

      const rect = host.getBoundingClientRect();
      return {
        x: (clientX - rect.left - boardContainer.x) / boardContainer.scale.x,
        y: (clientY - rect.top - boardContainer.y) / boardContainer.scale.y,
      };
    },
    [boardContainerRef, hostRef],
  );

  const updateSelectionMarquee = useCallback(
    (clientX: number, clientY: number) => {
      const marquee = selectionMarqueeRef.current;
      const host = hostRef.current;
      const selectionBox = activeSelectionBoxRef.current;
      if (!marquee || !host || !selectionBox) {
        return;
      }

      const hostRect = host.getBoundingClientRect();
      const startLeft = selectionBox.startClient.x - hostRect.left;
      const startTop = selectionBox.startClient.y - hostRect.top;
      const currentLeft = clientX - hostRect.left;
      const currentTop = clientY - hostRect.top;

      const left = Math.min(startLeft, currentLeft);
      const top = Math.min(startTop, currentTop);
      const width = Math.abs(currentLeft - startLeft);
      const height = Math.abs(currentTop - startTop);

      marquee.style.opacity = width > 0 || height > 0 ? "1" : "0";
      marquee.style.transform = `translate(${left}px, ${top}px)`;
      marquee.style.width = `${width}px`;
      marquee.style.height = `${height}px`;

      const startWorld = clientPointToWorld(
        selectionBox.startClient.x,
        selectionBox.startClient.y,
      );
      const endWorld = clientPointToWorld(clientX, clientY);
      if (!startWorld || !endWorld) {
        return;
      }

      const minX = Math.min(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const maxY = Math.max(startWorld.y, endWorld.y);

      const hitIds = groupRef.current.items
        .filter((item) => item.visible)
        .filter(
          (item) =>
            item.x < maxX &&
            item.x + item.width > minX &&
            item.y < maxY &&
            item.y + item.height > minY,
        )
        .map((item) => item.id);

      const nextSelection = selectionBox.additive
        ? Array.from(new Set([...selectionBox.baseSelection, ...hitIds]))
        : hitIds;

      selectionIdsRef.current = nextSelection;
      onSelectionChangeRef.current(nextSelection);
    },
    [
      activeSelectionBoxRef,
      clientPointToWorld,
      groupRef,
      hostRef,
      onSelectionChangeRef,
      selectionIdsRef,
      selectionMarqueeRef,
    ],
  );

  return {
    hideDoodleCursor,
    hideSelectionMarquee,
    updateDoodleCursor,
    drawBoardSurface,
    setPreviewInsets,
    commitView,
    scheduleViewCommit,
    syncViewFromGroup,
    clientPointToCanvas,
    clientPointToWorld,
    updateSelectionMarquee,
  };
};
