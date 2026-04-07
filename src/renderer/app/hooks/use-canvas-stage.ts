import { useEffect, useRef, useState } from "react";

export const useCanvasStage = () => {
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const exportCanvasImageRef = useRef<(() => string | null) | null>(null);
  const [viewportSize, setViewportSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const node = canvasStageRef.current;
    if (!node) {
      return;
    }

    let frameId: number | null = null;
    let lastWidth = -1;
    let lastHeight = -1;

    const updateViewportSize = () => {
      frameId = null;
      const nextWidth = Math.round(node.clientWidth);
      const nextHeight = Math.round(node.clientHeight);

      if (nextWidth === lastWidth && nextHeight === lastHeight) {
        return;
      }

      lastWidth = nextWidth;
      lastHeight = nextHeight;
      setViewportSize({
        width: nextWidth,
        height: nextHeight,
      });
    };

    const scheduleViewportSizeUpdate = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(updateViewportSize);
    };

    updateViewportSize();

    const observer = new ResizeObserver(() => {
      scheduleViewportSizeUpdate();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return {
    canvasStageRef,
    exportCanvasImageRef,
    viewportSize,
  };
};
