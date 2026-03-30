import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Application,
  Container,
  Graphics,
  Rectangle,
} from "pixi.js";
import type { CanvasItem, CaptureItem, ImageItem } from "@shared/types/project";
import { useCaptureSessions } from "@renderer/pixi/hooks/use-capture-sessions";
import { useCanvasBoardAnnotations } from "@renderer/pixi/hooks/use-canvas-board-annotations";
import { useCanvasBoardBootstrap } from "@renderer/pixi/hooks/use-canvas-board-bootstrap";
import { useCanvasBoardDrag } from "@renderer/pixi/hooks/use-canvas-board-drag";
import { useCanvasBoardScene } from "@renderer/pixi/hooks/use-canvas-board-scene";
import { useCanvasBoardView } from "@renderer/pixi/hooks/use-canvas-board-view";
import { ZERO_INSETS } from "@renderer/pixi/constants";
import type {
  ActiveAnnotationSessionState,
  ActiveItemDragState,
  ActiveSelectionBoxState,
  ActiveSelectionTransformState,
  CanvasBoardProps,
  CropRect,
  CropSession,
  TransformHandle,
} from "@renderer/pixi/types";
import { drawItemFrame } from "@renderer/pixi/utils/item-frame";

const SELECTION_DIM_ALPHA = 0.34;
const SELECTION_HIGHLIGHT_NAME = "selection-highlight";

