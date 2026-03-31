import { useCallback } from "react";
import type { Project } from "@shared/types/project";
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
  const saveProject = useCallback(async () => {
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
    pushToast("success", "Canvas saved.");
    return nextProject;
  }, [project, pushToast, refreshRecents, setProject]);

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
    pushToast("success", "Canvas saved to a new file.");
    return nextProject;
  }, [project, pushToast, refreshRecents, setProject]);

  const openProject = useCallback(async () => {
    const response = await window.desktopApi.project.open();
    if (!response) {
      return;
    }

    setProject(response.project);
    setSelectedItemIds([]);
    refreshRecents();
    pushToast("success", "Canvas opened.");
    return response.project;
  }, [pushToast, refreshRecents, setProject, setSelectedItemIds]);

  return {
    openProject,
    saveProject,
    saveProjectAs,
  };
};
