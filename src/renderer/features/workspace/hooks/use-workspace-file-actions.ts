import { useCallback } from "react";
import type { Project } from "@shared/types/project";
import { useI18n } from "@renderer/i18n";
import type { ToastKind } from "@renderer/features/workspace/types";

interface UseWorkspaceFileActionsOptions {
  project: Project;
  setProject: (project: Project) => void;
  refreshRecents: () => void;
  pushToast: (kind: ToastKind, message: string) => void;
  setSelectedItemIds: (itemIds: string[]) => void;
}

export const useWorkspaceFileActions = ({
  project,
  setProject,
  refreshRecents,
  pushToast,
  setSelectedItemIds,
}: UseWorkspaceFileActionsOptions) => {
  const { copy } = useI18n();
  const saveProjectAs = useCallback(async () => {
    const response = await window.desktopApi.project.saveAs({
      project,
      filePath: project.filePath,
    });

    if (!response) {
      return;
    }

    const nextProject = {
      ...project,
      filePath: response.filePath,
    };

    setProject(nextProject);
    refreshRecents();
    pushToast("success", copy.toasts.canvasSavedToNewFile);
    return nextProject;
  }, [copy.toasts.canvasSavedToNewFile, project, pushToast, refreshRecents, setProject]);

  const saveProject = useCallback(async () => {
    if (!project.filePath) {
      return saveProjectAs();
    }

    const response = await window.desktopApi.project.save({
      project,
      filePath: project.filePath,
    });

    const nextProject = {
      ...project,
      filePath: response.filePath,
    };

    setProject(nextProject);
    refreshRecents();
    pushToast("success", copy.toasts.canvasSaved);
    return nextProject;
  }, [copy.toasts.canvasSaved, project, pushToast, refreshRecents, saveProjectAs, setProject]);

  const openProject = useCallback(async () => {
    const response = await window.desktopApi.project.open();
    if (!response) {
      return;
    }

    setProject(response.project);
    setSelectedItemIds([]);
    refreshRecents();
    pushToast("success", copy.toasts.canvasOpened);
    return response.project;
  }, [copy.toasts.canvasOpened, pushToast, refreshRecents, setProject, setSelectedItemIds]);

  return {
    openProject,
    saveProject,
    saveProjectAs,
  };
};
