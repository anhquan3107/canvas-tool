import { useCallback, type MutableRefObject } from "react";
import type { Container } from "pixi.js";
import type { ReferenceGroup } from "@shared/types/project";

interface UseBoardViewCommitOptions {
  boardContainerRef: MutableRefObject<Container | null>;
  groupRef: MutableRefObject<ReferenceGroup>;
  viewCommitTimerRef: MutableRefObject<number | null>;
  onViewChangeRef: MutableRefObject<(zoom: number, panX: number, panY: number) => void>;
  drawBoardSurface: () => void;
}

export const useBoardViewCommit = ({
  boardContainerRef,
  groupRef,
  viewCommitTimerRef,
  onViewChangeRef,
  drawBoardSurface,
}: UseBoardViewCommitOptions) => {
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
    drawBoardSurface();
  }, [boardContainerRef, drawBoardSurface, groupRef]);

  return {
    commitView,
    scheduleViewCommit,
    syncViewFromGroup,
  };
};
