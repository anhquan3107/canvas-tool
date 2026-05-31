import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Application,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Graphics,
  Rectangle,
} from "pixi.js";
import {
  applySelectionVisualState,
  syncSelectionItemOrder,
} from "@renderer/pixi/hooks/use-board-selection-visuals";
import { refreshBoardImageVisuals } from "@renderer/pixi/hooks/use-board-item-render";
import {
  getBoardRenderAssetPath,
  pruneBoardTextureCache,
} from "@renderer/pixi/utils/textures";
import { useCaptureSessions } from "@renderer/pixi/hooks/use-capture-sessions";
import { useCanvasBoardAnnotations } from "@renderer/pixi/hooks/use-canvas-board-annotations";
import { useCanvasBoardBootstrap } from "@renderer/pixi/hooks/use-canvas-board-bootstrap";
import { useCanvasBoardDrag } from "@renderer/pixi/hooks/use-canvas-board-drag";
import { useCanvasBoardScene } from "@renderer/pixi/hooks/use-canvas-board-scene";
import { useCanvasBoardTransform } from "@renderer/pixi/hooks/use-canvas-board-transform";
import { useCanvasBoardView } from "@renderer/pixi/hooks/use-canvas-board-view";
import { ZERO_INSETS } from "@renderer/pixi/constants";
import { DEFAULT_VIEW_ZOOM_BASELINE } from "@shared/project-defaults";
import type { CanvasItem, ColorSwatch } from "@shared/types/project";
import type {
  ActiveAnnotationSessionState,
  ActiveItemDragState,
  ActiveSelectionBoxState,
  ActiveSelectionTransformState,
  CanvasBoardProps,
  CropRect,
  CropSession,
  RequestCanvasRender,
  TransformHandle,
} from "@renderer/pixi/types";
import { drawItemFrame } from "@renderer/pixi/utils/item-frame";
import type { NormalizedPointerData } from "@renderer/pixi/utils/pointer";

export const CanvasBoard = (props: CanvasBoardProps) => useCanvasBoardContent(props);

interface RenderedSceneKey {
  groupId: string;
  canvasWidth: number;
  canvasHeight: number;
  preferHighResolution: boolean;
  showSwatches: boolean;
}

const getRenderedSceneKey = (
  group: CanvasBoardProps["group"],
  showSwatches: boolean,
  zoomBaseline?: number,
): RenderedSceneKey => ({
  groupId: group.id,
  canvasWidth: group.canvasSize.width,
  canvasHeight: group.canvasSize.height,
  preferHighResolution: group.zoom >= 2 * (zoomBaseline ?? DEFAULT_VIEW_ZOOM_BASELINE),
  showSwatches,
});

const isSameRenderedSceneKey = (
  previous: RenderedSceneKey,
  next: RenderedSceneKey,
) =>
  previous.groupId === next.groupId &&
  previous.canvasWidth === next.canvasWidth &&
  previous.canvasHeight === next.canvasHeight &&
  previous.preferHighResolution === next.preferHighResolution &&
  previous.showSwatches === next.showSwatches;

const isSameRenderedSceneShell = (
  previous: RenderedSceneKey,
  next: RenderedSceneKey,
) =>
  previous.groupId === next.groupId &&
  previous.canvasWidth === next.canvasWidth &&
  previous.canvasHeight === next.canvasHeight &&
  previous.showSwatches === next.showSwatches;

const areSwatchesEqual = (
  previous: ColorSwatch[] | undefined,
  next: ColorSwatch[] | undefined,
) => {
  if ((previous?.length ?? 0) !== (next?.length ?? 0)) {
    return false;
  }

  for (let index = 0; index < (previous?.length ?? 0); index += 1) {
    const previousSwatch = previous?.[index];
    const nextSwatch = next?.[index];
    if (
      previousSwatch?.id !== nextSwatch?.id ||
      previousSwatch?.colorHex !== nextSwatch?.colorHex ||
      previousSwatch?.origin !== nextSwatch?.origin ||
      previousSwatch?.label !== nextSwatch?.label
    ) {
      return false;
    }
  }

  return true;
};

