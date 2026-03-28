import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectDialog } from "@renderer/features/connect/components/ConnectDialog";
import type {
  CaptureQuality,
  CaptureSource,
} from "@renderer/features/connect/types";
import { CAPTURE_QUALITY_PROFILES } from "@renderer/features/connect/utils";

const getInitialParams = () => {
  const params = new URLSearchParams(window.location.search);
  const qualityParam = params.get("quality");
  const quality: CaptureQuality =
    qualityParam === "low" || qualityParam === "high" ? qualityParam : "medium";

  return {
    sourceId: params.get("sourceId") ?? "",
    sourceName: params.get("sourceName") ?? "Capture",
    quality,
  };
};

export const CaptureWindowApp = () => {
  const initial = useMemo(() => getInitialParams(), []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [sourceId, setSourceId] = useState(initial.sourceId);
  const [sourceName, setSourceName] = useState(initial.sourceName);
  const [quality, setQuality] = useState<CaptureQuality>(initial.quality);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<CaptureQuality>(quality);
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [blurAmount, setBlurAmount] = useState(8);
  const [bwEnabled, setBwEnabled] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [windowAlwaysOnTop, setWindowAlwaysOnTop] = useState(false);

  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const nextSources = await window.desktopApi.capture.listSources();
      setSources(nextSources);
      setSelectedSourceId((previous) => {
        if (previous && nextSources.some((source) => source.id === previous)) {
          return previous;
        }
        return nextSources.find((source) => source.id === sourceId)?.id ?? nextSources[0]?.id ?? null;
      });
    } finally {
      setLoadingSources(false);
    }
  }, [sourceId]);

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
    void window.desktopApi.window.setTitle({ title: `Capture - ${sourceName}` });
  }, [sourceName]);

  useEffect(() => {
    setSelectedQuality(quality);
  }, [quality]);

  useEffect(() => {
    if (!sourceId) {
      return;
    }

    let mounted = true;
    setLoading(true);
    setErrorMessage(null);

    const startStream = async () => {
      const profile = CAPTURE_QUALITY_PROFILES[quality];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
            minWidth: 640,
            maxWidth: profile.width,
            minHeight: 360,
            maxHeight: profile.height,
            minFrameRate: profile.frameRate,
            maxFrameRate: profile.frameRate,
          },
        } as MediaTrackConstraints,
      } as MediaStreamConstraints);

      if (!mounted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      setLoading(false);
    };

    void startStream().catch((error) => {
      if (!mounted) {
        return;
      }

      setLoading(false);
      setErrorMessage(
        error instanceof Error &&
          error.message.toLowerCase().includes("permission")
          ? "Screen recording permission is required for this capture."
          : "Could not start capture preview.",
      );
    });

    return () => {
      mounted = false;
    };
  }, [quality, sourceId]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  const handleConfirmSource = () => {
    const nextSource = sources.find((source) => source.id === selectedSourceId);
    if (!nextSource) {
      return;
    }

    setSourceId(nextSource.id);
    setSourceName(nextSource.name);
    setQuality(selectedQuality);
    setDialogOpen(false);
  };

  const filterStyle = {
    filter: `blur(${blurEnabled ? blurAmount : 0}px) grayscale(${bwEnabled ? 100 : 0}%)`,
  };

  return (
    <div className="capture-window-shell">
      <header className="capture-window-topbar">
        <div className="capture-window-drag-region">
          <strong className="capture-window-title">{sourceName}</strong>
          <div className="capture-window-toolbar">
            <button
              type="button"
              className="toolbar-button"
              onClick={() => {
                setDialogOpen(true);
                void loadSources();
              }}
            >
              Capture
            </button>

            <div className="capture-quality-switch">
              {(Object.keys(CAPTURE_QUALITY_PROFILES) as CaptureQuality[]).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    className={`toolbar-button ${
                      option === quality ? "active" : ""
                    }`}
                    onClick={() => setQuality(option)}
                  >
                    {CAPTURE_QUALITY_PROFILES[option].label}
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              className={`toolbar-button ${blurEnabled ? "active" : ""}`}
              onClick={() => setBlurEnabled((previous) => !previous)}
            >
              Blur
            </button>
            {blurEnabled ? (
              <label className="capture-blur-control">
                <span>Blur</span>
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={blurAmount}
                  onChange={(event) =>
                    setBlurAmount(Number(event.target.value))
                  }
                />
                <strong>{blurAmount}</strong>
              </label>
            ) : null}
            <button
              type="button"
              className={`toolbar-button ${bwEnabled ? "active" : ""}`}
              onClick={() => setBwEnabled((previous) => !previous)}
            >
              B&amp;W
            </button>
          </div>
        </div>

        <div className="window-cluster">
          <button
            type="button"
            className={`window-button ${windowAlwaysOnTop ? "active" : ""}`}
            onClick={() =>
              void window.desktopApi.window
                .toggleAlwaysOnTop()
                .then((state) => {
                  setWindowMaximized(state.isMaximized);
                  setWindowAlwaysOnTop(state.isAlwaysOnTop);
                })
            }
            title="Always on top"
            aria-label="Toggle always on top"
          >
            ⇪
          </button>
          <button
            type="button"
            className="window-button"
            onClick={() => void window.desktopApi.window.minimize()}
          >
            -
          </button>
          <button
            type="button"
            className="window-button"
            onClick={() =>
              void window.desktopApi.window
                .toggleMaximize()
                .then((state) => {
                  setWindowMaximized(state.isMaximized);
                  setWindowAlwaysOnTop(state.isAlwaysOnTop);
                })
            }
          >
            {windowMaximized ? "❐" : "□"}
          </button>
          <button
            type="button"
            className="window-button close"
            onClick={() => void window.desktopApi.window.close()}
          >
            ×
          </button>
        </div>
      </header>

      <main className="capture-window-body">
        <div className="capture-preview-frame">
          <video
            ref={videoRef}
            className="capture-preview-video"
            muted
            playsInline
            autoPlay
            style={filterStyle}
          />

          {loading ? (
            <div className="capture-preview-message">Starting live preview…</div>
          ) : null}
          {errorMessage ? (
            <div className="capture-preview-message capture-preview-error">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </main>

      <ConnectDialog
        open={dialogOpen}
        loading={loadingSources}
        sources={sources}
        selectedSourceId={selectedSourceId}
        quality={selectedQuality}
        onClose={() => setDialogOpen(false)}
        onSelectSource={setSelectedSourceId}
        onQualityChange={setSelectedQuality}
        onConfirm={handleConfirmSource}
      />
    </div>
  );
};
