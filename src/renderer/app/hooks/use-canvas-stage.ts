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

    const updateViewportSize = () => {
      setViewportSize({
        width: Math.round(node.clientWidth),
        height: Math.round(node.clientHeight),
      });
    };

    updateViewportSize();

    const observer = new ResizeObserver(() => {
      updateViewportSize();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return {
    canvasStageRef,
    exportCanvasImageRef,
    viewportSize,
  };
};
