import { useEffect, useState } from "react";
import type { Project } from "@shared/types/project";
import { CaptureWindowApp } from "@renderer/app/CaptureWindowApp";
import { AppShell } from "@renderer/app/app-shell/AppShell";
import { ProjectProvider } from "@renderer/state/project-store";

export const App = () => {
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "capture") {
    return <CaptureWindowApp />;
  }

  const [initialProject, setInitialProject] = useState<Project | null>(null);

  useEffect(() => {
    window.desktopApi.project
      .create()
      .then(setInitialProject)
      .catch(() => null);
  }, []);

  if (!initialProject) {
    return <div className="booting">Loading CanvasTool...</div>;
  }

  return (
    <ProjectProvider initialProject={initialProject}>
      <AppShell />
    </ProjectProvider>
  );
};
