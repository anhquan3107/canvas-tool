import { useCallback, useEffect, useMemo, useState } from "react";
import type { ImageItem, ReferenceGroup } from "@shared/types/project";
import type { RulerGridSettings, ToolMode } from "@renderer/features/tools/types";

const DEFAULT_RULER_SETTINGS: RulerGridSettings = {
  horizontalLines: 10,
  verticalLines: 10,
  gridColor: "#d24b43",
};

const DEFAULT_SLIDESHOW_SECONDS = 3;

interface UseZoomOverlayOptions {
  activeGroup: ReferenceGroup | undefined;
  selectedItemIds: string[];
  setActiveTool: (value: ToolMode | null | ((previous: ToolMode | null) => ToolMode | null)) => void;
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
}

export const useZoomOverlay = ({
  activeGroup,
  selectedItemIds,
  setActiveTool,
  pushToast,
}: UseZoomOverlayOptions) => {
  const [zoomOverlayItemId, setZoomOverlayItemId] = useState<string | null>(null);
  const [rulerEnabled, setRulerEnabled] = useState(false);
  const [rulerDialogOpen, setRulerDialogOpen] = useState(false);
  const [rulerSettings, setRulerSettings] =
    useState<RulerGridSettings>(DEFAULT_RULER_SETTINGS);
  const [draftRulerSettings, setDraftRulerSettings] =
    useState<RulerGridSettings>(DEFAULT_RULER_SETTINGS);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);
  const [slideshowSeconds, setSlideshowSeconds] = useState(
    DEFAULT_SLIDESHOW_SECONDS,
  );

  const zoomOverlayItems = useMemo(
    () =>
      (activeGroup?.items ?? [])
        .filter(
          (item): item is ImageItem =>
            item.type === "image" &&
            item.visible &&
            Boolean(item.assetPath) &&
            item.width > 1 &&
            item.height > 1,
        )
        .sort((left, right) => left.zIndex - right.zIndex),
    [activeGroup],
  );

  const zoomOverlayIndex = useMemo(
    () =>
      zoomOverlayItemId
        ? zoomOverlayItems.findIndex((item) => item.id === zoomOverlayItemId)
        : -1,
    [zoomOverlayItemId, zoomOverlayItems],
  );

  const zoomOverlayImage =
    zoomOverlayIndex >= 0 ? zoomOverlayItems[zoomOverlayIndex] : null;
  const zoomOverlayOpen = Boolean(zoomOverlayImage);

  const closeZoomOverlay = useCallback(() => {
    setZoomOverlayItemId(null);
    setRulerEnabled(false);
    setRulerDialogOpen(false);
    setSlideshowPlaying(false);
    setActiveTool((previous) => (previous === "ruler" ? null : previous));
  }, [setActiveTool]);

  const openZoomOverlay = useCallback(
    (itemId: string, options?: { enableRuler?: boolean }) => {
      const nextImage = zoomOverlayItems.find((item) => item.id === itemId);
      if (!nextImage) {
        return false;
      }

      setZoomOverlayItemId(itemId);
      setSlideshowPlaying(false);

      if (options?.enableRuler) {
        setRulerEnabled(true);
        setRulerDialogOpen(true);
        setDraftRulerSettings(rulerSettings);
        setActiveTool("ruler");
      } else {
        setRulerEnabled(false);
        setRulerDialogOpen(false);
        setActiveTool((previous) => (previous === "ruler" ? null : previous));
      }

      return true;
    },
    [setActiveTool, zoomOverlayItems],
  );

  const selectNextZoomImage = useCallback(() => {
    if (zoomOverlayItems.length === 0) {
      return;
    }

    setZoomOverlayItemId((previous) => {
      const currentIndex = previous
        ? zoomOverlayItems.findIndex((item) => item.id === previous)
        : -1;
      const nextIndex =
        currentIndex >= 0
          ? (currentIndex + 1) % zoomOverlayItems.length
          : 0;
      return zoomOverlayItems[nextIndex]?.id ?? null;
    });
  }, [zoomOverlayItems]);

  const selectPreviousZoomImage = useCallback(() => {
    if (zoomOverlayItems.length === 0) {
      return;
    }

    setZoomOverlayItemId((previous) => {
      const currentIndex = previous
        ? zoomOverlayItems.findIndex((item) => item.id === previous)
        : -1;
      const nextIndex =
        currentIndex >= 0
          ? (currentIndex - 1 + zoomOverlayItems.length) % zoomOverlayItems.length
          : zoomOverlayItems.length - 1;
      return zoomOverlayItems[nextIndex]?.id ?? null;
    });
  }, [zoomOverlayItems]);

  const handleRulerTool = useCallback(() => {
    if (zoomOverlayOpen && rulerEnabled) {
      setRulerEnabled(false);
      setRulerDialogOpen(false);
      setSlideshowPlaying(false);
      setActiveTool((previous) => (previous === "ruler" ? null : previous));
      return;
    }

    if (zoomOverlayOpen && zoomOverlayImage) {
      setRulerEnabled(true);
      setRulerDialogOpen(true);
      setDraftRulerSettings(rulerSettings);
      setSlideshowPlaying(false);
      setActiveTool("ruler");
      return;
    }

    const selectedImage = zoomOverlayItems.find((item) =>
      selectedItemIds.includes(item.id),
    );

    if (!selectedImage) {
      pushToast("info", "Select one image to open Ruler.");
      return;
    }

    setZoomOverlayItemId(selectedImage.id);
    setRulerEnabled(true);
    setRulerDialogOpen(true);
    setDraftRulerSettings(rulerSettings);
    setSlideshowPlaying(false);
    setActiveTool("ruler");
  }, [
    pushToast,
    rulerEnabled,
    selectedItemIds,
    setActiveTool,
    zoomOverlayImage,
    zoomOverlayItems,
    zoomOverlayOpen,
  ]);

  const applyRulerSettings = useCallback((nextSettings: RulerGridSettings) => {
    setRulerSettings(nextSettings);
    setDraftRulerSettings(nextSettings);
    setRulerDialogOpen(false);
  }, []);

  const cancelRuler = useCallback(() => {
    setDraftRulerSettings(rulerSettings);
    setRulerDialogOpen(false);
    setRulerEnabled(false);
    setActiveTool((previous) => (previous === "ruler" ? null : previous));
  }, [rulerSettings, setActiveTool]);

  useEffect(() => {
    if (!zoomOverlayOpen || rulerEnabled || !slideshowPlaying) {
      return;
    }

    if (zoomOverlayItems.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      selectNextZoomImage();
    }, slideshowSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [
    rulerEnabled,
    selectNextZoomImage,
    slideshowPlaying,
    slideshowSeconds,
    zoomOverlayItems.length,
    zoomOverlayOpen,
  ]);

  useEffect(() => {
    if (!zoomOverlayItemId) {
      return;
    }

    if (zoomOverlayItems.some((item) => item.id === zoomOverlayItemId)) {
      return;
    }

    closeZoomOverlay();
  }, [closeZoomOverlay, zoomOverlayItemId, zoomOverlayItems]);

  useEffect(() => {
    if (!zoomOverlayOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeZoomOverlay();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        selectNextZoomImage();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        selectPreviousZoomImage();
        return;
      }

      if (!rulerEnabled && event.code === "Space") {
        event.preventDefault();
        setSlideshowPlaying((previous) => !previous);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeZoomOverlay,
    rulerEnabled,
    selectNextZoomImage,
    selectPreviousZoomImage,
    zoomOverlayOpen,
  ]);

  return {
    zoomOverlayOpen,
    zoomOverlayItems,
    zoomOverlayItemId,
    zoomOverlayImage,
    rulerEnabled,
    rulerDialogOpen,
    rulerSettings,
    draftRulerSettings,
    slideshowPlaying,
    slideshowSeconds,
    openZoomOverlay,
    closeZoomOverlay,
    handleRulerTool,
    selectNextZoomImage,
    selectPreviousZoomImage,
    setZoomOverlayItemId,
    setRulerEnabled,
    setDraftRulerSettings,
    applyRulerSettings,
    cancelRuler,
    setSlideshowPlaying,
    setSlideshowSeconds,
  };
};
