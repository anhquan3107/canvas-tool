import type { MutableRefObject } from "react";
import type { Container } from "pixi.js";
import { clamp } from "@renderer/pixi/utils/geometry";

interface CreateBoardWheelZoomControllerOptions {
  host: HTMLDivElement;
  boardContainerRef: MutableRefObject<Container | null>;
  cancelWheelZoomAnimationRef: MutableRefObject<(() => void) | null>;
  drawBoardSurface: () => void;
  updateSelectedBoundsOverlay: () => void;
  scheduleViewCommit: (delay?: number) => void;
}

export const createBoardWheelZoomController = ({
  host,
  boardContainerRef,
  cancelWheelZoomAnimationRef,
  drawBoardSurface,
  updateSelectedBoundsOverlay,
  scheduleViewCommit,
}: CreateBoardWheelZoomControllerOptions) => {
  let wheelZoomAnimationFrame: number | null = null;
  const activeBoard = boardContainerRef.current;
  const wheelZoomTarget = {
    scale: activeBoard?.scale.x ?? 1,
    x: activeBoard?.x ?? 0,
    y: activeBoard?.y ?? 0,
  };

  const animateWheelZoom = () => {
    const currentBoard = boardContainerRef.current;
    if (!currentBoard) {
      wheelZoomAnimationFrame = null;
      return;
    }

    const interpolate = (current: number, target: number) =>
      current + (target - current) * 0.22;

    currentBoard.scale.set(
      interpolate(currentBoard.scale.x, wheelZoomTarget.scale),
      interpolate(currentBoard.scale.y, wheelZoomTarget.scale),
    );
    currentBoard.x = interpolate(currentBoard.x, wheelZoomTarget.x);
    currentBoard.y = interpolate(currentBoard.y, wheelZoomTarget.y);
    drawBoardSurface();
    updateSelectedBoundsOverlay();

    const settled =
      Math.abs(currentBoard.scale.x - wheelZoomTarget.scale) < 0.0015 &&
      Math.abs(currentBoard.x - wheelZoomTarget.x) < 0.75 &&
      Math.abs(currentBoard.y - wheelZoomTarget.y) < 0.75;

    if (settled) {
      currentBoard.scale.set(wheelZoomTarget.scale, wheelZoomTarget.scale);
      currentBoard.x = wheelZoomTarget.x;
      currentBoard.y = wheelZoomTarget.y;
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

    const currentBoard = boardContainerRef.current;
    if (!currentBoard) {
      return;
    }

    wheelZoomTarget.scale = currentBoard.scale.x;
    wheelZoomTarget.x = currentBoard.x;
    wheelZoomTarget.y = currentBoard.y;
  };

  cancelWheelZoomAnimationRef.current = cancelWheelZoomAnimation;

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

  const cleanup = () => {
    if (wheelZoomAnimationFrame !== null) {
      window.cancelAnimationFrame(wheelZoomAnimationFrame);
      wheelZoomAnimationFrame = null;
    }

    cancelWheelZoomAnimationRef.current = null;
  };

  return {
    onWheel,
    cleanup,
  };
};
