import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SHORTCUT_BINDINGS, resolveShortcutBindings } from "@shared/shortcuts";
import {
  createCaptureSessionChannel,
  getCaptureLocationParams,
  type CaptureSessionMessage,
  type CaptureSessionState,
} from "@renderer/app/capture-session";
import { useWindowFocusState } from "@renderer/app/hooks/use-window-focus-state";
import { useWindowResize } from "@renderer/app/hooks/use-window-resize";
import { ConnectDialog } from "@renderer/features/connect/components/ConnectDialog";
import { useWindowRightDrag } from "@renderer/app/hooks/use-window-right-drag";
import type {
  CaptureQuality,
  CaptureSource,
} from "@renderer/features/connect/types";
import {
  CAPTURE_QUALITY_PROFILES,
  createDesktopCaptureConstraints,
  isWindowsDesktopCapturePlatform,
} from "@renderer/features/connect/utils";
import { useShortcuts } from "@renderer/hooks/use-shortcuts";

type PreviewCropInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const NO_PREVIEW_CROP: PreviewCropInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const WINDOWS_WINDOW_PREVIEW_CROP: PreviewCropInsets = {
  top: 5,
  right: 4,
  bottom: 5,
  left: 4,
};

const CAPTURE_WINDOW_ASPECT_SYNC_DELAY_MS = 90;
const CAPTURE_WINDOW_TOP_REVEAL_THRESHOLD = 34;
const CAPTURE_DOT_GAIN_TARGET_FPS = 12;
const CAPTURE_DOT_GAIN_FRAME_INTERVAL_MS =
  1000 / CAPTURE_DOT_GAIN_TARGET_FPS;
const CAPTURE_WINDOW_RESIZE_DIRECTIONS = [
  "s",
  "e",
  "w",
  "se",
  "sw",
] as const;

const getEffectivePreviewSize = (
  video: HTMLVideoElement,
  cropInsets: PreviewCropInsets,
) => {
  const width = Math.round(
    video.videoWidth - cropInsets.left - cropInsets.right,
  );
  const height = Math.round(
    video.videoHeight - cropInsets.top - cropInsets.bottom,
  );

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { width, height };
};