export const CanvasBoard = ({
  group,
  activeTool,
  snapEnabled,
  doodleMode,
  doodleColor,
  doodleSize,
  selectedItemIds,
  cropSession,
  onCropRectChange,
  onSelectionChange,
  onViewChange,
  onItemsPatch,
  onAnnotationsChange,
  onItemDoubleClick,
  onCanvasSizePreviewChange,
  onExportReady,
}: CanvasBoardProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cursorOverlayRef = useRef<HTMLDivElement | null>(null);
  const selectionMarqueeRef = useRef<HTMLDivElement | null>(null);
  const selectedBoundsOverlayRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardContainerRef = useRef<Container | null>(null);
  const boardGraphicRef = useRef<Graphics | null>(null);
  const gridGraphicRef = useRef<Graphics | null>(null);
  const itemLayerRef = useRef<Container | null>(null);
  const annotationLayerRef = useRef<Graphics | null>(null);
  const annotationPreviewLayerRef = useRef<Graphics | null>(null);
  const frameByIdRef = useRef(new Map<string, Graphics>());
  const itemNodeByIdRef = useRef(new Map<string, Container>());
  const frameMetaByIdRef = useRef(
    new Map<string, { width: number; height: number; isCapture: boolean }>(),
  );
  const { captureSessionByIdRef, stopCaptureSession, ensureCaptureSession } =
    useCaptureSessions();
  const selectionIdsRef = useRef(selectedItemIds);
  const groupRef = useRef(group);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onItemsPatchRef = useRef(onItemsPatch);
  const onViewChangeRef = useRef(onViewChange);
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  const onItemDoubleClickRef = useRef(onItemDoubleClick);
  const onCanvasSizePreviewChangeRef = useRef(onCanvasSizePreviewChange);
  const onExportReadyRef = useRef(onExportReady);
  const activeToolRef = useRef(activeTool);
  const snapEnabledRef = useRef(snapEnabled);
  const doodleModeRef = useRef(doodleMode);
  const doodleColorRef = useRef(doodleColor);
  const doodleSizeRef = useRef(doodleSize);
  const renderTokenRef = useRef(0);
  const viewCommitTimerRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const previewInsetsRef = useRef(ZERO_INSETS);
  const activeItemDragRef = useRef<ActiveItemDragState | null>(null);
  const activeSelectionTransformRef =
    useRef<ActiveSelectionTransformState | null>(null);
  const activeSelectionBoxRef = useRef<ActiveSelectionBoxState | null>(null);
  const activeAnnotationSessionRef =
    useRef<ActiveAnnotationSessionState | null>(null);
  const activeCropHandleRef = useRef<{
    handle: TransformHandle;
    startRect: CropRect;
    imageBounds: { minX: number; minY: number; maxX: number; maxY: number };
  } | null>(null);
  const updateSelectedBoundsOverlayRef = useRef<() => void>(() => {});
  const spacePanActiveRef = useRef(false);
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);
  const lastItemPressRef = useRef<{ itemId: string; time: number } | null>(null);
  const cropSessionRef = useRef<CropSession | null>(cropSession);
  const [appReady, setAppReady] = useState(false);
  const boardFilter = `blur(${group.filters.blur}px) grayscale(${group.filters.grayscale}%)`;

  const getItemBounds = useCallback((item: CanvasItem) => {
    const safeWidth = Number.isFinite(item.width) && item.width > 1 ? item.width : 180;
    const safeHeight =
      Number.isFinite(item.height) && item.height > 1 ? item.height : 120;
    const safeScaleX =
      Number.isFinite(item.scaleX) && item.scaleX !== 0 ? item.scaleX : 1;
    const safeScaleY =
      Number.isFinite(item.scaleY) && item.scaleY !== 0 ? item.scaleY : 1;
    const resolvedScaleX = item.flippedX ? -safeScaleX : safeScaleX;
    const visualWidth = safeWidth * Math.abs(safeScaleX);
    const visualHeight = safeHeight * Math.abs(safeScaleY);

    return {
      minX: item.x,
      minY: item.y,
      maxX: item.x + visualWidth,
      maxY: item.y + visualHeight,
      width: safeWidth,
      height: safeHeight,
      scaleX: safeScaleX,
      scaleY: safeScaleY,
      resolvedScaleX,
      flippedX: item.flippedX,
    };
  }, []);

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
    [],
  );

  const applyScaleTransform = useCallback(
    (clientX: number, clientY: number, lockAspectRatio = false) => {
      const activeTransform = activeSelectionTransformRef.current;
      if (!activeTransform) {
        return;
      }

      const pointerWorld = clientPointToWorld(clientX, clientY);
      if (!pointerWorld) {
        return;
      }

      const minWidth = 24;
      const minHeight = 24;
      let nextMinX = activeTransform.bounds.minX;
      let nextMaxX = activeTransform.bounds.maxX;
      let nextMinY = activeTransform.bounds.minY;
      let nextMaxY = activeTransform.bounds.maxY;

      switch (activeTransform.handle) {
        case "nw":
          nextMinX = Math.min(pointerWorld.x, activeTransform.anchor.x - minWidth);
          nextMinY = Math.min(pointerWorld.y, activeTransform.anchor.y - minHeight);
          break;
        case "ne":
          nextMaxX = Math.max(pointerWorld.x, activeTransform.anchor.x + minWidth);
          nextMinY = Math.min(pointerWorld.y, activeTransform.anchor.y - minHeight);
          break;
        case "se":
          nextMaxX = Math.max(pointerWorld.x, activeTransform.anchor.x + minWidth);
          nextMaxY = Math.max(pointerWorld.y, activeTransform.anchor.y + minHeight);
          break;
        case "sw":
          nextMinX = Math.min(pointerWorld.x, activeTransform.anchor.x - minWidth);
          nextMaxY = Math.max(pointerWorld.y, activeTransform.anchor.y + minHeight);
          break;
      }

      const startWidth = Math.max(
        1,
        activeTransform.bounds.maxX - activeTransform.bounds.minX,
      );
      const startHeight = Math.max(
        1,
        activeTransform.bounds.maxY - activeTransform.bounds.minY,
      );
      let nextWidth = Math.max(minWidth, nextMaxX - nextMinX);
      let nextHeight = Math.max(minHeight, nextMaxY - nextMinY);

      if (lockAspectRatio) {
        const aspectRatio = startWidth / startHeight;
        const widthRatio = nextWidth / startWidth;
        const heightRatio = nextHeight / startHeight;

        if (widthRatio >= heightRatio) {
          nextHeight = Math.max(minHeight, nextWidth / aspectRatio);
        } else {
          nextWidth = Math.max(minWidth, nextHeight * aspectRatio);
        }

        switch (activeTransform.handle) {
          case "nw":
            nextMinX = activeTransform.anchor.x - nextWidth;
            nextMinY = activeTransform.anchor.y - nextHeight;
            break;
          case "ne":
            nextMaxX = activeTransform.anchor.x + nextWidth;
            nextMinY = activeTransform.anchor.y - nextHeight;
            break;
          case "se":
            nextMaxX = activeTransform.anchor.x + nextWidth;
            nextMaxY = activeTransform.anchor.y + nextHeight;
            break;
          case "sw":
            nextMinX = activeTransform.anchor.x - nextWidth;
            nextMaxY = activeTransform.anchor.y + nextHeight;
            break;
        }
      }

      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      activeTransform.items.forEach((itemState) => {
        const node = itemNodeByIdRef.current.get(itemState.itemId);
        if (!node) {
          return;
        }

        const relativeMinX =
          (itemState.minX - activeTransform.bounds.minX) / startWidth;
        const relativeMaxX =
          (itemState.maxX - activeTransform.bounds.minX) / startWidth;
        const relativeMinY =
          (itemState.minY - activeTransform.bounds.minY) / startHeight;
        const relativeMaxY =
          (itemState.maxY - activeTransform.bounds.minY) / startHeight;

        const itemMinX = nextMinX + relativeMinX * nextWidth;
        const itemMaxX = nextMinX + relativeMaxX * nextWidth;
        const itemMinY = nextMinY + relativeMinY * nextHeight;
        const itemMaxY = nextMinY + relativeMaxY * nextHeight;
        const visualWidth = Math.max(12, itemMaxX - itemMinX);
        const visualHeight = Math.max(12, itemMaxY - itemMinY);
        const nextScaleX = Math.max(0.08, visualWidth / itemState.width);
        const nextScaleY = Math.max(0.08, visualHeight / itemState.height);
        const nextResolvedScaleX =
          Math.sign(itemState.resolvedScaleX) * nextScaleX;
        const nextX = itemMinX;

        node.position.set(nextX, itemMinY);
        node.scale.set(nextResolvedScaleX, nextScaleY);
        activeTransform.patchBuffer[itemState.itemId] = {
          x: Math.round(nextX),
          y: Math.round(itemMinY),
          scaleX: nextScaleX,
          scaleY: nextScaleY,
        };
        activeTransform.hasChanged = true;

        minX = Math.min(minX, itemMinX);
        minY = Math.min(minY, itemMinY);
        maxX = Math.max(maxX, itemMaxX);
        maxY = Math.max(maxY, itemMaxY);
      });

      previewInsetsRef.current = ZERO_INSETS;
      updateSelectedBoundsOverlayRef.current();

      if (
        Number.isFinite(minX) &&
        Number.isFinite(minY) &&
        Number.isFinite(maxX) &&
        Number.isFinite(maxY)
      ) {
        const nextInsets = {
          left: minX < 0 ? Math.ceil(-minX + 24) : 0,
          top: minY < 0 ? Math.ceil(-minY + 24) : 0,
          right:
            maxX > groupRef.current.canvasSize.width
              ? Math.ceil(maxX - groupRef.current.canvasSize.width + 24)
              : 0,
          bottom:
            maxY > groupRef.current.canvasSize.height
              ? Math.ceil(maxY - groupRef.current.canvasSize.height + 24)
              : 0,
        };
        previewInsetsRef.current = nextInsets;
        onCanvasSizePreviewChangeRef.current?.({
          width: Math.round(
            groupRef.current.canvasSize.width + nextInsets.left + nextInsets.right,
          ),
          height: Math.round(
            groupRef.current.canvasSize.height + nextInsets.top + nextInsets.bottom,
          ),
        });
      }
    },
    [clientPointToWorld],
  );

  const commitScaleTransform = useCallback(() => {
    const activeTransform = activeSelectionTransformRef.current;
    activeSelectionTransformRef.current = null;

    if (!activeTransform) {
      return;
    }

    onCanvasSizePreviewChangeRef.current?.(null);
    previewInsetsRef.current = ZERO_INSETS;

    if (activeTransform.hasChanged && Object.keys(activeTransform.patchBuffer).length > 0) {
      onItemsPatchRef.current({ ...activeTransform.patchBuffer });
      return;
    }

    updateSelectedBoundsOverlayRef.current();
  }, []);

  const applyCropHandle = useCallback(
    (clientX: number, clientY: number) => {
      const activeCropHandle = activeCropHandleRef.current;
      const session = cropSessionRef.current;
      if (!activeCropHandle || !session || !onCropRectChange) {
        return;
      }

      const pointerWorld = clientPointToWorld(clientX, clientY);
      if (!pointerWorld) {
        return;
      }

      const imageWidth = Math.max(
        1,
        activeCropHandle.imageBounds.maxX - activeCropHandle.imageBounds.minX,
      );
      const imageHeight = Math.max(
        1,
        activeCropHandle.imageBounds.maxY - activeCropHandle.imageBounds.minY,
      );
      const normalizedX = Math.min(
        1,
        Math.max(
          0,
          (pointerWorld.x - activeCropHandle.imageBounds.minX) / imageWidth,
        ),
      );
      const normalizedY = Math.min(
        1,
        Math.max(
          0,
          (pointerWorld.y - activeCropHandle.imageBounds.minY) / imageHeight,
        ),
      );
      const nextRect = { ...activeCropHandle.startRect };
      const minSize = 0.04;

      switch (activeCropHandle.handle) {
        case "nw":
          nextRect.left = Math.min(normalizedX, nextRect.right - minSize);
          nextRect.top = Math.min(normalizedY, nextRect.bottom - minSize);
          break;
        case "ne":
          nextRect.right = Math.max(normalizedX, nextRect.left + minSize);
          nextRect.top = Math.min(normalizedY, nextRect.bottom - minSize);
          break;
        case "se":
          nextRect.right = Math.max(normalizedX, nextRect.left + minSize);
          nextRect.bottom = Math.max(normalizedY, nextRect.top + minSize);
          break;
        case "sw":
          nextRect.left = Math.min(normalizedX, nextRect.right - minSize);
          nextRect.bottom = Math.max(normalizedY, nextRect.top + minSize);
          break;
      }

      onCropRectChange(nextRect);
    },
    [clientPointToWorld, onCropRectChange],
  );

  useEffect(() => {
    selectionIdsRef.current = selectedItemIds;
    frameByIdRef.current.forEach((frame, id) => {
      const meta = frameMetaByIdRef.current.get(id);
      if (!meta) {
        return;
      }

      drawItemFrame(
        frame,
        meta.width,
        meta.height,
        meta.isCapture,
        selectedItemIds.includes(id),
      );
    });

    itemNodeByIdRef.current.forEach((itemNode, id) => {
      const hasSelection = selectedItemIds.length > 0;
      const isSelected = selectedItemIds.includes(id);
      itemNode.alpha = hasSelection ? (isSelected ? 1 : SELECTION_DIM_ALPHA) : 1;

      const highlightOverlay = itemNode.getChildByName(
        SELECTION_HIGHLIGHT_NAME,
      ) as Graphics | null;
      if (!highlightOverlay) {
        return;
      }

      highlightOverlay.alpha = hasSelection && isSelected ? 0.08 : 0;
      highlightOverlay.visible = !hasSelection || isSelected;
    });
  }, [selectedItemIds]);

  useEffect(() => {
    groupRef.current = group;
  }, [group]);

  useEffect(() => {
    cropSessionRef.current = cropSession;
  }, [cropSession]);

  const handleTransformHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!group || selectedItemIds.length === 0) {
        return;
      }

      const handle = event.currentTarget.dataset.handle as TransformHandle | undefined;
      if (!handle) {
        return;
      }

      if (cropSessionRef.current) {
        const cropTarget = group.items.find(
          (item): item is ImageItem =>
            item.id === cropSessionRef.current?.itemId && item.type === "image",
        );

        if (!cropTarget) {
          return;
        }

        const imageBounds = getItemBounds(cropTarget);
        activeCropHandleRef.current = {
          handle,
          startRect: cropSessionRef.current.rect,
          imageBounds,
        };
        return;
      }

      if (group.locked) {
        return;
      }

      const selectedItems = group.items.filter(
        (item): item is ImageItem | CaptureItem =>
          selectedItemIds.includes(item.id) && item.visible && !item.locked,
      );

      if (selectedItems.length === 0) {
        return;
      }

      const itemStates = selectedItems.map((item) => {
        const bounds = getItemBounds(item);
        return {
          itemId: item.id,
          x: item.x,
          y: item.y,
          width: bounds.width,
          height: bounds.height,
          scaleX: bounds.scaleX,
          scaleY: bounds.scaleY,
          resolvedScaleX: bounds.resolvedScaleX,
          flippedX: bounds.flippedX,
          minX: bounds.minX,
          minY: bounds.minY,
          maxX: bounds.maxX,
          maxY: bounds.maxY,
        };
      });

      const minX = Math.min(...itemStates.map((item) => item.minX));
      const minY = Math.min(...itemStates.map((item) => item.minY));
      const maxX = Math.max(...itemStates.map((item) => item.maxX));
      const maxY = Math.max(...itemStates.map((item) => item.maxY));

      const anchor =
        handle === "nw"
          ? { x: maxX, y: maxY }
          : handle === "ne"
            ? { x: minX, y: maxY }
            : handle === "se"
              ? { x: minX, y: minY }
              : { x: maxX, y: minY };

      activeSelectionTransformRef.current = {
        handle,
        anchor,
        bounds: { minX, minY, maxX, maxY },
        items: itemStates,
        patchBuffer: {},
        hasChanged: false,
      };
    },
    [getItemBounds, group, selectedItemIds],
  );

  useEffect(() => {
      const handlePointerMove = (event: PointerEvent) => {
      if (activeCropHandleRef.current) {
        applyCropHandle(event.clientX, event.clientY);
        return;
      }

      if (activeSelectionTransformRef.current) {
        applyScaleTransform(event.clientX, event.clientY, !event.shiftKey);
      }
    };

    const handlePointerUp = () => {
      if (activeCropHandleRef.current) {
        activeCropHandleRef.current = null;
        return;
      }

      if (activeSelectionTransformRef.current) {
        commitScaleTransform();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [applyCropHandle, applyScaleTransform, commitScaleTransform]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onItemsPatchRef.current = onItemsPatch;
  }, [onItemsPatch]);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    onAnnotationsChangeRef.current = onAnnotationsChange;
  }, [onAnnotationsChange]);

  useEffect(() => {
    onItemDoubleClickRef.current = onItemDoubleClick;
  }, [onItemDoubleClick]);

  useEffect(() => {
    onCanvasSizePreviewChangeRef.current = onCanvasSizePreviewChange;
  }, [onCanvasSizePreviewChange]);

  useEffect(() => {
    onExportReadyRef.current = onExportReady;
  }, [onExportReady]);

  useEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== "doodle") {
      hideDoodleCursor();
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [activeTool]);

  useEffect(() => {
    snapEnabledRef.current = snapEnabled;
  }, [snapEnabled]);

  useEffect(() => {
    doodleModeRef.current = doodleMode;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [doodleMode]);

  useEffect(() => {
    doodleColorRef.current = doodleColor;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [doodleColor]);

  useEffect(() => {
    doodleSizeRef.current = doodleSize;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [doodleSize]);

  const {
    hideDoodleCursor,
    hideSelectionMarquee,
    hideSelectedBoundsOverlay,
    updateDoodleCursor,
    drawBoardSurface,
    setPreviewInsets,
    commitView,
    scheduleViewCommit,
    syncViewFromGroup,
    clientPointToCanvas,
    updateSelectedBoundsOverlay,
    updateSelectionMarquee,
  } = useCanvasBoardView({
    hostRef,
    cursorOverlayRef,
    selectionMarqueeRef,
    selectedBoundsOverlayRef,
    boardContainerRef,
    boardGraphicRef,
    itemNodeByIdRef,
    groupRef,
    selectionIdsRef,
    activeItemDragRef,
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
    activeSelectionTransformRef,
    cropSessionRef,
  });

  useEffect(() => {
    updateSelectedBoundsOverlayRef.current = updateSelectedBoundsOverlay;
  }, [updateSelectedBoundsOverlay]);

  const {
    redrawAnnotations,
    startAnnotationSession,
    updateAnnotationSession,
    commitAnnotationSession,
  } = useCanvasBoardAnnotations({
    annotationLayerRef,
    annotationPreviewLayerRef,
    groupRef,
    selectionIdsRef,
    onSelectionChangeRef,
    onAnnotationsChangeRef,
    activeAnnotationSessionRef,
    doodleModeRef,
    doodleColorRef,
    doodleSizeRef,
    clientPointToCanvas,
  });

  const { updateDraggedItemPosition, commitDraggedItemPatch } =
    useCanvasBoardDrag({
      activeItemDragRef,
      hostRef,
      boardContainerRef,
      snapEnabledRef,
      groupRef,
      onItemsPatchRef,
      setPreviewInsets,
      updateSelectedBoundsOverlay,
      scheduleViewCommit,
    });

  const rebuildScene = useCanvasBoardScene({
    hostRef,
    boardContainerRef,
    boardGraphicRef,
    gridGraphicRef,
    itemLayerRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    frameByIdRef,
    itemNodeByIdRef,
    frameMetaByIdRef,
    selectionIdsRef,
    groupRef,
    onSelectionChangeRef,
    activeToolRef,
    renderTokenRef,
    activeItemDragRef,
    activeSelectionBoxRef,
    isPanningRef,
    panStartRef,
    panOriginRef,
    spacePanActiveRef,
    lastItemPressRef,
    onItemDoubleClickRef,
    ensureCaptureSession,
    drawBoardSurface,
    syncViewFromGroup,
    hideSelectionMarquee,
    redrawAnnotations,
    startAnnotationSession,
  });

  useCanvasBoardBootstrap({
    hostRef,
    appRef,
    boardContainerRef,
    boardGraphicRef,
    gridGraphicRef,
    itemLayerRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    viewCommitTimerRef,
    isPanningRef,
    panStartRef,
    panOriginRef,
    activeItemDragRef,
    activeSelectionBoxRef,
    activeAnnotationSessionRef,
    activeToolRef,
    spacePanActiveRef,
    selectionIdsRef,
    onSelectionChangeRef,
    hideDoodleCursor,
    updateDoodleCursor,
    updateAnnotationSession,
    updateSelectionMarquee,
    updateDraggedItemPosition,
    commitAnnotationSession,
    commitDraggedItemPatch,
    hideSelectionMarquee,
    commitView,
    scheduleViewCommit,
    updateSelectedBoundsOverlay,
    rebuildScene,
    setAppReady,
    stopCaptureSession,
    captureSessionByIdRef,
  });

  useEffect(() => {
    if (!appReady) {
      return;
    }

    previewInsetsRef.current = ZERO_INSETS;
    onCanvasSizePreviewChangeRef.current?.(null);
    rebuildScene();
  }, [
    appReady,
    group.id,
    group.items,
    group.canvasSize.width,
    group.canvasSize.height,
    activeTool,
    rebuildScene,
  ]);

  useEffect(() => {
    const activeCaptureIds = new Set(
      group.items
        .filter((item): item is CaptureItem => item.type === "capture")
        .map((item) => item.id),
    );

    captureSessionByIdRef.current.forEach((_, captureId) => {
      if (!activeCaptureIds.has(captureId)) {
        stopCaptureSession(captureId);
      }
    });
  }, [group.id, group.items, stopCaptureSession]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    redrawAnnotations(group.annotations);
  }, [appReady, group.annotations, redrawAnnotations]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, selectedItemIds, updateSelectedBoundsOverlay]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, cropSession, updateSelectedBoundsOverlay]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, group.items, updateSelectedBoundsOverlay]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    drawBoardSurface();
    updateSelectedBoundsOverlay();
  }, [
    appReady,
    drawBoardSurface,
    group.canvasColor,
    group.canvasSize.height,
    group.canvasSize.width,
    updateSelectedBoundsOverlay,
  ]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [appReady, group.zoom, updateDoodleCursor]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    if (
      isPanningRef.current ||
      activeItemDragRef.current ||
      activeAnnotationSessionRef.current ||
      activeSelectionBoxRef.current
    ) {
      return;
    }

    syncViewFromGroup();
    updateSelectedBoundsOverlay();
  }, [
    appReady,
    group.panX,
    group.panY,
    group.zoom,
    syncViewFromGroup,
    updateSelectedBoundsOverlay,
  ]);

  useEffect(
    () => () => {
      onCanvasSizePreviewChangeRef.current?.(null);
      onExportReadyRef.current?.(null);
      hideSelectedBoundsOverlay();
    },
    [hideSelectedBoundsOverlay],
  );

  useEffect(() => {
    if (!appReady) {
      onExportReadyRef.current?.(null);
      return;
    }

    onExportReadyRef.current?.(() => {
      const app = appRef.current;
      const boardContainer = boardContainerRef.current;

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
      const notifyExportReady = onExportReadyRef.current;
      notifyExportReady?.(null);
    };
  }, [appReady, group.canvasSize.height, group.canvasSize.width]);

  return (
    <div className="canvas-host">
      <div
        className="canvas-surface"
        ref={hostRef}
        style={{
          filter: boardFilter,
          cursor: activeTool === "doodle" ? "none" : "default",
        }}
      />
      <div
        className={`canvas-selected-bounds ${cropSession ? "crop-mode" : ""}`}
        ref={selectedBoundsOverlayRef}
      >
        <button
          type="button"
          className="canvas-transform-handle handle-nw"
          data-handle="nw"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-ne"
          data-handle="ne"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-se"
          data-handle="se"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-sw"
          data-handle="sw"
          onPointerDown={handleTransformHandlePointerDown}
        />
      </div>
      <div className="canvas-selection-marquee" ref={selectionMarqueeRef} />
      <div className="canvas-cursor-overlay" ref={cursorOverlayRef} />
    </div>
  );
};
