import { useCallback, useState } from "react";
import type { ReferenceGroup } from "@shared/types/project";
import { TOOL_LABELS } from "@renderer/features/tools/constants";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";

interface UseToolFeatureOptions {
  activeGroup: ReferenceGroup | undefined;
  setGroupFilters: (
    groupId: string,
    filters: { blur?: number; grayscale?: number },
  ) => void;
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
  onConnectRequested: () => void;
}

export const useToolFeature = ({
  activeGroup,
  setGroupFilters,
  pushToast,
  onConnectRequested,
}: UseToolFeatureOptions) => {
  const [activeTool, setActiveTool] = useState<ToolMode | null>(null);
  const [doodleMode, setDoodleMode] = useState<DoodleMode>("brush");
  const [doodleColor, setDoodleColor] = useState("#f38ba8");
  const [brushSize, setBrushSize] = useState(18);
  const [eraserSize, setEraserSize] = useState(24);

  const handleToolButton = useCallback(
    (tool: ToolMode) => {
      if (tool === "blur") {
        setActiveTool((previous) => (previous === tool ? null : tool));
        return;
      }

      if (tool === "bw") {
        if (!activeGroup) {
          return;
        }

        setGroupFilters(activeGroup.id, {
          grayscale: activeGroup.filters.grayscale > 0 ? 0 : 100,
        });
        setActiveTool((previous) => (previous === "bw" ? null : previous));
        return;
      }

      if (tool === "connect") {
        setActiveTool(null);
        onConnectRequested();
        return;
      }

      if (tool === "doodle") {
        setActiveTool((previous) => (previous === tool ? null : tool));
        return;
      }

      setActiveTool((previous) => (previous === tool ? null : tool));
      pushToast("info", `${TOOL_LABELS[tool]} is not wired yet in this MVP.`);
    },
    [activeGroup, onConnectRequested, pushToast, setGroupFilters],
  );

  const toggleBlur = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    setGroupFilters(activeGroup.id, {
      blur: activeGroup.filters.blur > 0 ? 0 : 8,
    });
  }, [activeGroup, setGroupFilters]);

  const toggleBlackAndWhite = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    setGroupFilters(activeGroup.id, {
      grayscale: activeGroup.filters.grayscale > 0 ? 0 : 100,
    });
  }, [activeGroup, setGroupFilters]);

  return {
    activeTool,
    showColorWheel: activeTool === "doodle",
    doodleMode,
    doodleColor,
    brushSize,
    eraserSize,
    setActiveTool,
    setDoodleMode,
    setDoodleColor,
    setBrushSize,
    setEraserSize,
    handleToolButton,
    toggleBlur,
    toggleBlackAndWhite,
  };
};