const haveSameRenderableItemContent = (
  previous: CanvasItem,
  next: CanvasItem,
) => {
  if (
    previous.id !== next.id ||
    previous.type !== next.type ||
    previous.width !== next.width ||
    previous.height !== next.height ||
    previous.locked !== next.locked ||
    previous.visible !== next.visible
  ) {
    return false;
  }

  if (previous.type === "image" && next.type === "image") {
    return (
      previous.assetPath === next.assetPath &&
      previous.previewAssetPath === next.previewAssetPath &&
      previous.thumbnailAssetPath === next.thumbnailAssetPath &&
      previous.source === next.source &&
      previous.label === next.label &&
      previous.originalWidth === next.originalWidth &&
      previous.originalHeight === next.originalHeight &&
      previous.fileSizeBytes === next.fileSizeBytes &&
      previous.format === next.format &&
      previous.cropX === next.cropX &&
      previous.cropY === next.cropY &&
      previous.cropWidth === next.cropWidth &&
      previous.cropHeight === next.cropHeight &&
      previous.previewStatus === next.previewStatus &&
      previous.swatchHex === next.swatchHex &&
      areSwatchesEqual(previous.swatches, next.swatches)
    );
  }

  if (previous.type === "capture" && next.type === "capture") {
    return (
      previous.sourceId === next.sourceId &&
      previous.sourceName === next.sourceName &&
      previous.quality === next.quality &&
      previous.blur === next.blur &&
      previous.grayscale === next.grayscale &&
      previous.refreshMs === next.refreshMs
    );
  }

  return false;
};

const canPatchItemTransformsOnly = (
  previousItems: CanvasItem[],
  nextItems: CanvasItem[],
) => {
  if (previousItems.length !== nextItems.length) {
    return false;
  }

  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  for (const nextItem of nextItems) {
    const previousItem = previousById.get(nextItem.id);
    if (!previousItem || !haveSameRenderableItemContent(previousItem, nextItem)) {
      return false;
    }
  }

  return true;
};

