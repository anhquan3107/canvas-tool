import { useCallback } from "react";
import {
  DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "@shared/project-defaults";
import type { AnnotationStroke, ReferenceGroup } from "@shared/types/project";
import type { CanvasBoardViewState } from "@renderer/pixi/types";
import type { ImagePatch, ToastKind } from "@renderer/features/workspace/types";
import {
  getFittedCanvas,
  MIN_CANVAS_HEIGHT,
  MIN_CANVAS_WIDTH,
} from "@renderer/features/workspace/utils/layout";
import { useI18n } from "@renderer/i18n";

interface UseWorkspaceViewActionsOptions {
  activeGroup: ReferenceGroup | undefined;
  activeGroupId: string | null;
  setGroupView: (
    groupId: string,
    zoom: number,
    panX: number,
    panY: number,
  ) => void;
  patchGroupItems: (groupId: string, updates: Record<string, ImagePatch>) => void;
  setGroupCanvasSize: (groupId: string, width: number, height: number) => void;
  setGroupColors: (
    groupId: string,
    colors: Partial<Pick<ReferenceGroup, "canvasColor" | "backgroundColor">>,
  ) => void;
  setGroupLocked: (groupId: string, locked: boolean) => void;
  setGroupAnnotations: (
    groupId: string,
    annotations: AnnotationStroke[],
  ) => void;
  pushToast: (kind: ToastKind, message: string) => void;
  runHistoryBatch: (callback: () => void) => void;
  focusGroupOnItems: (
    groupId: string,
    items: Array<{ x: number; y: number; width: number; height: number }>,
    canvasSize: { width: number; height: number },
  ) => void;
  ensureCanvasFitsItems: (
    groupId: string,
    items: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      scaleX?: number;
      scaleY?: number;
      visible?: boolean;
    }>,
    currentSize: { width: number; height: number },
    currentView?: CanvasBoardViewState,
  ) => void;
}

