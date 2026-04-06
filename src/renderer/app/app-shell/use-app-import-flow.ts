import { useCallback, type DragEvent, type RefObject } from "react";
import { collectDropPayload } from "@renderer/features/import/image-import";

interface DropViewportPoint {
  x: number;
  y: number;
}

interface UseAppImportFlowOptions {
  canvasStageRef: RefObject<HTMLDivElement | null>;
  importFromPayload: (
    payload: ReturnType<typeof collectDropPayload>,
    options?: { dropViewportPoint?: DropViewportPoint },
  ) => Promise<unknown> | void;
}

export const useAppImportFlow = ({
  canvasStageRef,
  importFromPayload,
}: UseAppImportFlowOptions) => {
  const handleAppShellDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const payload = collectDropPayload(event.nativeEvent);
      const stageRect = canvasStageRef.current?.getBoundingClientRect();
      const dropViewportPoint = stageRect
        ? {
            x: event.clientX - stageRect.left,
            y: event.clientY - stageRect.top,
          }
        : undefined;

      void importFromPayload(payload, { dropViewportPoint });
    },
    [canvasStageRef, importFromPayload],
  );

  return {
    handleAppShellDrop,
  };
};
