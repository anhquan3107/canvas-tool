import { useCallback, type MutableRefObject } from "react";
import type { Container } from "pixi.js";
import { clamp } from "@renderer/pixi/utils/geometry";
import type { ReferenceGroup } from "@shared/types/project";

interface UseBoardCoordinateConversionOptions {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  groupRef: MutableRefObject<ReferenceGroup>;
}

export const useBoardCoordinateConversion = ({
  hostRef,
  boardContainerRef,
  groupRef,
}: UseBoardCoordinateConversionOptions) => {
  const clientPointToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const host = hostRef.current;
      const boardContainer = boardContainerRef.current;
      if (!host || !boardContainer) {
        return null;
      }

      const rect = host.getBoundingClientRect();
      const scene = groupRef.current;
      const rawX =
        (clientX - rect.left - boardContainer.x) / boardContainer.scale.x;
      const rawY =
        (clientY - rect.top - boardContainer.y) / boardContainer.scale.y;

      return {
        x: clamp(rawX, 0, scene.canvasSize.width),
        y: clamp(rawY, 0, scene.canvasSize.height),
        insideCanvas:
          rawX >= 0 &&
          rawX <= scene.canvasSize.width &&
          rawY >= 0 &&
          rawY <= scene.canvasSize.height,
      };
    },
    [boardContainerRef, groupRef, hostRef],
  );

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
    [boardContainerRef, hostRef],
  );

  return {
    clientPointToCanvas,
    clientPointToWorld,
  };
};
