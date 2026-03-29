import { useCallback, useMemo, type MutableRefObject } from "react";
import type { ImageItem, Project, ReferenceGroup, Task } from "@shared/types/project";
import { extractImageSwatches } from "@renderer/features/import/swatches";

type ToastKind = "success" | "error" | "info";

interface UseExportActionsOptions {
  activeGroup: ReferenceGroup | undefined;
  project: Project;
  pushToast: (kind: ToastKind, message: string) => void;
  selectedItemIds: string[];
  selectedTask: Task | undefined;
  exportCanvasImageRef: MutableRefObject<(() => string | null) | null>;
}

export const useExportActions = ({
  activeGroup,
  project,
  pushToast,
  selectedItemIds,
  selectedTask,
  exportCanvasImageRef,
}: UseExportActionsOptions) => {
  const selectedImageForSwatchExport = useMemo(
    () =>
      selectedItemIds.length === 1 && activeGroup
        ? activeGroup.items.find(
            (item): item is ImageItem =>
              item.id === selectedItemIds[0] && item.type === "image",
          )
        : undefined,
    [activeGroup, selectedItemIds],
  );

  const canExportSelectedSwatch = Boolean(selectedImageForSwatchExport);

  const handleExportSelectedSwatch = useCallback(async () => {
    if (
      !selectedImageForSwatchExport ||
      selectedImageForSwatchExport.type !== "image"
    ) {
      pushToast("info", "Select one image to export swatches.");
      return;
    }

    let swatches = selectedImageForSwatchExport.swatches?.length
      ? selectedImageForSwatchExport.swatches.map((swatch) => ({
          colorHex: swatch.colorHex,
          name: swatch.label,
        }))
      : selectedImageForSwatchExport.swatchHex
        ? [
            {
              colorHex: selectedImageForSwatchExport.swatchHex,
              name: selectedImageForSwatchExport.label ?? "Swatch 1",
            },
          ]
        : [];

    if (swatches.length === 0 && selectedImageForSwatchExport.assetPath) {
      let source = selectedImageForSwatchExport.assetPath;
      if (/^https?:\/\//i.test(source)) {
        source =
          (await window.desktopApi.import.fetchRemoteImageDataUrl({
            url: source,
          })) ?? source;
      }

      const extracted = await extractImageSwatches(source);
      swatches = extracted.map((swatch) => ({
        colorHex: swatch.colorHex,
        name: swatch.label,
      }));
    }

    if (swatches.length === 0) {
      pushToast("error", "No swatches available to export for this image.");
      return;
    }

    if (typeof window.desktopApi.project.exportSwatchAco !== "function") {
      pushToast(
        "error",
        "Swatch export needs an app restart to load the new desktop API.",
      );
      return;
    }

    try {
      const result = await window.desktopApi.project.exportSwatchAco({
        swatches,
        name: selectedImageForSwatchExport.label ?? "Swatch",
      });

      if (!result) {
        return;
      }

      pushToast("success", "Swatches exported as .aco.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Swatch export failed.",
      );
    }
  }, [pushToast, selectedImageForSwatchExport]);

  const handleExportCanvasImage = useCallback(async () => {
    const dataUrl = exportCanvasImageRef.current?.() ?? null;
    if (!dataUrl) {
      pushToast("error", "Canvas export is not ready yet.");
      return;
    }

    try {
      const result = await window.desktopApi.project.exportCanvasImage({
        dataUrl,
        name: activeGroup?.name ?? project.title,
      });

      if (!result) {
        return;
      }

      pushToast("success", "Canvas exported as image.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Canvas export failed.",
      );
    }
  }, [activeGroup?.name, exportCanvasImageRef, project.title, pushToast]);

  const handleExportGroupImages = useCallback(async () => {
    if (!activeGroup) {
      pushToast("info", "No active canvas to export.");
      return;
    }

    const images = activeGroup.items.flatMap((item) =>
      item.type === "image" && item.assetPath
        ? [{ assetPath: item.assetPath, label: item.label }]
        : [],
    );

    if (images.length === 0) {
      pushToast("info", "No images in this canvas to export.");
      return;
    }

    try {
      const result = await window.desktopApi.project.exportGroupImages({
        images,
        groupName: activeGroup.name,
      });

      if (!result) {
        return;
      }

      pushToast("success", "Canvas images exported to folder.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Image export failed.",
      );
    }
  }, [activeGroup, pushToast]);

  const handleExportSelectedTaskHtml = useCallback(async () => {
    if (!selectedTask) {
      pushToast("info", "Select a task to export.");
      return;
    }

    try {
      const result = await window.desktopApi.project.exportTasksHtml({
        projectTitle: selectedTask.title,
        tasks: [selectedTask],
        name: selectedTask.title,
      });

      if (!result) {
        return;
      }

      pushToast("success", "Task exported to HTML.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Task export failed.",
      );
    }
  }, [pushToast, selectedTask]);

  const handleExportAllTasksHtml = useCallback(async () => {
    if (project.tasks.length === 0) {
      pushToast("info", "No tasks available to export.");
      return;
    }

    try {
      const result = await window.desktopApi.project.exportTasksHtml({
        projectTitle: "All Tasks",
        tasks: project.tasks,
        name: "All Tasks",
      });

      if (!result) {
        return;
      }

      pushToast("success", "All tasks exported to HTML.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Task export failed.",
      );
    }
  }, [project.tasks, pushToast]);

  return {
    canExportSelectedSwatch,
    handleExportSelectedSwatch,
    handleExportCanvasImage,
    handleExportGroupImages,
    handleExportSelectedTaskHtml,
    handleExportAllTasksHtml,
  };
};
