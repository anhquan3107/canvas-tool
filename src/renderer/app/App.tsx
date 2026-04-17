import { useEffect, useState } from "react";
import type { Project } from "@shared/types/project";
import { CaptureToolbarApp } from "@renderer/app/CaptureToolbarApp";
import { CaptureWindowApp } from "@renderer/app/CaptureWindowApp";
import { AppShell } from "@renderer/app/app-shell/AppShell";
import { DotGain20FilterDefs } from "@renderer/features/tools/components/DotGain20FilterDefs";
import { ProjectProvider } from "@renderer/state/project-store";

export const App = () => {
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "capture-toolbar") {
    return (
      <>
        <DotGain20FilterDefs />
        <CaptureToolbarApp />
      </>
    );
  }

  if (mode === "capture") {
    return (
      <>
        <DotGain20FilterDefs />
        <CaptureWindowApp />
      </>
    );
  }

  const [initialProject, setInitialProject] = useState<Project | null>(null);

  useEffect(() => {
    window.desktopApi.project
      .create()
      .then(setInitialProject)
      .catch(() => null);
  }, []);

  if (!initialProject) {
    return (
      <>
        <DotGain20FilterDefs />
        <div className="booting">Loading CanvasTool...</div>
      </>
    );
  }

  return (
    <>
      <DotGain20FilterDefs />
      <ProjectProvider initialProject={initialProject}>
        <AppShell />
      </ProjectProvider>
    </>
  );
};
