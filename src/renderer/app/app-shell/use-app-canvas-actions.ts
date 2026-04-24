import { useCallback, type Dispatch, type SetStateAction } from "react";
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from "@shared/project-defaults";
import type { AnnotationStroke, ReferenceGroup } from "@shared/types/project";
import { getFocusedGroupView } from "@renderer/features/workspace/utils/layout";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";

type PushToast = (kind: "success" | "error" | "info", message: string) => void;

type CropRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type CropSession = {
  itemId: string;
  rect: CropRect;
} | null;

interface UseAppCanvasActionsOptions {
  activeGroup: ReferenceGroup | undefined;
  activeTool: ToolMode | null;
  applyCropToSelectedImage: (rect: CropRect) => void;
  brushSize: number;
  displayGroup: ReferenceGroup | undefined;
  doodleMode: DoodleMode;
  eraserSize: number;
  cropSession: CropSession;
  pushToast: PushToast;
  resetView: () => void;
  selectedStatusImage: { id: string } | null | undefined;
  setActiveTool: Dispatch<SetStateAction<ToolMode | null>>;
  setBrushSize: Dispatch<SetStateAction<number>>;
  setCropSession: Dispatch<SetStateAction<CropSession>>;
  setEraserSize: Dispatch<SetStateAction<number>>;
  setGroupAnnotations: (groupId: string, annotations: AnnotationStroke[]) => void;
  setGroupView: (groupId: string, zoom: number, panX: number, panY: number) => void;
  viewportSize: { width: number; height: number } | null;
  zoomOverlayOpen: boolean;
}

const clampCanvasZoom = (value: number) =>
  Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, value));

export const useAppCanvasActions = ({
  activeGroup,
  activeTool,
  applyCropToSelectedImage,
  brushSize,
  displayGroup,
  doodleMode,
  eraserSize,
  cropSession,
  pushToast,
  resetView,
  selectedStatusImage,
  setActiveTool,
  setBrushSize,
  setCropSession,
  setEraserSize,
  setGroupAnnotations,
  setGroupView,
  viewportSize,
  zoomOverlayOpen,
}: UseAppCanvasActionsOptions) => {
  const toggleCropSelectedImage = useCallback(() => {
    if (activeGroup?.locked) {
      pushToast("info", "Canvas is locked.");
      return;
    }

    if (!selectedStatusImage) {
      pushToast("info", "Select exactly one image to crop.");
      return;
    }

    if (cropSession?.itemId === selectedStatusImage.id) {
      applyCropToSelectedImage(cropSession.rect);
      setCropSession(null);
      return;
    }

    setCropSession({
      itemId: selectedStatusImage.id,
      rect: { left: 0, top: 0, right: 1, bottom: 1 },
    });
    pushToast(
      "info",
      "Crop mode active. Adjust handles, then press C again to apply.",
    );
  }, [
    activeGroup?.locked,
    applyCropToSelectedImage,
    cropSession,
    pushToast,
    selectedStatusImage,
    setCropSession,
  ]);

  const handleFitCanvasToWindow = useCallback(() => {
    if (
      !activeGroup ||
      zoomOverlayOpen ||
      !viewportSize ||
      viewportSize.width <= 0 ||
      viewportSize.height <= 0
    ) {
      return;
    }

    const nextView = getFocusedGroupView(
      [
        {
          x: 0,
          y: 0,
          width: activeGroup.canvasSize.width,
          height: activeGroup.canvasSize.height,
        },
      ],
      activeGroup.canvasSize,
      viewportSize,
    );

    if (!nextView) {
      return;
    }

    const sameAsStoredView =
      Math.abs(activeGroup.zoom - nextView.zoom) < 0.0001 &&
      Math.abs(activeGroup.panX - nextView.panX) < 0.01 &&
      Math.abs(activeGroup.panY - nextView.panY) < 0.01;

    if (sameAsStoredView) {
      setGroupView(
        activeGroup.id,
        nextView.zoom,
        nextView.panX + 0.01,
        nextView.panY + 0.01,
      );
      requestAnimationFrame(() => {
        setGroupView(activeGroup.id, nextView.zoom, nextView.panX, nextView.panY);
      });
      return;
    }

    setGroupView(activeGroup.id, nextView.zoom, nextView.panX, nextView.panY);
  }, [activeGroup, setGroupView, viewportSize, zoomOverlayOpen]);

  const handleZoomCanvas = useCallback(
    (direction: 1 | -1) => {
      if (
        !activeGroup ||
        zoomOverlayOpen ||
        !viewportSize ||
        viewportSize.width <= 0 ||
        viewportSize.height <= 0
      ) {
        return;
      }

      const viewportCenterX = viewportSize.width * 0.5;
      const viewportCenterY = viewportSize.height * 0.5;
      const currentZoom = Math.max(activeGroup.zoom, 0.0001);
      const worldX = (viewportCenterX - activeGroup.panX) / currentZoom;
      const worldY = (viewportCenterY - activeGroup.panY) / currentZoom;
      const zoomFactor = direction > 0 ? 1.15 : 1 / 1.15;
      const nextZoom = clampCanvasZoom(currentZoom * zoomFactor);

      if (Math.abs(nextZoom - activeGroup.zoom) < 0.0001) {
        return;
      }

      setGroupView(
        activeGroup.id,
        nextZoom,
        viewportCenterX - worldX * nextZoom,
        viewportCenterY - worldY * nextZoom,
      );
    },
    [activeGroup, setGroupView, viewportSize, zoomOverlayOpen],
  );

  const exitDoodle = useCallback(() => {
    setActiveTool((previous) => (previous === "doodle" ? null : previous));
  }, [setActiveTool]);

  const clearDoodles = useCallback(() => {
    if (!displayGroup) {
      return;
    }

    setGroupAnnotations(displayGroup.id, []);
  }, [displayGroup, setGroupAnnotations]);

  const adjustDoodleSize = useCallback(
    (delta: number) => {
      if (activeTool !== "doodle") {
        return;
      }

      const clampSize = (value: number) => Math.max(6, Math.min(48, value));

      if (doodleMode === "brush") {
        setBrushSize((previous) => clampSize(previous + delta));
        return;
      }

      setEraserSize((previous) => clampSize(previous + delta));
    },
    [activeTool, doodleMode, setBrushSize, setEraserSize],
  );

  return {
    activeDoodleSize: doodleMode === "brush" ? brushSize : eraserSize,
    toggleCropSelectedImage,
    handleFitCanvasToWindow,
    handleZoomCanvas,
    exitDoodle,
    clearDoodles,
    adjustDoodleSize,
  };
};
