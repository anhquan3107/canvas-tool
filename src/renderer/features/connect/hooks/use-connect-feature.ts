import { useCallback, useEffect, useState } from "react";
import type { CaptureItem } from "@shared/types/project";
import type { CaptureSource, CaptureQuality } from "@renderer/features/connect/types";

interface UseConnectFeatureOptions {
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
  onConnect: (source: CaptureSource, quality: CaptureQuality) => void | Promise<void>;
  qualityProfiles: Record<
    CaptureQuality,
    { label: string; refreshMs: number }
  >;
}

export const useConnectFeature = ({
  pushToast,
  onConnect,
  qualityProfiles,
}: UseConnectFeatureOptions) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [quality, setQuality] = useState<CaptureItem["quality"]>("medium");

  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    setLoadingSources(true);
    void window.desktopApi.capture
      .listSources()
      .then((nextSources) => {
        setSources(nextSources);
        setSelectedSourceId((previous) => {
          if (previous && nextSources.some((source) => source.id === previous)) {
            return previous;
          }
          return nextSources[0]?.id ?? null;
        });
      })
      .catch(() => {
        setSources([]);
        setSelectedSourceId(null);
        pushToast("error", "Could not list capturable windows.");
      })
      .finally(() => setLoadingSources(false));
  }, [dialogOpen, pushToast]);

  const handleConfirm = useCallback(() => {
    const source = sources.find((entry) => entry.id === selectedSourceId);
    if (!source) {
      pushToast("info", "Select a window or screen to connect.");
      return;
    }

    void Promise.resolve(onConnect(source, quality))
      .then(() => {
        setDialogOpen(false);
        pushToast(
          "success",
          `Connected ${source.name} (${qualityProfiles[quality].label}).`,
        );
      })
      .catch(() => {
        pushToast("error", "Could not open capture window.");
      });
  }, [onConnect, pushToast, quality, qualityProfiles, selectedSourceId, sources]);

  return {
    dialogOpen,
    loadingSources,
    sources,
    selectedSourceId,
    quality,
    setDialogOpen,
    setSelectedSourceId,
    setQuality,
    openDialog,
    handleConfirm,
  };
};
