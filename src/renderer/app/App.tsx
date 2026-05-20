import { useEffect, useState } from "react";
import type { AppLocale, Project } from "@shared/types/project";
import { CaptureToolbarApp } from "@renderer/app/CaptureToolbarApp";
import { CaptureWindowApp } from "@renderer/app/CaptureWindowApp";
import { AppShell } from "@renderer/app/app-shell/AppShell";
import type {
  DoodleEraserMode,
  DoodleMode,
} from "@renderer/features/tools/types";
import { I18nProvider, useI18n } from "@renderer/i18n";
import { DotGain20FilterDefs } from "@renderer/features/tools/components/DotGain20FilterDefs";
import { ProjectProvider } from "@renderer/state/project-store";

const BootScreen = () => {
  const { copy } = useI18n();

  return <div className="booting">{copy.app.booting}</div>;
};

interface AppBootState {
  project: Project | null;
  locale: AppLocale;
  windowOpacity: number;
  doodleMode: DoodleMode;
  doodleEraserMode: DoodleEraserMode;
}

const DEFAULT_BOOT_STATE: AppBootState = {
  project: null,
  locale: "en",
  windowOpacity: 1,
  doodleMode: "brush",
  doodleEraserMode: "erase-line",
};

const MainApp = () => {
  const [bootState, setBootState] = useState<AppBootState>(DEFAULT_BOOT_STATE);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      window.desktopApi.project.create(),
      window.desktopApi.app.getSettings(),
    ])
      .then(([project, settings]) => {
        if (cancelled) {
          return;
        }

        setBootState({
          project,
          locale: settings.locale === "vi" ? "vi" : "en",
          windowOpacity: settings.windowOpacity ?? 1,
          doodleMode: "brush",
          doodleEraserMode: "erase-line",
        });
      })
      .catch(async () => {
        try {
          const project = await window.desktopApi.project.create();
          if (!cancelled) {
            setBootState((currentBootState) => ({
              ...currentBootState,
              project,
            }));
          }
        } catch {
          return null;
        }
        return null;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!bootState.project) {
    return (
      <I18nProvider key={bootState.locale} initialLocale={bootState.locale}>
        <>
          <DotGain20FilterDefs />
          <BootScreen />
        </>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider key={bootState.locale} initialLocale={bootState.locale}>
      <>
        <DotGain20FilterDefs />
        <ProjectProvider initialProject={bootState.project}>
          <AppShell
            initialWindowOpacity={bootState.windowOpacity}
            initialDoodleMode={bootState.doodleMode}
            initialDoodleEraserMode={bootState.doodleEraserMode}
          />
        </ProjectProvider>
      </>
    </I18nProvider>
  );
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

  return <MainApp />;
};
