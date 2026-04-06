import { useEffect } from "react";
import { Rectangle } from "pixi.js";
import type { ReferenceGroup } from "@shared/types/project";
import type { useCanvasBoardRefs } from "@renderer/pixi/hooks/use-canvas-board-refs";

interface UseCanvasBoardExportOptions {
  refs: ReturnType<typeof useCanvasBoardRefs>;
  appReady: boolean;
  group: ReferenceGroup;
  hideSelectedBoundsOverlay: () => void;
}

export const useCanvasBoardExport = ({
  refs,
  appReady,
  group,
  hideSelectedBoundsOverlay,
}: UseCanvasBoardExportOptions) => {
  useEffect(
    () => () => {
      refs.onCanvasSizePreviewChangeRef.current?.(null);
      refs.onExportReadyRef.current?.(null);
      hideSelectedBoundsOverlay();
    },
    [hideSelectedBoundsOverlay, refs],
  );

  useEffect(() => {
    if (!appReady) {
      refs.onExportReadyRef.current?.(null);
      return;
    }

    refs.onExportReadyRef.current?.(() => {
      const app = refs.appRef.current;
      const boardContainer = refs.boardContainerRef.current;

      if (!app || !boardContainer) {
        return null;
      }

      const previousX = boardContainer.x;
      const previousY = boardContainer.y;
      const previousScaleX = boardContainer.scale.x;
      const previousScaleY = boardContainer.scale.y;

      try {
        boardContainer.position.set(0, 0);
        boardContainer.scale.set(1, 1);

        const exportCanvas = app.renderer.extract.canvas({
          target: boardContainer,
          frame: new Rectangle(0, 0, group.canvasSize.width, group.canvasSize.height),
          resolution: Math.max(window.devicePixelRatio || 1, 2),
        });

        if (
          !exportCanvas ||
          typeof (exportCanvas as HTMLCanvasElement).toDataURL !== "function"
        ) {
          return null;
        }

        return (exportCanvas as HTMLCanvasElement).toDataURL("image/png");
      } finally {
        boardContainer.position.set(previousX, previousY);
        boardContainer.scale.set(previousScaleX, previousScaleY);
      }
    });

    return () => {
      refs.onExportReadyRef.current?.(null);
    };
  }, [appReady, group.canvasSize.height, group.canvasSize.width, refs]);
};
