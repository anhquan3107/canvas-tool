import { useCallback, useEffect, useRef, useState } from "react";
import type { ReferenceGroup } from "@shared/types/project";
import { useI18n } from "@renderer/i18n";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";
import { warmDotGain20TextureAssetPath } from "@renderer/pixi/utils/textures";

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
  const { copy } = useI18n();
  const [activeTool, setActiveTool] = useState<ToolMode | null>(null);
  const [doodleMode, setDoodleMode] = useState<DoodleMode>("brush");
  const [doodleColor, setDoodleColor] = useState("#f38ba8");
  const [brushSize, setBrushSize] = useState(18);
  const [eraserSize, setEraserSize] = useState(24);
  const lastBlurByGroupRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (!activeGroup || activeGroup.filters.blur <= 0) {
      return;
    }

    lastBlurByGroupRef.current.set(activeGroup.id, activeGroup.filters.blur);
  }, [activeGroup]);

  const getRememberedBlurAmount = useCallback((groupId: string) => {
    const remembered = lastBlurByGroupRef.current.get(groupId);
    return typeof remembered === "number" && remembered > 0 ? remembered : 8;
  }, []);

  const prewarmBlackAndWhiteAssets = useCallback(async () => {
    if (!activeGroup) {
      return;
    }

    const assetPaths = [
      ...new Set(
        activeGroup.items.flatMap((item) =>
          item.type === "image" && item.assetPath ? [item.assetPath] : [],
        ),
      ),
    ];
    if (assetPaths.length === 0) {
      return;
    }

    await Promise.all(
      assetPaths.map((assetPath) => warmDotGain20TextureAssetPath(assetPath)),
    );
  }, [activeGroup]);

  const toggleBlackAndWhiteInternal = useCallback(async () => {
    if (!activeGroup) {
      return;
    }

    const enabling = activeGroup.filters.grayscale <= 0;
    if (enabling) {
      await prewarmBlackAndWhiteAssets();
    }

    setGroupFilters(activeGroup.id, {
      grayscale: enabling ? 100 : 0,
    });
  }, [activeGroup, prewarmBlackAndWhiteAssets, setGroupFilters]);

  const handleToolButton = useCallback(
    async (tool: ToolMode) => {
      if (tool === "blur") {
        if (!activeGroup) {
          return;
        }

        if (activeTool === "blur") {
          setActiveTool(null);
          return;
        }

        if (activeGroup.filters.blur <= 0) {
          setGroupFilters(activeGroup.id, {
            blur: getRememberedBlurAmount(activeGroup.id),
          });
        }

        setActiveTool("blur");
        return;
      }

      if (tool === "bw") {
        await toggleBlackAndWhiteInternal();
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
      pushToast("info", copy.tools.notReady(copy.tools.labels[tool]));
    },
    [
      activeGroup,
      activeTool,
      copy.tools,
      getRememberedBlurAmount,
      onConnectRequested,
      pushToast,
      setGroupFilters,
      toggleBlackAndWhiteInternal,
    ],
  );

  const toggleBlur = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    if (activeTool === "blur") {
      if (activeGroup.filters.blur > 0) {
        setGroupFilters(activeGroup.id, {
          blur: 0,
        });
      }
      setActiveTool(null);
      return;
    }

    const nextBlur =
      activeGroup.filters.blur > 0
        ? 0
        : getRememberedBlurAmount(activeGroup.id);
    setGroupFilters(activeGroup.id, {
      blur: nextBlur,
    });
    setActiveTool((previous) => {
      if (nextBlur > 0) {
        return "blur";
      }

      return previous === "blur" ? null : previous;
    });
  }, [activeGroup, activeTool, getRememberedBlurAmount, setGroupFilters]);

  const toggleBlackAndWhite = useCallback(() => {
    void toggleBlackAndWhiteInternal();
  }, [toggleBlackAndWhiteInternal]);

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
