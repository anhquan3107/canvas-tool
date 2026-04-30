import { useMemo } from "react";
import {
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_VIEW_ZOOM_BASELINE,
} from "@shared/project-defaults";
import type { ImageItem, Project, Task } from "@shared/types/project";
import { getProjectDirtySignature } from "@renderer/app/utils";

interface UseAppDerivedStateOptions {
  project: Project;
  selectedItemIds: string[];
  selectedTask: Task | null;
  backgroundColorPreview: {
    canvasColor: string;
    backgroundColor: string;
  } | null;
  canvasSizePreview: { width: number; height: number } | null;
  lastSavedSignature: string;
}

export const useAppDerivedState = ({
  project,
  selectedItemIds,
  selectedTask,
  backgroundColorPreview,
  canvasSizePreview,
  lastSavedSignature,
}: UseAppDerivedStateOptions) => {
  const activeGroup = useMemo(
    () =>
      project.groups.find((group) => group.id === project.activeGroupId) ??
      project.groups[0],
    [project.activeGroupId, project.groups],
  );

  const savedGroups = useMemo(
    () => project.groups.filter((group) => group.kind === "group"),
    [project.groups],
  );

  const canDeleteActiveGroup = activeGroup?.kind === "group";

  const linkedSelectedTaskGroupName = useMemo(() => {
    if (!selectedTask?.linkedGroupId) {
      return null;
    }

    return (
      project.groups.find((group) => group.id === selectedTask.linkedGroupId)?.name ??
      null
    );
  }, [project.groups, selectedTask]);

  const dirtySignature = useMemo(
    () => getProjectDirtySignature(project),
    [project],
  );

  const hasUnsavedChanges =
    lastSavedSignature !== "" && dirtySignature !== lastSavedSignature;

  const activeGroupId = activeGroup?.id ?? null;

  const displayGroup = useMemo(() => {
    if (!activeGroup || !backgroundColorPreview) {
      return activeGroup;
    }

    return {
      ...activeGroup,
      canvasColor: backgroundColorPreview.canvasColor,
      backgroundColor: backgroundColorPreview.backgroundColor,
    };
  }, [activeGroup, backgroundColorPreview]);

  const zoomLabel = activeGroup
    ? `${Math.round((activeGroup.zoom / DEFAULT_VIEW_ZOOM_BASELINE) * 100)}%`
    : "0%";

  const selectedStatusImage = useMemo(() => {
    if (!activeGroup || selectedItemIds.length !== 1) {
      return null;
    }

    const selectedItem = activeGroup.items.find(
      (item) => item.id === selectedItemIds[0],
    );

    if (!selectedItem || selectedItem.type !== "image") {
      return null;
    }

    return selectedItem as ImageItem;
  }, [activeGroup, selectedItemIds]);

  const canvasLabel = canvasSizePreview
    ? `${canvasSizePreview.width} x ${canvasSizePreview.height}`
    : activeGroup
      ? `${activeGroup.canvasSize.width} x ${activeGroup.canvasSize.height}`
      : "0 x 0";

  const projectFileName =
    project.filePath?.split(/[\\/]/).at(-1) ?? "Untitled.canvas";

  const zoomOverlayFilter = activeGroup
    ? `blur(${activeGroup.filters.blur}px) grayscale(${activeGroup.filters.grayscale}%)`
    : undefined;

  const appShellBackgroundColor =
    displayGroup?.backgroundColor ?? DEFAULT_GROUP_BACKGROUND_COLOR;

  return {
    activeGroup,
    activeGroupId,
    appShellBackgroundColor,
    canDeleteActiveGroup,
    canvasLabel,
    dirtySignature,
    displayGroup,
    hasUnsavedChanges,
    linkedSelectedTaskGroupName,
    projectFileName,
    savedGroups,
    selectedStatusImage,
    zoomLabel,
    zoomOverlayFilter,
  };
};
