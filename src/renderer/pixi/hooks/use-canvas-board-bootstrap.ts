import { useEffect, type MutableRefObject } from "react";
import { Application, Container, Graphics, type Rectangle } from "pixi.js";
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from "@shared/project-defaults";
import type {
  ActiveAnnotationSessionState,
  ActiveItemDragState,
  ActiveSelectionBoxState,
  RequestCanvasRender,
} from "@renderer/pixi/types";
import { clamp } from "@renderer/pixi/utils/geometry";
import {
  BOARD_WHEEL_ZOOM_SENSITIVITY,
  MARQUEE_DRAG_THRESHOLD,
} from "@renderer/pixi/constants";
import {
  getNormalizedPointerData,
  type NormalizedPointerData,
} from "@renderer/pixi/utils/pointer";

interface UseCanvasBoardBootstrapOptions {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  appRef: MutableRefObject<Application | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  contentLayerRef: MutableRefObject<Container | null>;
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
  drawBoardSurface: () => void;
  updateSelectedBoundsOverlay: () => void;
  rebuildScene: () => void;
  setAppReady: (ready: boolean) => void;
  stopCaptureSession: (captureId: string) => void;
  captureSessionByIdRef: MutableRefObject<Map<string, unknown>>;
  requestRender: RequestCanvasRender;
}

