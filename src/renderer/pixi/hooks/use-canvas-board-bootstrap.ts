import { useEffect, type MutableRefObject } from "react";
import { Application, Container, Graphics } from "pixi.js";
import type {
  ActiveAnnotationSessionState,
  ActiveItemDragState,
  ActiveSelectionBoxState,
} from "@renderer/pixi/types";
import { createBoardGlobalPointerHandlers } from "@renderer/pixi/hooks/use-board-global-pointer-events";
import { initializeBoardPixi } from "@renderer/pixi/hooks/use-board-pixi-init";
import { createBoardWheelZoomController } from "@renderer/pixi/hooks/use-board-wheel-zoom";

interface UseCanvasBoardBootstrapOptions {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  appRef: MutableRefObject<Application | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  boardGraphicRef: MutableRefObject<Graphics | null>;
  gridGraphicRef: MutableRefObject<Graphics | null>;
  itemLayerRef: MutableRefObject<Container | null>;
  annotationMaskRef: MutableRefObject<Graphics | null>;
  annotationLayerRef: MutableRefObject<Graphics | null>;
  annotationPreviewLayerRef: MutableRefObject<Graphics | null>;
  viewCommitTimerRef: MutableRefObject<number | null>;
  isPanningRef: MutableRefObject<boolean>;
  activePanPointerIdRef: MutableRefObject<number | null>;
  panStartRef: MutableRefObject<{ x: number; y: number }>;
  panOriginRef: MutableRefObject<{ x: number; y: number }>;
  cancelWheelZoomAnimationRef: MutableRefObject<(() => void) | null>;
  activeItemDragRef: MutableRefObject<ActiveItemDragState | null>;
  activeSelectionBoxRef: MutableRefObject<ActiveSelectionBoxState | null>;
  activeAnnotationSessionRef: MutableRefObject<ActiveAnnotationSessionState | null>;
  activeToolRef: MutableRefObject<string | null>;
  spacePanActiveRef: MutableRefObject<boolean>;
  selectionIdsRef: MutableRefObject<string[]>;
  onSelectionChangeRef: MutableRefObject<(itemIds: string[]) => void>;
  hideDoodleCursor: () => void;
  updateDoodleCursor: (
    clientX: number,
    clientY: number,
    pointerState?: {
      pointerType: string;
      pressure: number;
      buttons: number;
    },
  ) => void;
  updateAnnotationSession: (pointer: {
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType: string;
    pressure: number;
  }) => void;
  updateSelectionMarquee: (clientX: number, clientY: number) => void;
  updateDraggedItemPosition: (clientX: number, clientY: number) => void;
  commitAnnotationSession: () => void;
  commitDraggedItemPatch: () => void;
  hideSelectionMarquee: () => void;
  commitView: () => void;
  scheduleViewCommit: (delay?: number) => void;
  drawBoardSurface: () => void;
  updateSelectedBoundsOverlay: () => void;
  rebuildScene: () => void;
  setAppReady: (ready: boolean) => void;
  stopCaptureSession: (captureId: string) => void;
  captureSessionByIdRef: MutableRefObject<Map<string, unknown>>;
}

export const useCanvasBoardBootstrap = ({
  hostRef,
  appRef,
  boardContainerRef,
  boardGraphicRef,
  gridGraphicRef,
  itemLayerRef,
  annotationMaskRef,
  annotationLayerRef,
  annotationPreviewLayerRef,
  viewCommitTimerRef,
  isPanningRef,
  activePanPointerIdRef,
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
  drawBoardSurface,
  updateSelectedBoundsOverlay,
  rebuildScene,
  setAppReady,
  stopCaptureSession,
  captureSessionByIdRef,
}: UseCanvasBoardBootstrapOptions) => {
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;

    const bootstrap = async () => {
      const app = await initializeBoardPixi({
        host,
        isMounted: () => mounted,
        appRef,
        boardContainerRef,
        boardGraphicRef,
        gridGraphicRef,
        itemLayerRef,
        annotationMaskRef,
        annotationLayerRef,
        annotationPreviewLayerRef,
      });

      if (!app) {
        return;
      }

      const wheelZoomController = createBoardWheelZoomController({
        host,
        boardContainerRef,
        cancelWheelZoomAnimationRef,
        drawBoardSurface,
        updateSelectedBoundsOverlay,
        scheduleViewCommit,
      });

      const {
        onPointerLeave,
        onPointerMove,
        onPointerUp,
        onKeyDown,
        onKeyUp,
      } = createBoardGlobalPointerHandlers({
        isPanningRef,
        activePanPointerIdRef,
        panStartRef,
        panOriginRef,
        activeItemDragRef,
        activeSelectionBoxRef,
        activeAnnotationSessionRef,
        activeToolRef,
        spacePanActiveRef,
        selectionIdsRef,
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
        onSelectionChangeRef,
        boardGraphicRef,
        boardContainerRef,
      });

      host.addEventListener("wheel", wheelZoomController.onWheel, { passive: false });
      host.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);

      resizeObserver = new ResizeObserver(() => {
        app.renderer.resize(host.clientWidth, host.clientHeight);
      });
      resizeObserver.observe(host);
      rebuildScene();
      setAppReady(true);

      return () => {
        wheelZoomController.cleanup();
        host.removeEventListener("wheel", wheelZoomController.onWheel);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };
    };

    let cleanupListeners: (() => void) | undefined;
    void bootstrap().then((cleanup) => {
      cleanupListeners = cleanup;
    });

    return () => {
      mounted = false;

      if (viewCommitTimerRef.current !== null) {
        window.clearTimeout(viewCommitTimerRef.current);
        viewCommitTimerRef.current = null;
      }

      cleanupListeners?.();
      resizeObserver?.disconnect();
      activeItemDragRef.current = null;
      host.replaceChildren();
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
      boardContainerRef.current = null;
      boardGraphicRef.current = null;
      gridGraphicRef.current = null;
      itemLayerRef.current = null;
      annotationMaskRef.current = null;
      annotationLayerRef.current = null;
      annotationPreviewLayerRef.current = null;
      captureSessionByIdRef.current.forEach((_, captureId) => {
        stopCaptureSession(captureId);
      });
    };
  }, [
    activeAnnotationSessionRef,
    activeItemDragRef,
    activePanPointerIdRef,
    activeSelectionBoxRef,
    activeToolRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    appRef,
    boardContainerRef,
    boardGraphicRef,
    captureSessionByIdRef,
    commitAnnotationSession,
    commitDraggedItemPatch,
    commitView,
    drawBoardSurface,
    gridGraphicRef,
    hideDoodleCursor,
    hideSelectionMarquee,
    hostRef,
    isPanningRef,
    itemLayerRef,
    annotationMaskRef,
    onSelectionChangeRef,
    panOriginRef,
    panStartRef,
    rebuildScene,
    scheduleViewCommit,
    selectionIdsRef,
    setAppReady,
    spacePanActiveRef,
    stopCaptureSession,
    updateAnnotationSession,
    updateDoodleCursor,
    updateDraggedItemPosition,
    updateSelectedBoundsOverlay,
    updateSelectionMarquee,
    viewCommitTimerRef,
  ]);
};