export const CaptureWindowApp = () => {
  useWindowRightDrag();
  const windowFocused = useWindowFocusState();
  const initial = useMemo(() => getCaptureLocationParams(), []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const loadSourcesRef = useRef<() => Promise<void>>(async () => undefined);
  const edgeRevealActiveRef = useRef(false);
  const sessionStateRef = useRef<CaptureSessionState>({
    sourceName: initial.sourceName,
    quality: initial.quality,
    blurEnabled: false,
    bwEnabled: false,
    dialogOpen: false,
    windowFocused,
    windowMaximized: false,
    windowAlwaysOnTop: false,
  });
  const [sourceId, setSourceId] = useState(initial.sourceId);
  const [sourceName, setSourceName] = useState(initial.sourceName);
  const [sourceKind, setSourceKind] = useState<"window" | "screen">(initial.sourceKind);
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
  const [bwFrameReady, setBwFrameReady] = useState(false);
  const [previewCropInsets, setPreviewCropInsets] =
    useState<PreviewCropInsets>(NO_PREVIEW_CROP);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [windowAlwaysOnTop, setWindowAlwaysOnTop] = useState(false);
  const [shortcutBindings, setShortcutBindings] = useState(DEFAULT_SHORTCUT_BINDINGS);
  useWindowResize(!windowMaximized);

  const toggleDotGainBlackAndWhite = useCallback(() => {
    setBwEnabled((previous) => !previous);
  }, []);

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
  loadSourcesRef.current = loadSources;

  const postSessionMessage = useCallback((message: CaptureSessionMessage) => {
    channelRef.current?.postMessage(message);
  }, []);

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
    void window.desktopApi.app
      .getSettings()
      .then((settings) => {
        setShortcutBindings(resolveShortcutBindings(settings.shortcuts));
      })
      .catch(() => {
        setShortcutBindings(DEFAULT_SHORTCUT_BINDINGS);
      });
  }, []);

  useShortcuts(
    useMemo(
      () => ({
        [shortcutBindings["tools.toggleBlur"]]: () =>
          setBlurEnabled((previous) => !previous),
        [shortcutBindings["tools.toggleBlackAndWhite"]]: () =>
          toggleDotGainBlackAndWhite(),
        [shortcutBindings["window.toggleAlwaysOnTop"]]: () =>
          void window.desktopApi.window
            .toggleAlwaysOnTop()
            .then((state) => {
              setWindowMaximized(state.isMaximized);
              setWindowAlwaysOnTop(state.isAlwaysOnTop);
            }),
        [shortcutBindings["app.quit"]]: () => void window.desktopApi.app.quit(),
        [shortcutBindings["window.closeAuxiliary"]]: () =>
          void window.desktopApi.window.close(),
      }),
      [shortcutBindings, toggleDotGainBlackAndWhite],
    ),
  );

  useEffect(() => {
    void window.desktopApi.window.setTitle({ title: `Capture - ${sourceName}` });
  }, [sourceName]);

  useEffect(() => {
    setSelectedQuality(quality);
  }, [quality]);

  useEffect(() => {
    setPreviewCropInsets(NO_PREVIEW_CROP);
  }, [quality, sourceId, sourceKind]);

  useEffect(() => {
    sessionStateRef.current = {
      sourceName,
      quality,
      blurEnabled,
      bwEnabled,
      dialogOpen,
      windowFocused,
      windowMaximized,
      windowAlwaysOnTop,
    };
  }, [
    blurEnabled,
    bwEnabled,
    dialogOpen,
    quality,
    sourceName,
    windowFocused,
    windowAlwaysOnTop,
    windowMaximized,
  ]);

  useEffect(() => {
    if (!sourceId) {
      return;
    }

    let mounted = true;
    setLoading(true);
    setErrorMessage(null);

    const startStream = async () => {
      const profile = CAPTURE_QUALITY_PROFILES[quality];
      const stream = await navigator.mediaDevices.getUserMedia(
        createDesktopCaptureConstraints(sourceId, profile),
      );

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

  useEffect(() => {
    if (bwEnabled) {
      return;
    }

    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) {
      return;
    }

    const context = previewCanvas.getContext("2d", { alpha: true });
    if (!context) {
      return;
    }

    context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    setBwFrameReady(false);
  }, [bwEnabled]);

  useEffect(() => {
    if (!bwEnabled) {
      return;
    }

    const previewCanvas = previewCanvasRef.current;
    const video = videoRef.current;
    if (!previewCanvas || !video) {
      return;
    }

    const previewContext = previewCanvas.getContext("2d", { alpha: true });
    if (!previewContext) {
      return;
    }

    setBwFrameReady(false);

    const sourceCanvas = document.createElement("canvas");
    const sourceContext = sourceCanvas.getContext("2d", { alpha: false });
    if (!sourceContext) {
      return;
    }

    const convertedFrameImage = new Image();
    convertedFrameImage.decoding = "async";

    let cancelled = false;
    let rafId = 0;
    let processing = false;
    let lastProcessedAt = 0;

    const scheduleNextFrame = () => {
      if (cancelled) {
        return;
      }

      rafId = window.requestAnimationFrame(processFrame);
    };

    const processFrame = (timestamp: number) => {
      if (cancelled) {
        return;
      }

      const activeVideo = videoRef.current;
      const activePreviewCanvas = previewCanvasRef.current;
      if (!activeVideo || !activePreviewCanvas || activeVideo.readyState < 2) {
        scheduleNextFrame();
        return;
      }

      if (processing) {
        scheduleNextFrame();
        return;
      }

      if (timestamp - lastProcessedAt < CAPTURE_DOT_GAIN_FRAME_INTERVAL_MS) {
        scheduleNextFrame();
        return;
      }

      const effectiveSize = getEffectivePreviewSize(activeVideo, previewCropInsets);
      if (!effectiveSize) {
        scheduleNextFrame();
        return;
      }

      if (
        activePreviewCanvas.width !== effectiveSize.width ||
        activePreviewCanvas.height !== effectiveSize.height
      ) {
        activePreviewCanvas.width = effectiveSize.width;
        activePreviewCanvas.height = effectiveSize.height;
      }

      if (
        sourceCanvas.width !== effectiveSize.width ||
        sourceCanvas.height !== effectiveSize.height
      ) {
        sourceCanvas.width = effectiveSize.width;
        sourceCanvas.height = effectiveSize.height;
      }

      sourceContext.drawImage(
        activeVideo,
        previewCropInsets.left,
        previewCropInsets.top,
        effectiveSize.width,
        effectiveSize.height,
        0,
        0,
        effectiveSize.width,
        effectiveSize.height,
      );

      processing = true;
      lastProcessedAt = timestamp;
      const sourceDataUrl = sourceCanvas.toDataURL("image/png");

      void window.desktopApi.import
        .convertImageToDotGain20DataUrl({ source: sourceDataUrl })
        .then(async (convertedDataUrl) => {
          if (cancelled || !convertedDataUrl) {
            return;
          }

          convertedFrameImage.src = convertedDataUrl;
          if (typeof convertedFrameImage.decode === "function") {
            await convertedFrameImage.decode();
          }

          if (cancelled) {
            return;
          }

          const drawCanvas = previewCanvasRef.current;
          if (!drawCanvas) {
            return;
          }

          const drawContext = drawCanvas.getContext("2d", { alpha: true });
          if (!drawContext) {
            return;
          }

          if (
            convertedFrameImage.complete &&
            convertedFrameImage.naturalWidth > 0 &&
            convertedFrameImage.naturalHeight > 0
          ) {
            drawContext.drawImage(
              convertedFrameImage,
              0,
              0,
              drawCanvas.width,
              drawCanvas.height,
            );

            setBwFrameReady((previous) => (previous ? previous : true));
          }
        })
        .catch(() => undefined)
        .finally(() => {
          processing = false;
          scheduleNextFrame();
        });
    };

    scheduleNextFrame();

    return () => {
      cancelled = true;
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [
    bwEnabled,
    previewCropInsets.bottom,
    previewCropInsets.left,
    previewCropInsets.right,
    previewCropInsets.top,
    quality,
    sourceId,
  ]);

  useEffect(() => {
    if (dialogOpen) {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      return;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    void video.play().catch(() => undefined);
  }, [dialogOpen]);

  useEffect(() => {
    if (
      dialogOpen ||
      !isWindowsDesktopCapturePlatform() ||
      sourceKind !== "window"
    ) {
      setPreviewCropInsets(NO_PREVIEW_CROP);
      return;
    }

    setPreviewCropInsets(WINDOWS_WINDOW_PREVIEW_CROP);
  }, [dialogOpen, quality, sourceId, sourceKind]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = event.clientY <= CAPTURE_WINDOW_TOP_REVEAL_THRESHOLD;
      if (edgeRevealActiveRef.current === active) {
        return;
      }

      edgeRevealActiveRef.current = active;
      postSessionMessage({
        type: "set-edge-active",
        active,
      });
    };

    const clearEdgeReveal = () => {
      if (!edgeRevealActiveRef.current) {
        return;
      }

      edgeRevealActiveRef.current = false;
      postSessionMessage({
        type: "set-edge-active",
        active: false,
      });
    };

    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerleave", clearEdgeReveal);
    window.addEventListener("blur", clearEdgeReveal);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerleave", clearEdgeReveal);
      window.removeEventListener("blur", clearEdgeReveal);
    };
  }, [postSessionMessage]);

  useEffect(() => {
    const channel = createCaptureSessionChannel(initial.sessionId);
    const handleMessage = (event: MessageEvent<CaptureSessionMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object") {
        return;
      }

      switch (message.type) {
        case "request-state":
          channel.postMessage({
            type: "state",
            state: sessionStateRef.current,
          });
          break;
        case "set-dialog-open":
          setDialogOpen(message.open);
          if (message.open) {
            void loadSourcesRef.current();
          }
          break;
        case "set-quality":
          setQuality(message.quality);
          break;
        case "toggle-blur":
          setBlurEnabled((previous) => !previous);
          break;
        case "toggle-bw":
          toggleDotGainBlackAndWhite();
          break;
        case "set-window-controls-state":
          setWindowMaximized(message.controls.isMaximized);
          setWindowAlwaysOnTop(message.controls.isAlwaysOnTop);
          break;
        default:
          break;
      }
    };

    channelRef.current = channel;
    channel.addEventListener("message", handleMessage);
    channel.postMessage({
      type: "state",
      state: sessionStateRef.current,
    });

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [initial.sessionId]);

  useEffect(() => {
    postSessionMessage({
      type: "state",
      state: {
        sourceName,
        quality,
        blurEnabled,
        bwEnabled,
        dialogOpen,
        windowFocused,
        windowMaximized,
        windowAlwaysOnTop,
      },
    });
  }, [
    blurEnabled,
    bwEnabled,
    dialogOpen,
    postSessionMessage,
    quality,
    sourceName,
    windowFocused,
    windowAlwaysOnTop,
    windowMaximized,
  ]);

  useEffect(() => {
    if (dialogOpen) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    let lastReportedSignature = "";
    let pendingSignature = "";
    let pendingSize: { width: number; height: number } | null = null;
    let syncTimeoutId: number | null = null;

    const flushCaptureWindowAspect = () => {
      syncTimeoutId = null;
      if (!pendingSize) {
        return;
      }

      const nextSize = pendingSize;
      const nextSignature = pendingSignature;
      pendingSize = null;
      pendingSignature = "";
      lastReportedSignature = nextSignature;
      void window.desktopApi.capture
        .updateWindowAspect({
          sourceWidth: nextSize.width,
          sourceHeight: nextSize.height,
        })
        .catch(() => undefined);
    };

    const syncCaptureWindowAspect = () => {
      const nextSize = getEffectivePreviewSize(video, previewCropInsets);
      if (!nextSize) {
        return;
      }

      const nextSignature = `${nextSize.width}x${nextSize.height}`;
      if (
        nextSignature === lastReportedSignature ||
        nextSignature === pendingSignature
      ) {
        return;
      }

      pendingSignature = nextSignature;
      pendingSize = nextSize;
      if (syncTimeoutId !== null) {
        window.clearTimeout(syncTimeoutId);
      }
      syncTimeoutId = window.setTimeout(
        flushCaptureWindowAspect,
        CAPTURE_WINDOW_ASPECT_SYNC_DELAY_MS,
      );
    };

    syncCaptureWindowAspect();
    video.addEventListener("loadedmetadata", syncCaptureWindowAspect);
    video.addEventListener("resize", syncCaptureWindowAspect);
    video.addEventListener("playing", syncCaptureWindowAspect);

    return () => {
      if (syncTimeoutId !== null) {
        window.clearTimeout(syncTimeoutId);
      }
      video.removeEventListener("loadedmetadata", syncCaptureWindowAspect);
      video.removeEventListener("resize", syncCaptureWindowAspect);
      video.removeEventListener("playing", syncCaptureWindowAspect);
    };
  }, [
    dialogOpen,
    previewCropInsets.bottom,
    previewCropInsets.left,
    previewCropInsets.right,
    previewCropInsets.top,
    sourceId,
  ]);

  const handleConfirmSource = () => {
    const nextSource = sources.find((source) => source.id === selectedSourceId);
    if (!nextSource) {
      return;
    }

    setSourceId(nextSource.id);
    setSourceName(nextSource.name);
    setSourceKind(nextSource.kind);
    setQuality(selectedQuality);
    setDialogOpen(false);
  };

  const captureFilters = [
    blurEnabled ? `blur(${blurAmount}px)` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  const videoStyle = {
    filter: captureFilters.length > 0 ? captureFilters : undefined,
    width:
      previewCropInsets.left || previewCropInsets.right
        ? `calc(100% + ${previewCropInsets.left + previewCropInsets.right}px)`
        : "100%",
    height:
      previewCropInsets.top || previewCropInsets.bottom
        ? `calc(100% + ${previewCropInsets.top + previewCropInsets.bottom}px)`
        : "100%",
    transform:
      previewCropInsets.left ||
      previewCropInsets.top ||
      previewCropInsets.right ||
      previewCropInsets.bottom
        ? `translate(-${previewCropInsets.left}px, -${previewCropInsets.top}px)`
        : "none",
    opacity: bwEnabled && bwFrameReady ? 0 : 1,
  };

  const previewCanvasStyle = {
    filter: blurEnabled ? `blur(${blurAmount}px)` : undefined,
    opacity: bwEnabled && bwFrameReady ? 1 : 0,
  };

  return (
    <div className="capture-window-shell">
      {!windowMaximized
        ? CAPTURE_WINDOW_RESIZE_DIRECTIONS.map((direction) => (
            <div
              key={direction}
              className={`capture-window-resize-handle capture-window-resize-${direction}`}
              data-window-resize={direction}
              data-window-no-drag="true"
              aria-hidden="true"
            />
          ))
        : null}
      <main className="capture-window-body">
        {dialogOpen ? (
          <div className="capture-window-picker">
            <ConnectDialog
              open={dialogOpen}
              embedded
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
        ) : (
          <div className="capture-preview-frame">
            <video
              ref={videoRef}
              className="capture-preview-video"
              muted
              playsInline
              autoPlay
              style={videoStyle}
            />
            <canvas
              ref={previewCanvasRef}
              className="capture-preview-canvas"
              style={previewCanvasStyle}
            />
            {blurEnabled ? (
              <div className="capture-preview-footer">
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
              </div>
            ) : null}

            {loading ? (
              <div className="capture-preview-message">Starting live preview…</div>
            ) : null}
            {errorMessage ? (
              <div className="capture-preview-message capture-preview-error">
                {errorMessage}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
};