const useCanvasBoardContent = ({
  group,
  surfaceOpacity = 1,
  showSwatches = true,
  activeTool,
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
  onLockedInteraction,
  onCanvasSizePreviewChange,
  onExportReady,
  zoomBaseline,
}: CanvasBoardProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cursorOverlayRef = useRef<HTMLDivElement | null>(null);
  const selectionMarqueeRef = useRef<HTMLDivElement | null>(null);
  const selectedBoundsOverlayRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardContainerRef = useRef<Container | null>(null);
  const contentLayerRef = useRef<Container | null>(null);
  const boardGraphicRef = useRef<Graphics | null>(null);
  const gridGraphicRef = useRef<Graphics | null>(null);
  const itemLayerRef = useRef<Container | null>(null);
  const annotationMaskRef = useRef<Graphics | null>(null);
  const annotationLayerRef = useRef<Graphics | null>(null);
  const annotationPreviewLayerRef = useRef<Graphics | null>(null);
  const frameById = useMemo(() => new Map<string, Graphics>(), []);
  const itemNodeById = useMemo(() => new Map<string, Container>(), []);
  const frameMetaById = useMemo(
    () => new Map<string, { width: number; height: number; isCapture: boolean }>(),
    [],
  );
  const frameByIdRef = useRef(frameById);
  const itemNodeByIdRef = useRef(itemNodeById);
  const frameMetaByIdRef = useRef(frameMetaById);
  const { captureSessionByIdRef, stopCaptureSession, ensureCaptureSession } =
    useCaptureSessions();
  const selectionIdsRef = useRef(selectedItemIds);
  const groupRef = useRef(group);
  const surfaceOpacityRef = useRef(surfaceOpacity);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onItemsPatchRef = useRef(onItemsPatch);
  const onViewChangeRef = useRef(onViewChange);
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  const onItemDoubleClickRef = useRef(onItemDoubleClick);
  const onLockedInteractionRef = useRef(onLockedInteraction);
  const onCanvasSizePreviewChangeRef = useRef(onCanvasSizePreviewChange);
  const onExportReadyRef = useRef(onExportReady);
  const activeToolRef = useRef(activeTool);
  const showSwatchesRef = useRef(showSwatches);
  const doodleModeRef = useRef(doodleMode);
  const doodleColorRef = useRef(doodleColor);
  const doodleSizeRef = useRef(doodleSize);
  const renderFrameRef = useRef<number | null>(null);
  const renderTokenRef = useRef(0);
  const viewCommitTimerRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const cancelWheelZoomAnimationRef = useRef<(() => void) | null>(null);
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
  const lastPointerClientRef = useRef<
    Pick<
      NormalizedPointerData,
      "clientX" | "clientY" | "pointerType" | "pressure" | "buttons"
    > | null
  >(null);
  const lastItemPressRef = useRef<{ itemId: string; time: number } | null>(null);
  const cropSessionRef = useRef<CropSession | null>(cropSession);
  const renderedSceneItemsRef = useRef<CanvasItem[]>(group.items);
  const renderedSceneKeyRef = useRef<RenderedSceneKey | null>(null);
  if (renderedSceneKeyRef.current === null) {
    renderedSceneKeyRef.current = getRenderedSceneKey(group, showSwatches, zoomBaseline);
  }
  const [appReady, setAppReady] = useState(false);
  const contentBlurFilterRef = useRef<BlurFilter | null>(null);
  const contentColorMatrixFilterRef = useRef<ColorMatrixFilter | null>(null);
  const lastAppliedGrayscaleRef = useRef(group.filters.grayscale);

  const requestRender = useCallback<RequestCanvasRender>(() => {
    if (renderFrameRef.current !== null) {
      return;
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      appRef.current?.render();
    });
  }, []);

  useEffect(
    () => () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    },
    [],
  );

  useLayoutEffect(() => {
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
      applySelectionVisualState(itemNode, id, selectedItemIds);
    });

    syncSelectionItemOrder(
      itemLayerRef.current,
      itemNodeByIdRef.current,
      group.items,
      selectedItemIds,
    );
    requestRender();
  }, [group.items, requestRender, selectedItemIds]);

  useLayoutEffect(() => {
    groupRef.current = group;
  }, [group]);

  useLayoutEffect(() => {
    cropSessionRef.current = cropSession;
  }, [cropSession]);

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
    onLockedInteractionRef.current = onLockedInteraction;
  }, [onLockedInteraction]);

  useEffect(() => {
    onCanvasSizePreviewChangeRef.current = onCanvasSizePreviewChange;
  }, [onCanvasSizePreviewChange]);

  useEffect(() => {
    onExportReadyRef.current = onExportReady;
  }, [onExportReady]);

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
    annotationMaskRef,
    itemNodeByIdRef,
    groupRef,
    surfaceOpacityRef,
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
    requestRender,
  });

  useLayoutEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== "doodle") {
      hideDoodleCursor();
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [activeTool, hideDoodleCursor, updateDoodleCursor]);

  useLayoutEffect(() => {
    doodleModeRef.current = doodleMode;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [doodleMode, updateDoodleCursor]);

  useLayoutEffect(() => {
    doodleColorRef.current = doodleColor;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [doodleColor, updateDoodleCursor]);

  useLayoutEffect(() => {
    doodleSizeRef.current = doodleSize;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [doodleSize, updateDoodleCursor]);

  useLayoutEffect(() => {
    surfaceOpacityRef.current = surfaceOpacity;
    drawBoardSurface();
  }, [drawBoardSurface, surfaceOpacity]);

  const { handleTransformHandlePointerDown } = useCanvasBoardTransform({
    hostRef,
    boardContainerRef,
    itemNodeByIdRef,
    groupRef,
    selectedItemIds,
    cropSessionRef,
    activeSelectionTransformRef,
    activeCropHandleRef,
    previewInsetsRef,
    setPreviewInsets,
    updateSelectedBoundsOverlayRef,
    onCanvasSizePreviewChangeRef,
    onItemsPatchRef,
    onLockedInteractionRef,
    onCropRectChange,
    requestRender,
  });

  useEffect(() => {
    updateSelectedBoundsOverlayRef.current = updateSelectedBoundsOverlay;
  }, [updateSelectedBoundsOverlay]);

  const {
    redrawAnnotations,
    startAnnotationSession,
    updateAnnotationSession,
    commitAnnotationSession,
    cancelAnnotationSession,
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
    requestRender,
  });

  const { updateDraggedItemPosition, commitDraggedItemPatch } =
    useCanvasBoardDrag({
      activeItemDragRef,
      hostRef,
      boardContainerRef,
      groupRef,
      previewInsetsRef,
      onItemsPatchRef,
      setPreviewInsets,
      updateSelectedBoundsOverlay,
      scheduleViewCommit,
      requestRender,
    });

  const preserveLiveBoardView = useCallback(() => {
    const boardContainer = boardContainerRef.current;
    if (!boardContainer) {
      return;
    }

    groupRef.current = {
      ...groupRef.current,
      zoom: boardContainer.scale.x,
      panX: boardContainer.x,
      panY: boardContainer.y,
    };
  }, []);

  const rememberRenderedScene = useCallback(
    (nextItems: CanvasItem[], nextKey: RenderedSceneKey) => {
      renderedSceneItemsRef.current = nextItems;
      renderedSceneKeyRef.current = nextKey;
    },
    [],
  );

  const patchItemTransformsOnly = useCallback(() => {
    const itemLayer = itemLayerRef.current;
    if (!itemLayer) {
      return false;
    }

    for (const item of group.items) {
      if (!item.visible) {
        continue;
      }

      const itemNode = itemNodeByIdRef.current.get(item.id);
      if (!itemNode) {
        return false;
      }

      const safeWidth =
        Number.isFinite(item.width) && item.width > 1 ? item.width : 180;
      const safeRotation = Number.isFinite(item.rotation) ? item.rotation : 0;
      const safeScaleX =
        Number.isFinite(item.scaleX) && item.scaleX !== 0 ? item.scaleX : 1;
      const safeScaleY =
        Number.isFinite(item.scaleY) && item.scaleY !== 0 ? item.scaleY : 1;

      itemNode.position.set(item.x, item.y);
      itemNode.rotation = safeRotation;
      itemNode.scale.set(item.flippedX ? -safeScaleX : safeScaleX, safeScaleY);
      itemNode.pivot.x = item.flippedX ? safeWidth : 0;
    }

    syncSelectionItemOrder(
      itemLayer,
      itemNodeByIdRef.current,
      group.items,
      selectedItemIds,
    );
    updateSelectedBoundsOverlay();
    requestRender();
    return true;
  }, [group.items, requestRender, selectedItemIds, updateSelectedBoundsOverlay]);

  const refreshImageQualityForZoom = useCallback(
    (preferHighResolution: boolean) => {
      if (!patchItemTransformsOnly()) {
        return false;
      }

      const renderToken = ++renderTokenRef.current;
      const activeTextureAssetPaths = new Set<string>();
      const refreshes: Array<Promise<void>> = [];

      for (const item of group.items) {
        if (item.type !== "image" || !item.visible) {
          continue;
        }

        const renderAssetPath = getBoardRenderAssetPath(item, {
          preferHighResolution,
        });
        if (renderAssetPath) {
          activeTextureAssetPaths.add(renderAssetPath);
        }

        const itemNode = itemNodeByIdRef.current.get(item.id);
        const frameMeta = frameMetaByIdRef.current.get(item.id);
        if (!itemNode || !frameMeta) {
          return false;
        }

        refreshes.push(
          refreshBoardImageVisuals({
            item,
            itemNode,
            safeWidth: frameMeta.width,
            safeHeight: frameMeta.height,
            canvasZoom: preferHighResolution ? 2 : 1,
            dotGain20BlackAndWhite: group.filters.grayscale > 0,
            renderToken,
            renderTokenRef,
            requestRender,
          }),
        );
      }

      if (refreshes.length === 0) {
        pruneBoardTextureCache(activeTextureAssetPaths);
        return true;
      }

      void Promise.allSettled(refreshes).then(() => {
        if (renderTokenRef.current !== renderToken) {
          return;
        }

        pruneBoardTextureCache(activeTextureAssetPaths);
      });
      return true;
    },
    [
      group.filters.grayscale,
      group.items,
      patchItemTransformsOnly,
      requestRender,
    ],
  );

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
    onLockedInteractionRef,
    activeToolRef,
    showSwatchesRef,
    renderTokenRef,
    activeItemDragRef,
    activeSelectionBoxRef,
    isPanningRef,
    panStartRef,
    panOriginRef,
    cancelWheelZoomAnimationRef,
    spacePanActiveRef,
    lastItemPressRef,
    onItemDoubleClickRef,
    ensureCaptureSession,
    drawBoardSurface,
    syncViewFromGroup,
    hideSelectionMarquee,
    redrawAnnotations,
    startAnnotationSession,
    requestRender,
    zoomBaseline,
  });

  useEffect(() => {
    showSwatchesRef.current = showSwatches;

    if (!appReady) {
      return;
    }

    cancelWheelZoomAnimationRef.current?.();
    if (viewCommitTimerRef.current !== null) {
      window.clearTimeout(viewCommitTimerRef.current);
      viewCommitTimerRef.current = null;
    }

    preserveLiveBoardView();
    rebuildScene();
    rememberRenderedScene(
      groupRef.current.items,
      getRenderedSceneKey(groupRef.current, showSwatchesRef.current, zoomBaseline),
    );
  }, [
    appReady,
    preserveLiveBoardView,
    rebuildScene,
    rememberRenderedScene,
    showSwatches,
    zoomBaseline,
  ]);

  useCanvasBoardBootstrap({
    hostRef,
    appRef,
    boardContainerRef,
    contentLayerRef,
    boardGraphicRef,
    gridGraphicRef,
    itemLayerRef,
    annotationMaskRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    groupRef,
    viewCommitTimerRef,
    isPanningRef,
    panStartRef,
    panOriginRef,
    cancelWheelZoomAnimationRef,
    activeItemDragRef,
    activeSelectionBoxRef,
    activeAnnotationSessionRef,
    activeToolRef,
    spacePanActiveRef,
    selectionIdsRef,
    onSelectionChangeRef,
    onLockedInteractionRef,
    hideDoodleCursor,
    updateDoodleCursor,
    updateAnnotationSession,
    updateSelectionMarquee,
    updateDraggedItemPosition,
    commitAnnotationSession,
    commitDraggedItemPatch,
    hideSelectionMarquee,
    commitView,
    drawBoardSurface,
    updateSelectedBoundsOverlay,
    rebuildScene,
    setAppReady,
    stopCaptureSession,
    captureSessionByIdRef,
    requestRender,
  });

  useEffect(() => {
    if (!appReady) {
      return undefined;
    }

    const app = appRef.current;
    if (!app) {
      return undefined;
    }

    const hasLiveCapture = group.items.some(
      (item) => item.type === "capture" && item.visible,
    );

    if (hasLiveCapture) {
      app.ticker.maxFPS = 24;
      app.ticker.start();
      return () => {
        app.ticker.stop();
      };
    }

    app.ticker.stop();
    requestRender();
    return undefined;
  }, [appReady, group.items, requestRender]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    const board = boardGraphicRef.current;
    const doodleActive = activeTool === "doodle";

    if (board && !isPanningRef.current) {
      board.cursor = doodleActive ? "none" : "default";
    }

    const itemById = new Map(group.items.map((item) => [item.id, item]));
    itemNodeByIdRef.current.forEach((itemNode, itemId) => {
      const item = itemById.get(itemId);
      if (!item) {
        return;
      }

      itemNode.eventMode = doodleActive ? "none" : "static";
      itemNode.cursor =
        doodleActive || group.locked || item.locked ? "default" : "move";
    });
  }, [appReady, activeTool, group.items, group.locked]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    cancelWheelZoomAnimationRef.current?.();
    const hasUncommittedLocalViewChange = viewCommitTimerRef.current !== null;
    if (hasUncommittedLocalViewChange) {
      commitView();
    } else if (viewCommitTimerRef.current !== null) {
      window.clearTimeout(viewCommitTimerRef.current);
      viewCommitTimerRef.current = null;
    }

    const hasLivePreviewInsets =
      previewInsetsRef.current.left !== 0 ||
      previewInsetsRef.current.top !== 0 ||
      previewInsetsRef.current.right !== 0 ||
      previewInsetsRef.current.bottom !== 0;
    const boardContainer = boardContainerRef.current;
    const hasExternalViewChange =
      boardContainer &&
      (Math.abs(boardContainer.x - group.panX) > 0.75 ||
        Math.abs(boardContainer.y - group.panY) > 0.75 ||
        Math.abs(boardContainer.scale.x - group.zoom) > 0.001);

    // When a drag/transform preview expanded left or top, group state already
    // contains the corrected committed pan. Reusing the temporary preview pan
    // here would reintroduce the snap on rebuild.
    // Likewise, opening a different file can keep the same group id
    // ("canvas-main"); in that case the stored file view must win over the
    // previous live board view.
    if (!hasLivePreviewInsets && (!hasExternalViewChange || hasUncommittedLocalViewChange)) {
      preserveLiveBoardView();
    }

    if (!activeItemDragRef.current && !activeSelectionTransformRef.current) {
      previewInsetsRef.current = ZERO_INSETS;
      onCanvasSizePreviewChangeRef.current?.(null);
    }

    const nextRenderedSceneKey = {
      groupId: group.id,
      canvasWidth: group.canvasSize.width,
      canvasHeight: group.canvasSize.height,
      preferHighResolution: group.zoom >= 2 * (zoomBaseline ?? DEFAULT_VIEW_ZOOM_BASELINE),
      showSwatches,
    } satisfies RenderedSceneKey;
    const canPatchTransforms =
      !activeItemDragRef.current &&
      !activeSelectionTransformRef.current &&
      renderedSceneKeyRef.current !== null &&
      isSameRenderedSceneKey(renderedSceneKeyRef.current, nextRenderedSceneKey) &&
      canPatchItemTransformsOnly(renderedSceneItemsRef.current, group.items);

    if (canPatchTransforms && patchItemTransformsOnly()) {
      rememberRenderedScene(group.items, nextRenderedSceneKey);
      return;
    }

    const canRefreshImageQuality =
      !activeItemDragRef.current &&
      !activeSelectionTransformRef.current &&
      renderedSceneKeyRef.current !== null &&
      isSameRenderedSceneShell(renderedSceneKeyRef.current, nextRenderedSceneKey) &&
      canPatchItemTransformsOnly(renderedSceneItemsRef.current, group.items);

    if (
      canRefreshImageQuality &&
      refreshImageQualityForZoom(nextRenderedSceneKey.preferHighResolution)
    ) {
      rememberRenderedScene(group.items, nextRenderedSceneKey);
      return;
    }

    rebuildScene();
    rememberRenderedScene(group.items, nextRenderedSceneKey);
  }, [
    appReady,
    group.id,
    group.items,
    group.canvasSize.width,
    group.canvasSize.height,
    group.panX,
    group.panY,
    group.zoom,
    showSwatches,
    preserveLiveBoardView,
    patchItemTransformsOnly,
    refreshImageQualityForZoom,
    rebuildScene,
    rememberRenderedScene,
    commitView,
    zoomBaseline,
  ]);

  useEffect(() => {
    if (!appReady) {
      lastAppliedGrayscaleRef.current = group.filters.grayscale;
      return;
    }

    if (lastAppliedGrayscaleRef.current === group.filters.grayscale) {
      return;
    }

    lastAppliedGrayscaleRef.current = group.filters.grayscale;
    const renderToken = ++renderTokenRef.current;

    group.items.forEach((item) => {
      if (item.type !== "image") {
        return;
      }

      const itemNode = itemNodeByIdRef.current.get(item.id);
      const frameMeta = frameMetaByIdRef.current.get(item.id);
      if (!itemNode || !frameMeta) {
        return;
      }

      void refreshBoardImageVisuals({
        item,
        itemNode,
        safeWidth: frameMeta.width,
        safeHeight: frameMeta.height,
        canvasZoom: group.zoom / (zoomBaseline ?? DEFAULT_VIEW_ZOOM_BASELINE),
        dotGain20BlackAndWhite: group.filters.grayscale > 0,
        renderToken,
        renderTokenRef,
        requestRender,
      });
    });
  }, [
    appReady,
    group.filters.grayscale,
    group.id,
    group.items,
    group.zoom,
    requestRender,
    zoomBaseline,
  ]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    const contentLayer = contentLayerRef.current;
    if (!contentLayer) {
      return;
    }

    const filters = [];

    if (group.filters.blur > 0) {
      const blurFilter =
        contentBlurFilterRef.current ??
        new BlurFilter({ strength: group.filters.blur, quality: 2, kernelSize: 5 });
      blurFilter.strength = group.filters.blur;
      contentBlurFilterRef.current = blurFilter;
      filters.push(blurFilter);
    }

    if (group.filters.grayscale > 0) {
      const colorMatrixFilter =
        contentColorMatrixFilterRef.current ?? new ColorMatrixFilter();
      colorMatrixFilter.reset();
      colorMatrixFilter.saturate(
        -Math.min(1, Math.max(0, group.filters.grayscale / 100)),
        false,
      );
      contentColorMatrixFilterRef.current = colorMatrixFilter;
      filters.push(colorMatrixFilter);
    }

    contentLayer.filters = filters.length > 0 ? filters : null;
    requestRender();
  }, [appReady, group.filters.blur, group.filters.grayscale, requestRender]);

  useEffect(() => {
    const activeCaptureIds = new Set<string>();
    for (const item of group.items) {
      if (item.type === "capture") {
        activeCaptureIds.add(item.id);
      }
    }

    const captureSessionById = captureSessionByIdRef.current;
    captureSessionById.forEach((_, captureId) => {
      if (!activeCaptureIds.has(captureId)) {
        stopCaptureSession(captureId);
      }
    });
  }, [captureSessionByIdRef, group.id, group.items, stopCaptureSession]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    if (group.annotations.length === 0) {
      cancelAnnotationSession();
    }

    redrawAnnotations(group.annotations);
  }, [appReady, cancelAnnotationSession, group.annotations, redrawAnnotations]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, selectedItemIds, updateSelectedBoundsOverlay]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, cropSession, updateSelectedBoundsOverlay]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    updateSelectedBoundsOverlay();
  }, [appReady, group.items, updateSelectedBoundsOverlay]);

  useLayoutEffect(() => {
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

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.clientX, lastPointer.clientY, lastPointer);
    }
  }, [appReady, group.zoom, updateDoodleCursor]);

  useLayoutEffect(() => {
    if (!appReady) {
      return;
    }

    const boardContainer = boardContainerRef.current;
    const hasExternalViewChange =
      boardContainer &&
      (Math.abs(boardContainer.x - group.panX) > 0.75 ||
        Math.abs(boardContainer.y - group.panY) > 0.75 ||
        Math.abs(boardContainer.scale.x - group.zoom) > 0.001);

    if (isPanningRef.current && hasExternalViewChange) {
      isPanningRef.current = false;
      if (boardGraphicRef.current) {
        boardGraphicRef.current.cursor =
          activeToolRef.current === "doodle" && !spacePanActiveRef.current
            ? "none"
            : "default";
      }
    }

    if (
      isPanningRef.current ||
      activeItemDragRef.current ||
      activeAnnotationSessionRef.current ||
      activeSelectionBoxRef.current
    ) {
      return;
    }

    if (hasExternalViewChange) {
      cancelWheelZoomAnimationRef.current?.();
      if (viewCommitTimerRef.current !== null) {
        window.clearTimeout(viewCommitTimerRef.current);
        viewCommitTimerRef.current = null;
      }
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
    () => {
      const onCanvasSizePreviewChange = onCanvasSizePreviewChangeRef.current;
      const onExportReady = onExportReadyRef.current;

      return () => {
        onCanvasSizePreviewChange?.(null);
        onExportReady?.(null);
        hideSelectedBoundsOverlay();
      };
    },
    [hideSelectedBoundsOverlay],
  );

  useEffect(() => {
    if (!appReady) {
      onExportReadyRef.current?.(null);
      return;
    }

    const notifyExportReady = onExportReadyRef.current;
    notifyExportReady?.(() => {
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
        app.render();

        const exportCanvas = app.renderer.extract.canvas({
          target: boardContainer,
          frame: new Rectangle(0, 0, group.canvasSize.width, group.canvasSize.height),
          resolution: 1,
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
        app.render();
      }
    });

    return () => {
      notifyExportReady?.(null);
    };
  }, [appReady, group.canvasSize.height, group.canvasSize.width]);

  return (
    <div className="canvas-host">
      <div
        className="canvas-surface"
        ref={hostRef}
        style={{
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
          aria-label="Resize selection from top-left"
          data-handle="nw"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-ne"
          aria-label="Resize selection from top-right"
          data-handle="ne"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-se"
          aria-label="Resize selection from bottom-right"
          data-handle="se"
          onPointerDown={handleTransformHandlePointerDown}
        />
        <button
          type="button"
          className="canvas-transform-handle handle-sw"
          aria-label="Resize selection from bottom-left"
          data-handle="sw"
          onPointerDown={handleTransformHandlePointerDown}
        />
      </div>
      <div className="canvas-selection-marquee" ref={selectionMarqueeRef} />
      <div className="canvas-cursor-overlay" ref={cursorOverlayRef} />
    </div>
  );
};