export const useCanvasBoardBootstrap = ({
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
}: UseCanvasBoardBootstrapOptions) => {
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const activeItemDragState = activeItemDragRef;
    const appState = appRef;
    const boardContainerState = boardContainerRef;
    const contentLayerState = contentLayerRef;
    const boardGraphicState = boardGraphicRef;
    const gridGraphicState = gridGraphicRef;
    const itemLayerState = itemLayerRef;
    const annotationMaskState = annotationMaskRef;
    const annotationLayerState = annotationLayerRef;
    const annotationPreviewLayerState = annotationPreviewLayerRef;
    const captureSessionByIdState = captureSessionByIdRef;
    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let appInstance: Application | null = null;

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };

    const clearViewCommitTimer = () => {
      if (viewCommitTimerRef.current !== null) {
        window.clearTimeout(viewCommitTimerRef.current);
        viewCommitTimerRef.current = null;
      }
    };

    const onPointerLeave = () => {
      hideDoodleCursor();
    };

    const bootstrap = async () => {
      if (!mounted) {
        return;
      }

      const app = new Application();
      const rendererResolution = Math.min(
        2,
        Math.max(window.devicePixelRatio || 1, 1),
      );
      await app.init({
        antialias: true,
        autoStart: false,
        autoDensity: true,
        background: "#000000",
        backgroundAlpha: 0,
        resolution: rendererResolution,
        resizeTo: host,
      });
      app.ticker.stop();

      if (!mounted) {
        app.destroy(true, { children: true });
        return;
      }

      appState.current = app;
      appInstance = app;
      host.replaceChildren(app.canvas);

      const root = new Container();
      root.eventMode = "static";
      app.stage.addChild(root);

      const boardContainer = new Container();
      root.addChild(boardContainer);
      boardContainerRef.current = boardContainer;

      const contentLayer = new Container();
      boardContainer.addChild(contentLayer);
      contentLayerRef.current = contentLayer;

      const board = new Graphics();
      contentLayer.addChild(board);
      boardGraphicRef.current = board;

      const grid = new Graphics();
      contentLayer.addChild(grid);
      gridGraphicRef.current = grid;

      const itemLayer = new Container();
      contentLayer.addChild(itemLayer);
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
          commitView();
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
      let annotationMoveFrame: number | null = null;
      let pendingAnnotationPointers: Array<
        Pick<
          NormalizedPointerData,
          "clientX" | "clientY" | "pointerId" | "pointerType" | "pressure"
        >
      > = [];

      const flushAnnotationMoveQueue = () => {
        annotationMoveFrame = null;
        if (pendingAnnotationPointers.length === 0) {
          return;
        }

        const queuedPointers = pendingAnnotationPointers;
        pendingAnnotationPointers = [];
        queuedPointers.forEach((queuedPointer) => {
          updateAnnotationSession(queuedPointer);
        });
      };

      const enqueueAnnotationPointer = (
        pointer: Pick<
          NormalizedPointerData,
          "clientX" | "clientY" | "pointerId" | "pointerType" | "pressure"
        >,
      ) => {
        pendingAnnotationPointers.push(pointer);
        if (annotationMoveFrame === null) {
          annotationMoveFrame = window.requestAnimationFrame(
            flushAnnotationMoveQueue,
          );
        }
      };

      const onPointerMove = (event: PointerEvent) => {
        const pointer = getNormalizedPointerData(event);
        updateDoodleCursor(pointer.clientX, pointer.clientY, pointer);

        if (activeAnnotationSessionRef.current) {
          const annotationSession = activeAnnotationSessionRef.current;
          const coalescedEvents =
            typeof event.getCoalescedEvents === "function"
              ? event.getCoalescedEvents()
              : [];
          if (coalescedEvents.length > 0) {
            coalescedEvents.forEach((coalescedEvent) => {
              const nextPointer = getNormalizedPointerData(coalescedEvent);
              if (annotationSession.mode === "brush") {
                updateAnnotationSession(nextPointer);
                return;
              }
              enqueueAnnotationPointer(nextPointer);
            });
          }

          const lastCoalescedEvent =
            coalescedEvents.length > 0
              ? coalescedEvents[coalescedEvents.length - 1]
              : null;
          const shouldProcessPointer =
            !lastCoalescedEvent ||
            lastCoalescedEvent.clientX !== pointer.clientX ||
            lastCoalescedEvent.clientY !== pointer.clientY ||
            (lastCoalescedEvent.pointerId ?? pointer.pointerId) !== pointer.pointerId ||
            (lastCoalescedEvent.pressure ?? pointer.pressure) !== pointer.pressure;

          if (!shouldProcessPointer) {
            return;
          }

          if (annotationSession.mode === "brush") {
            updateAnnotationSession(pointer);
          } else {
            enqueueAnnotationPointer(pointer);
          }
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
          enqueueAnnotationPointer(pointer);
          flushAnnotationMoveQueue();
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
              : "default";
        }
        if (host) {
          host.classList.remove("force-grabbing-cursor");
          if (spacePanActiveRef.current) {
            host.classList.add("force-grab-cursor");
          }
        }
        commitView();
      };

      const onWheel = (event: WheelEvent) => {
        const currentBoard = boardContainerRef.current;
        if (!currentBoard) {
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
          baseScale * Math.exp(-normalizedDelta * BOARD_WHEEL_ZOOM_SENSITIVITY),
          MIN_CANVAS_ZOOM,
          MAX_CANVAS_ZOOM,
        );

        wheelZoomTarget.scale = nextZoom;
        wheelZoomTarget.x = pointerX - worldX * nextZoom;
        wheelZoomTarget.y = pointerY - worldY * nextZoom;

        if (wheelZoomAnimationFrame === null) {
          wheelZoomAnimationFrame = window.requestAnimationFrame(animateWheelZoom);
        }

      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (isTypingTarget(event.target)) {
          return;
        }

        if (event.code !== "Space") {
          return;
        }

        spacePanActiveRef.current = true;
        if (host) {
          if (isPanningRef.current) {
            host.classList.add("force-grabbing-cursor");
          } else {
            host.classList.add("force-grab-cursor");
          }
        }
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (event.code !== "Space") {
          return;
        }

        spacePanActiveRef.current = false;
        if (host) {
          host.classList.remove("force-grab-cursor");
          host.classList.remove("force-grabbing-cursor");
        }
        if (boardGraphicRef.current && !isPanningRef.current) {
          boardGraphicRef.current.cursor =
            activeToolRef.current === "doodle" ? "none" : "default";
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
        requestRender();
      });
      resizeObserver.observe(host);
      rebuildScene();
      setAppReady(true);

      return () => {
        if (wheelZoomAnimationFrame !== null) {
          window.cancelAnimationFrame(wheelZoomAnimationFrame);
          wheelZoomAnimationFrame = null;
        }
        if (annotationMoveFrame !== null) {
          window.cancelAnimationFrame(annotationMoveFrame);
          annotationMoveFrame = null;
        }
        pendingAnnotationPointers = [];
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

      clearViewCommitTimer();

      cleanupListeners?.();
      resizeObserver?.disconnect();
      host.removeEventListener("pointerleave", onPointerLeave);
      activeItemDragState.current = null;
      host.replaceChildren();
      appInstance?.destroy(true, { children: true });
      appInstance = null;
      appState.current = null;
      boardContainerState.current = null;
      contentLayerState.current = null;
      boardGraphicState.current = null;
      gridGraphicState.current = null;
      itemLayerState.current = null;
      annotationMaskState.current = null;
      annotationLayerState.current = null;
      annotationPreviewLayerState.current = null;
      captureSessionByIdState.current.forEach((_, captureId) => {
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
    cancelWheelZoomAnimationRef,
    commitAnnotationSession,
    commitDraggedItemPatch,
    commitView,
    contentLayerRef,
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
    selectionIdsRef,
    setAppReady,
    spacePanActiveRef,
    stopCaptureSession,
    requestRender,
    updateAnnotationSession,
    updateDoodleCursor,
    updateDraggedItemPosition,
    updateSelectedBoundsOverlay,
    updateSelectionMarquee,
    viewCommitTimerRef,
  ]);
};