export const useWorkspaceViewActions = ({
  activeGroup,
  activeGroupId,
  setGroupView,
  patchGroupItems,
  setGroupCanvasSize,
  setGroupColors,
  setGroupLocked,
  setGroupAnnotations,
  pushToast,
  runHistoryBatch,
  focusGroupOnItems,
  ensureCanvasFitsItems,
}: UseWorkspaceViewActionsOptions) => {
  const { copy } = useI18n();
  const scaleAnnotationStroke = useCallback(
    (stroke: AnnotationStroke, scaleX: number, scaleY: number): AnnotationStroke => ({
      ...stroke,
      points: stroke.points.map((value, index) =>
        index % 2 === 0 ? value * scaleX : value * scaleY,
      ),
      size: stroke.size * ((Math.abs(scaleX) + Math.abs(scaleY)) * 0.5),
    }),
    [],
  );

  const handleBoardViewChange = useCallback(
    (zoom: number, panX: number, panY: number) => {
      if (!activeGroupId) {
        return;
      }

      setGroupView(activeGroupId, zoom, panX, panY);
    },
    [activeGroupId, setGroupView],
  );

  const handleBoardItemsPatch = useCallback(
    (
      updates: Record<string, ImagePatch>,
      currentView?: CanvasBoardViewState,
    ) => {
      if (!activeGroupId) {
        return;
      }

      if (activeGroup?.locked) {
        pushToast("info", copy.toasts.canvasLocked);
        return;
      }

      runHistoryBatch(() => {
        patchGroupItems(activeGroupId, updates);

        if (activeGroup) {
          const nextItems = activeGroup.items.map((item) => ({
            ...item,
            ...updates[item.id],
          }));
          ensureCanvasFitsItems(
            activeGroupId,
            nextItems,
            activeGroup.canvasSize,
            currentView ?? {
              zoom: activeGroup.zoom,
              panX: activeGroup.panX,
              panY: activeGroup.panY,
            },
          );
        }
      });
    },
    [activeGroup, activeGroupId, ensureCanvasFitsItems, patchGroupItems, pushToast, runHistoryBatch],
  );

  const resetView = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    const fittedCanvas = getFittedCanvas(activeGroup);
    if (fittedCanvas) {
      runHistoryBatch(() => {
        patchGroupItems(activeGroup.id, fittedCanvas.updates);
        setGroupCanvasSize(
          activeGroup.id,
          fittedCanvas.canvasSize.width,
          fittedCanvas.canvasSize.height,
        );
      });

      requestAnimationFrame(() => {
        focusGroupOnItems(
          activeGroup.id,
          [
            {
              x: 0,
              y: 0,
              width: fittedCanvas.canvasSize.width,
              height: fittedCanvas.canvasSize.height,
            },
          ],
          fittedCanvas.canvasSize,
        );
      });
      return;
    }

    runHistoryBatch(() => {
      setGroupCanvasSize(
        activeGroup.id,
        DEFAULT_EMPTY_GROUP_CANVAS_SIZE.width,
        DEFAULT_EMPTY_GROUP_CANVAS_SIZE.height,
      );
    });

    focusGroupOnItems(
      activeGroup.id,
      [
        {
          x: 0,
          y: 0,
          width: DEFAULT_EMPTY_GROUP_CANVAS_SIZE.width,
          height: DEFAULT_EMPTY_GROUP_CANVAS_SIZE.height,
        },
      ],
      DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
    );
  }, [
    activeGroup,
    focusGroupOnItems,
    patchGroupItems,
    runHistoryBatch,
    setGroupCanvasSize,
  ]);

  const changeCanvasSize = useCallback(
    (width: number, height: number) => {
      if (!activeGroup) {
        return;
      }

      const nextWidth = Math.max(MIN_CANVAS_WIDTH, Math.round(width));
      const nextHeight = Math.max(MIN_CANVAS_HEIGHT, Math.round(height));
      const currentWidth = Math.max(1, activeGroup.canvasSize.width);
      const currentHeight = Math.max(1, activeGroup.canvasSize.height);
      const scaleX = nextWidth / currentWidth;
      const scaleY = nextHeight / currentHeight;
      const itemUpdates = activeGroup.items.reduce<Record<string, ImagePatch>>(
        (updates, item) => {
          updates[item.id] = {
            x: item.x * scaleX,
            y: item.y * scaleY,
            width: item.width * scaleX,
            height: item.height * scaleY,
          };
          return updates;
        },
        {},
      );
      const nextAnnotations = activeGroup.annotations.map((stroke) =>
        scaleAnnotationStroke(stroke, scaleX, scaleY),
      );

      runHistoryBatch(() => {
        if (activeGroup.items.length > 0) {
          patchGroupItems(activeGroup.id, itemUpdates);
        }
        if (activeGroup.annotations.length > 0) {
          setGroupAnnotations(activeGroup.id, nextAnnotations);
        }
        setGroupCanvasSize(activeGroup.id, nextWidth, nextHeight);
      });

      pushToast("success", copy.toasts.canvasResizedTo(nextWidth, nextHeight));
    },
    [
      activeGroup,
      copy.toasts.canvasResizedTo,
      patchGroupItems,
      pushToast,
      runHistoryBatch,
      scaleAnnotationStroke,
      setGroupAnnotations,
      setGroupCanvasSize,
    ],
  );

  const toggleCanvasLock = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    const nextLocked = !activeGroup.locked;
    runHistoryBatch(() => {
      setGroupLocked(activeGroup.id, nextLocked);
    });
    pushToast("success", copy.toasts.canvasLockedState(nextLocked));
  }, [activeGroup, copy.toasts.canvasLockedState, pushToast, runHistoryBatch, setGroupLocked]);

  const changeCanvasColors = useCallback(
    (canvasColor: string, backgroundColor: string) => {
      if (!activeGroup) {
        return;
      }

      runHistoryBatch(() => {
        setGroupColors(activeGroup.id, {
          canvasColor,
          backgroundColor,
        });
      });

      pushToast("success", copy.toasts.canvasColorsUpdated);
    },
    [activeGroup, copy.toasts.canvasColorsUpdated, pushToast, runHistoryBatch, setGroupColors],
  );

  const resetCanvasColors = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    runHistoryBatch(() => {
      setGroupColors(activeGroup.id, {
        canvasColor: DEFAULT_GROUP_CANVAS_COLOR,
        backgroundColor: DEFAULT_GROUP_BACKGROUND_COLOR,
      });
    });

    pushToast("success", copy.toasts.canvasColorsReset);
  }, [activeGroup, copy.toasts.canvasColorsReset, pushToast, runHistoryBatch, setGroupColors]);

  return {
    handleBoardViewChange,
    handleBoardItemsPatch,
    resetView,
    changeCanvasSize,
    toggleCanvasLock,
    changeCanvasColors,
    resetCanvasColors,
  };
};
