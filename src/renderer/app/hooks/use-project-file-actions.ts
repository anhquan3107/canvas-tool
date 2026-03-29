import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import type { Project } from "@shared/types/project";
import { getProjectDirtySignature } from "@renderer/app/utils";

interface UseProjectFileActionsOptions {
  project: Project;
  refreshRecents: () => void;
  openProject: () => Promise<Project | undefined>;
  saveProject: () => Promise<Project | undefined>;
  saveProjectAs: () => Promise<Project | undefined>;
  retryImportEntryBase: (entryId: string) => Promise<void>;
  lastSavedSignatureRef: MutableRefObject<string>;
}

export const useProjectFileActions = ({
  project,
  refreshRecents,
  openProject,
  saveProject,
  saveProjectAs,
  retryImportEntryBase,
  lastSavedSignatureRef,
}: UseProjectFileActionsOptions) => {
  const [version, setVersion] = useState("loading");
  const [retryingEntryId, setRetryingEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (!lastSavedSignatureRef.current) {
      lastSavedSignatureRef.current = getProjectDirtySignature(project);
    }
  }, [lastSavedSignatureRef, project]);

  useEffect(() => {
    void window.desktopApi.app
      .getVersion()
      .then(setVersion)
      .catch(() => setVersion("unknown"));
    refreshRecents();
  }, [refreshRecents]);

  const retryImportEntry = useCallback(
    async (entryId: string) => {
      setRetryingEntryId(entryId);

      try {
        await retryImportEntryBase(entryId);
      } finally {
        setRetryingEntryId(null);
      }
    },
    [retryImportEntryBase],
  );

  const handleOpenProject = useCallback(async () => {
    const nextProject = await openProject();
    if (nextProject) {
      lastSavedSignatureRef.current = getProjectDirtySignature(nextProject);
    }
  }, [lastSavedSignatureRef, openProject]);

  const handleSaveProject = useCallback(async () => {
    const nextProject = await saveProject();
    if (nextProject) {
      lastSavedSignatureRef.current = getProjectDirtySignature(nextProject);
    }

    return nextProject;
  }, [lastSavedSignatureRef, saveProject]);

  const handleSaveProjectAs = useCallback(async () => {
    const nextProject = await saveProjectAs();
    if (nextProject) {
      lastSavedSignatureRef.current = getProjectDirtySignature(nextProject);
    }

    return nextProject;
  }, [lastSavedSignatureRef, saveProjectAs]);

  return {
    version,
    retryingEntryId,
    retryImportEntry,
    handleOpenProject,
    handleSaveProject,
    handleSaveProjectAs,
  };
};
