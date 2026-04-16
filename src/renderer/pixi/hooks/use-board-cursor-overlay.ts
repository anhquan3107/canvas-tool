import { useCallback, type MutableRefObject } from "react";
import type { Container } from "pixi.js";
import { hexToRgba } from "@renderer/pixi/utils/color";
import {
  getDisplayPressureScale,
  type NormalizedPointerData,
} from "@renderer/pixi/utils/pointer";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";

interface UseBoardCursorOverlayOptions {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  cursorOverlayRef: MutableRefObject<HTMLDivElement | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  activeToolRef: MutableRefObject<ToolMode | null>;
  doodleModeRef: MutableRefObject<DoodleMode>;
  doodleColorRef: MutableRefObject<string>;
  doodleSizeRef: MutableRefObject<number>;
  lastPointerClientRef: MutableRefObject<
    Pick<NormalizedPointerData, "clientX" | "clientY" | "pointerType" | "pressure" | "buttons"> | null
  >;
}

export const useBoardCursorOverlay = ({
  hostRef,
  cursorOverlayRef,
  boardContainerRef,
  activeToolRef,
  doodleModeRef,
  doodleColorRef,
  doodleSizeRef,
  lastPointerClientRef,
}: UseBoardCursorOverlayOptions) => {
  const hideDoodleCursor = useCallback(() => {
    const cursorOverlay = cursorOverlayRef.current;
    if (!cursorOverlay) {
      return;
    }

    cursorOverlay.style.opacity = "0";
  }, [cursorOverlayRef]);

  const updateDoodleCursor = useCallback(
    (
      clientX: number,
      clientY: number,
      pointerState?: Pick<
        NormalizedPointerData,
        "pointerType" | "pressure" | "buttons"
      >,
    ) => {
      lastPointerClientRef.current = {
        clientX,
        clientY,
        pointerType: pointerState?.pointerType ?? "mouse",
        pressure: pointerState?.pressure ?? 1,
        buttons: pointerState?.buttons ?? 0,
      };

      const host = hostRef.current;
      const cursorOverlay = cursorOverlayRef.current;
      const boardContainer = boardContainerRef.current;
      if (!host || !cursorOverlay || !boardContainer) {
        return;
      }

      if (activeToolRef.current !== "doodle") {
        cursorOverlay.style.opacity = "0";
        return;
      }

      const rect = host.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        cursorOverlay.style.opacity = "0";
        return;
      }

      const pressureScale = getDisplayPressureScale(
        pointerState?.pointerType,
        pointerState?.pressure,
        pointerState?.buttons,
      );
      const size = Math.max(
        10,
        doodleSizeRef.current * pressureScale * boardContainer.scale.x,
      );
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const erasing =
        doodleModeRef.current === "erase-line" ||
        doodleModeRef.current === "erase-pixel";

      cursorOverlay.style.width = `${size}px`;
      cursorOverlay.style.height = `${size}px`;
      cursorOverlay.style.transform = `translate(${localX - size * 0.5}px, ${localY - size * 0.5}px)`;
      cursorOverlay.style.borderColor = erasing
        ? "rgba(255, 255, 255, 0.88)"
        : hexToRgba(doodleColorRef.current, 0.98);
      cursorOverlay.style.background = erasing
        ? "rgba(255, 255, 255, 0.08)"
        : doodleColorRef.current;
      cursorOverlay.style.boxShadow = erasing
        ? "0 0 0 1px rgba(0, 0, 0, 0.38), inset 0 0 0 1px rgba(255, 255, 255, 0.08)"
        : "0 0 0 1px rgba(0, 0, 0, 0.42), 0 0 0 2px rgba(255, 255, 255, 0.14)";
      cursorOverlay.style.opacity = "1";
    },
    [
      activeToolRef,
      boardContainerRef,
      cursorOverlayRef,
      doodleColorRef,
      doodleModeRef,
      doodleSizeRef,
      hostRef,
      lastPointerClientRef,
    ],
  );

  return {
    hideDoodleCursor,
    updateDoodleCursor,
  };
};
