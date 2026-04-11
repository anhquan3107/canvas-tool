import { useEffect, type MutableRefObject } from "react";
import { Application, Container, Graphics, type Rectangle } from "pixi.js";
import type {
  ActiveAnnotationSessionState,
  ActiveItemDragState,
  ActiveSelectionBoxState,
} from "@renderer/pixi/types";
import { clamp } from "@renderer/pixi/utils/geometry";
import { MARQUEE_DRAG_THRESHOLD } from "@renderer/pixi/constants";
import {
  getNormalizedPointerData,
  type NormalizedPointerData,
} from "@renderer/pixi/utils/pointer";

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
  groupRef: MutableRefObject<{ locked: boolean }>;
  viewCommitTimerRef: MutableRefObject<number | null>;
  isPanningRef: MutableRefObject<boolean>;
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
  onLockedInteractionRef: MutableRefObject<(() => void) | undefined>;
  hideDoodleCursor: () => void;
  updateDoodleCursor: (
    clientX: number,
    clientY: number,
    pointerState?: Pick<
      NormalizedPointerData,
      "pointerType" | "pressure" | "buttons"
    >,
  ) => void;
  updateAnnotationSession: (
    pointer: Pick<
      NormalizedPointerData,
      "clientX" | "clientY" | "pointerId" | "pointerType" | "pressure"
    >,
  ) => void;
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

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };

    const onPointerLeave = () => {
      hideDoodleCursor();
    };

    const bootstrap = async () => {
      const app = new Application();
      const rendererResolution = Math.max(window.devicePixelRatio || 1, 2);
      await app.init({
        antialias: true,
        autoDensity: true,
        background: "#000000",
        backgroundAlpha: 0,
        preserveDrawingBuffer: true,
        resolution: rendererResolution,
        resizeTo: host,
      });

      if (!mounted) {
        app.destroy(true, { children: true });
        return;
      }

      appRef.current = app;
      host.replaceChildren(app.canvas);

      const root = new Container();
      root.eventMode = "static";
      app.stage.addChild(root);

      const boardContainer = new Container();
      root.addChild(boardContainer);
      boardContainerRef.current = boardContainer;

      const board = new Graphics();
      boardContainer.addChild(board);
      boardGraphicRef.current = board;

      const grid = new Graphics();
      boardContainer.addChild(grid);
      gridGraphicRef.current = grid;

      const itemLayer = new Container();
      boardContainer.addChild(itemLayer);
      itemLayerRef.current = itemLayer;

      const annotationMask = new Graphics();
      annotationMask.eventMode = "none";
      annotationMask.alpha = 0;
      boardContainer.addChild(annotationMask);
      annotationMaskRef.current = annotationMask;

      const annotationLayer = new Graphics();
      annotationLayer.eventMode = "none";
      annotationLayer.mask = annotationMask;
      boardContainer.addChild(annotationLayer);
      annotationLayerRef.current = annotationLayer;

      const annotationPreviewLayer = new Graphics();
      annotationPreviewLayer.eventMode = "none";
      annotationPreviewLayer.mask = annotationMask;
      boardContainer.addChild(annotationPreviewLayer);
      annotationPreviewLayerRef.current = annotationPreviewLayer;
      let wheelZoomAnimationFrame: number | null = null;
      const wheelZoomTarget = {
        scale: boardContainer.scale.x,
        x: boardContainer.x,
        y: boardContainer.y,
      };

      const animateWheelZoom = () => {
        const activeBoard = boardContainerRef.current;
        if (!activeBoard) {
          wheelZoomAnimationFrame = null;
          return;
        }

        const interpolate = (current: number, target: number) =>
          current + (target - current) * 0.22;

        activeBoard.scale.set(
          interpolate(activeBoard.scale.x, wheelZoomTarget.scale),
          interpolate(activeBoard.scale.y, wheelZoomTarget.scale),
        );
        activeBoard.x = interpolate(activeBoard.x, wheelZoomTarget.x);
        activeBoard.y = interpolate(activeBoard.y, wheelZoomTarget.y);
        drawBoardSurface();
        updateSelectedBoundsOverlay();

        const settled =
          Math.abs(activeBoard.scale.x - wheelZoomTarget.scale) < 0.0015 &&
          Math.abs(activeBoard.x - wheelZoomTarget.x) < 0.75 &&
          Math.abs(activeBoard.y - wheelZoomTarget.y) < 0.75;

        if (settled) {
          activeBoard.scale.set(wheelZoomTarget.scale, wheelZoomTarget.scale);
          activeBoard.x = wheelZoomTarget.x;
          activeBoard.y = wheelZoomTarget.y;
          drawBoardSurface();
          updateSelectedBoundsOverlay();
          wheelZoomAnimationFrame = null;
          return;
        }

        wheelZoomAnimationFrame = window.requestAnimationFrame(animateWheelZoom);
      };

      const cancelWheelZoomAnimation = () => {
        if (wheelZoomAnimationFrame !== null) {
          window.cancelAnimationFrame(wheelZoomAnimationFrame);
          wheelZoomAnimationFrame = null;
        }

        const activeBoard = boardContainerRef.current;
        if (!activeBoard) {
          return;
        }

        wheelZoomTarget.scale = activeBoard.scale.x;
        wheelZoomTarget.x = activeBoard.x;
        wheelZoomTarget.y = activeBoard.y;
      };

      cancelWheelZoomAnimationRef.current = cancelWheelZoomAnimation;

      const onPointerMove = (event: PointerEvent) => {
        const pointer = getNormalizedPointerData(event);
        updateDoodleCursor(pointer.clientX, pointer.clientY, pointer);

        if (activeAnnotationSessionRef.current) {
          if (typeof event.getCoalescedEvents === "function") {
            event.getCoalescedEvents().forEach((coalescedEvent) => {
              updateAnnotationSession(getNormalizedPointerData(coalescedEvent));
            });
          }

          updateAnnotationSession(pointer);
          return;
        }

        if (activeSelectionBoxRef.current) {
          updateSelectionMarquee(pointer.clientX, pointer.clientY);
          return;
        }

        if (activeItemDragRef.current) {
          updateDraggedItemPosition(pointer.clientX, pointer.clientY);
          return;
        }

        const currentBoard = boardContainerRef.current;
        if (!isPanningRef.current || !currentBoard) {
          return;
        }

        currentBoard.x =
          panOriginRef.current.x + (pointer.clientX - panStartRef.current.x);
        currentBoard.y =
          panOriginRef.current.y + (pointer.clientY - panStartRef.current.y);
        drawBoardSurface();
        updateSelectedBoundsOverlay();
      };

      const onPointerUp = (event: PointerEvent) => {
        const pointer = getNormalizedPointerData(event);

        if (
          activeAnnotationSessionRef.current &&
          activeAnnotationSessionRef.current.pointerId === pointer.pointerId
        ) {
          commitAnnotationSession();
        }

        if (activeSelectionBoxRef.current) {
          const selectionBox = activeSelectionBoxRef.current;
          const movedDistance = Math.hypot(
            pointer.clientX - selectionBox.startClient.x,
            pointer.clientY - selectionBox.startClient.y,
          );

          if (
            movedDistance < MARQUEE_DRAG_THRESHOLD &&
            !selectionBox.additive
          ) {
            selectionIdsRef.current = [];
            onSelectionChangeRef.current([]);
          }

          activeSelectionBoxRef.current = null;
          hideSelectionMarquee();
        }

        if (activeItemDragRef.current) {
          commitDraggedItemPatch();
        }

        if (!isPanningRef.current) {
          return;
        }

        isPanningRef.current = false;
        if (boardGraphicRef.current) {
          boardGraphicRef.current.cursor =
            activeToolRef.current === "doodle" && !spacePanActiveRef.current
              ? "none"
              : "grab";
        }
        commitView();
      };

      const onWheel = (event: WheelEvent) => {
        const currentBoard = boardContainerRef.current;
        if (!currentBoard) {
          return;
        }

        if (groupRef.current.locked) {
          event.preventDefault();
          onLockedInteractionRef.current?.();
          return;
        }

        event.preventDefault();

        const rect = host.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const baseScale =
          wheelZoomAnimationFrame !== null
            ? wheelZoomTarget.scale
            : currentBoard.scale.x;
        const baseX =
          wheelZoomAnimationFrame !== null ? wheelZoomTarget.x : currentBoard.x;
        const baseY =
          wheelZoomAnimationFrame !== null ? wheelZoomTarget.y : currentBoard.y;
        const worldX = (pointerX - baseX) / baseScale;
        const worldY = (pointerY - baseY) / baseScale;
        const normalizedDelta =
          event.deltaY *
          (event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 8
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? 28
              : 1);
        const nextZoom = clamp(
          baseScale * Math.exp(-normalizedDelta * 0.0024),
          0.18,
          20,
        );

        wheelZoomTarget.scale = nextZoom;
        wheelZoomTarget.x = pointerX - worldX * nextZoom;
        wheelZoomTarget.y = pointerY - worldY * nextZoom;

        if (wheelZoomAnimationFrame === null) {
          wheelZoomAnimationFrame = window.requestAnimationFrame(animateWheelZoom);
        }

        scheduleViewCommit(120);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (isTypingTarget(event.target)) {
          return;
        }

        if (event.code !== "Space") {
          return;
        }

        spacePanActiveRef.current = true;
        if (boardGraphicRef.current && !isPanningRef.current) {
          boardGraphicRef.current.cursor = "grab";
        }
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (event.code !== "Space") {
          return;
        }

        spacePanActiveRef.current = false;
        if (boardGraphicRef.current && !isPanningRef.current) {
          boardGraphicRef.current.cursor =
            activeToolRef.current === "doodle" ? "none" : "grab";
        }
      };

      host.addEventListener("wheel", onWheel, { passive: false });
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
        if (wheelZoomAnimationFrame !== null) {
          window.cancelAnimationFrame(wheelZoomAnimationFrame);
          wheelZoomAnimationFrame = null;
        }
        cancelWheelZoomAnimationRef.current = null;
        host.removeEventListener("wheel", onWheel);
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
      host.removeEventListener("pointerleave", onPointerLeave);
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
    activeSelectionBoxRef,
    activeToolRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    appRef,
    boardContainerRef,
    boardGraphicRef,
    groupRef,
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
    onLockedInteractionRef,
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
