import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@shared/types/project";

interface UseWindowControlsOptions {
  hasUnsavedChanges: boolean;
  projectFilePath?: Project["filePath"];
  handleSaveProject: () => Promise<Project | undefined>;
  handleSaveProjectAs: () => Promise<Project | undefined>;
}

export const useWindowControls = ({
  hasUnsavedChanges,
  projectFilePath,
  handleSaveProject,
  handleSaveProjectAs,
}: UseWindowControlsOptions) => {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [windowAlwaysOnTop, setWindowAlwaysOnTop] = useState(false);
  const allowWindowCloseRef = useRef(false);

  useEffect(() => {
    void window.desktopApi.window
      .getControlsState()
      .then((state) => {
        setWindowMaximized(state.isMaximized);
        setWindowAlwaysOnTop(state.isAlwaysOnTop);
      })
      .catch(() => {
        setWindowMaximized(false);
        setWindowAlwaysOnTop(false);
      });
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowWindowCloseRef.current || !hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = false;
      setConfirmCloseOpen(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleMinimizeWindow = useCallback(() => {
    void window.desktopApi.window.minimize();
  }, []);

  const handleToggleAlwaysOnTop = useCallback(() => {
    void window.desktopApi.window
      .toggleAlwaysOnTop()
      .then((state) => {
        setWindowMaximized(state.isMaximized);
        setWindowAlwaysOnTop(state.isAlwaysOnTop);
      })
      .catch(() => null);
  }, []);

  const handleToggleMaximize = useCallback(() => {
    void window.desktopApi.window
      .toggleMaximize()
      .then((state) => {
        setWindowMaximized(state.isMaximized);
        setWindowAlwaysOnTop(state.isAlwaysOnTop);
      })
      .catch(() => null);
  }, []);

  const handleDiscardAndClose = useCallback(() => {
    setConfirmCloseOpen(false);
    allowWindowCloseRef.current = true;
    void window.desktopApi.app.quit();
  }, []);

  const handleSaveAndClose = useCallback(async () => {
    const nextProject = projectFilePath
      ? await handleSaveProject()
      : await handleSaveProjectAs();

    if (!nextProject) {
      return;
    }

    setConfirmCloseOpen(false);
    allowWindowCloseRef.current = true;
    void window.desktopApi.app.quit();
  }, [handleSaveProject, handleSaveProjectAs, projectFilePath]);

  const handleCloseWindow = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmCloseOpen(true);
      return;
    }

    allowWindowCloseRef.current = true;
    void window.desktopApi.app.quit();
  }, [hasUnsavedChanges]);

  return {
    confirmCloseOpen,
    setConfirmCloseOpen,
    windowMaximized,
    windowAlwaysOnTop,
    allowWindowCloseRef,
    handleMinimizeWindow,
    handleToggleAlwaysOnTop,
    handleToggleMaximize,
    handleDiscardAndClose,
    handleSaveAndClose,
    handleCloseWindow,
  };
};
