import { useCallback, useMemo, type MutableRefObject } from "react";
import type { TaskTransferTask } from "@shared/types/ipc";
import type { ImageItem, Project, ReferenceGroup, Task } from "@shared/types/project";
import { extractImageSwatches } from "@renderer/features/import/swatches";
import { useI18n } from "@renderer/i18n";

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
  const { copy } = useI18n();
  const exportableTasks = useMemo(() => {
    const groupNameById = new Map(project.groups.map((group) => [group.id, group.name]));
    return project.tasks.map<TaskTransferTask>((task) => ({
      ...task,
      linkedGroupName: task.linkedGroupId
        ? groupNameById.get(task.linkedGroupId)
        : undefined,
    }));
  }, [project.groups, project.tasks]);

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
      pushToast("info", copy.toasts.selectOneImageToExportSwatches);
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
              name:
                selectedImageForSwatchExport.label ??
                `${copy.menu.actions.exportSwatches} 1`,
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
      pushToast("error", copy.toasts.noSwatchesAvailable);
      return;
    }

    if (typeof window.desktopApi.project.exportSwatchAco !== "function") {
      pushToast("error", copy.toasts.swatchExportNeedsRestart);
      return;
    }

    try {
      const result = await window.desktopApi.project.exportSwatchAco({
        swatches,
        name: selectedImageForSwatchExport.label ?? copy.menu.actions.exportSwatches,
      });

      if (!result) {
        return;
      }

      pushToast("success", copy.toasts.swatchesExported);
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : copy.toasts.swatchExportFailed,
      );
    }
  }, [
    copy.menu.actions.exportSwatches,
    copy.toasts.noSwatchesAvailable,
    copy.toasts.selectOneImageToExportSwatches,
    copy.toasts.swatchExportFailed,
    copy.toasts.swatchExportNeedsRestart,
    copy.toasts.swatchesExported,
    pushToast,
    selectedImageForSwatchExport,
  ]);

  const handleExportCanvasImage = useCallback(async () => {
    const dataUrl = exportCanvasImageRef.current?.() ?? null;
    if (!dataUrl) {
      pushToast("error", copy.toasts.canvasExportNotReady);
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

      pushToast("success", copy.toasts.canvasExported);
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : copy.toasts.canvasExportFailed,
      );
    }
  }, [
    activeGroup?.name,
    copy.toasts.canvasExportFailed,
    copy.toasts.canvasExportNotReady,
    copy.toasts.canvasExported,
    exportCanvasImageRef,
    project.title,
    pushToast,
  ]);

  const handleExportGroupImages = useCallback(async () => {
    if (!activeGroup) {
      pushToast("info", copy.toasts.noActiveCanvasToExport);
      return;
    }

    const images = activeGroup.items.flatMap((item) =>
      item.type === "image" && item.assetPath
        ? [{ assetPath: item.assetPath, label: item.label }]
        : [],
    );

    if (images.length === 0) {
      pushToast("info", copy.toasts.noImagesToExport);
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

      pushToast("success", copy.toasts.canvasImagesExported);
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : copy.toasts.imageExportFailed,
      );
    }
  }, [
    activeGroup,
    copy.toasts.canvasImagesExported,
    copy.toasts.imageExportFailed,
    copy.toasts.noActiveCanvasToExport,
    copy.toasts.noImagesToExport,
    pushToast,
  ]);

  const handleExportSelectedTaskHtml = useCallback(async () => {
    if (!selectedTask) {
      pushToast("info", copy.toasts.selectTaskToExport);
      return;
    }

    const exportableTask =
      exportableTasks.find((task) => task.id === selectedTask.id) ?? {
        ...selectedTask,
      };

    try {
      const result = await window.desktopApi.project.exportTasksHtml({
        projectTitle: exportableTask.title,
        tasks: [exportableTask],
        name: exportableTask.title,
      });

      if (!result) {
        return;
      }

      pushToast("success", copy.toasts.taskExportedHtml);
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : copy.toasts.taskExportFailed,
      );
    }
  }, [
    copy.toasts.selectTaskToExport,
    copy.toasts.taskExportFailed,
    copy.toasts.taskExportedHtml,
    exportableTasks,
    pushToast,
    selectedTask,
  ]);

  const handleExportAllTasksHtml = useCallback(async () => {
    if (exportableTasks.length === 0) {
      pushToast("info", copy.toasts.noTasksToExport);
      return;
    }

    try {
      const result = await window.desktopApi.project.exportTasksHtml({
        projectTitle: copy.tasks.exportAllName,
        tasks: exportableTasks,
        name: copy.tasks.exportAllName,
      });

      if (!result) {
        return;
      }

      pushToast("success", copy.toasts.allTasksExportedHtml);
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : copy.toasts.taskExportFailed,
      );
    }
  }, [
    copy.tasks.exportAllName,
    copy.toasts.allTasksExportedHtml,
    copy.toasts.noTasksToExport,
    copy.toasts.taskExportFailed,
    exportableTasks,
    pushToast,
  ]);

  const handleExportSelectedTaskTxt = useCallback(async () => {
    if (!selectedTask) {
      pushToast("info", copy.toasts.selectTaskToExport);
      return;
    }

    const exportableTask =
      exportableTasks.find((task) => task.id === selectedTask.id) ?? {
        ...selectedTask,
      };

    try {
      const result = await window.desktopApi.project.exportTasksTxt({
        projectTitle: exportableTask.title,
        tasks: [exportableTask],
        name: exportableTask.title,
      });

      if (!result) {
        return;
      }

      pushToast("success", copy.toasts.taskExportedTxt);
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : copy.toasts.taskExportFailed,
      );
    }
  }, [
    copy.toasts.selectTaskToExport,
    copy.toasts.taskExportFailed,
    copy.toasts.taskExportedTxt,
    exportableTasks,
    pushToast,
    selectedTask,
  ]);

  const handleExportAllTasksTxt = useCallback(async () => {
    if (exportableTasks.length === 0) {
      pushToast("info", copy.toasts.noTasksToExport);
      return;
    }

    try {
      const result = await window.desktopApi.project.exportTasksTxt({
        projectTitle: copy.tasks.exportAllName,
        tasks: exportableTasks,
        name: copy.tasks.exportAllName,
      });

      if (!result) {
        return;
      }

      pushToast("success", copy.toasts.allTasksExportedTxt);
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : copy.toasts.taskExportFailed,
      );
    }
  }, [
    copy.tasks.exportAllName,
    copy.toasts.allTasksExportedTxt,
    copy.toasts.noTasksToExport,
    copy.toasts.taskExportFailed,
    exportableTasks,
    pushToast,
  ]);

  return {
    canExportSelectedSwatch,
    handleExportSelectedSwatch,
    handleExportCanvasImage,
    handleExportGroupImages,
    handleExportSelectedTaskHtml,
    handleExportAllTasksHtml,
    handleExportSelectedTaskTxt,
    handleExportAllTasksTxt,
  };
};
