import { useEffect, useState } from "react";
import type { AppLocale, Project } from "@shared/types/project";
import { CaptureToolbarApp } from "@renderer/app/CaptureToolbarApp";
import { CaptureWindowApp } from "@renderer/app/CaptureWindowApp";
import { AppShell } from "@renderer/app/app-shell/AppShell";
import { I18nProvider, useI18n } from "@renderer/i18n";
import { DotGain20FilterDefs } from "@renderer/features/tools/components/DotGain20FilterDefs";
import { ProjectProvider } from "@renderer/state/project-store";

const BootScreen = () => {
  const { copy } = useI18n();

  return <div className="booting">{copy.app.booting}</div>;
};

export const App = () => {
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "capture-toolbar") {
    return (
      <I18nProvider>
        <>
          <DotGain20FilterDefs />
          <CaptureToolbarApp />
        </>
      </I18nProvider>
    );
  }

  if (mode === "capture") {
    return (
      <I18nProvider>
        <>
          <DotGain20FilterDefs />
          <CaptureWindowApp />
        </>
      </I18nProvider>
    );
  }

  const [initialProject, setInitialProject] = useState<Project | null>(null);
  const [initialLocale, setInitialLocale] = useState<AppLocale>("en");

  useEffect(() => {
    Promise.all([
      window.desktopApi.project.create(),
      window.desktopApi.app.getSettings(),
    ])
      .then(([project, settings]) => {
        setInitialLocale(settings.locale === "vi" ? "vi" : "en");
        setInitialProject(project);
      })
      .catch(async () => {
        try {
          const project = await window.desktopApi.project.create();
          setInitialProject(project);
        } catch {
          return null;
        }
        return null;
      });
  }, []);

  if (!initialProject) {
    return (
      <I18nProvider initialLocale={initialLocale}>
        <>
          <DotGain20FilterDefs />
          <BootScreen />
        </>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider initialLocale={initialLocale}>
      <>
        <DotGain20FilterDefs />
        <ProjectProvider initialProject={initialProject}>
          <AppShell />
        </ProjectProvider>
      </>
    </I18nProvider>
  );
};
