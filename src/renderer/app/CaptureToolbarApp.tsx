import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppWindowControlsState } from "@shared/types/ipc";
import {
  createCaptureSessionChannel,
  getCaptureLocationParams,
  type CaptureSessionMessage,
  type CaptureSessionState,
} from "@renderer/app/capture-session";
import { useWindowResize } from "@renderer/app/hooks/use-window-resize";
import { useWindowRightDrag } from "@renderer/app/hooks/use-window-right-drag";
import type { CaptureQuality } from "@renderer/features/connect/types";
import { CAPTURE_QUALITY_PROFILES } from "@renderer/features/connect/utils";

const CAPTURE_WINDOW_TOPBAR_HIDE_TRANSITION_MS = 180;
const CAPTURE_TOOLBAR_RESIZE_DIRECTIONS = ["e", "w", "ne", "nw"] as const;

const DEFAULT_CAPTURE_SESSION_STATE: CaptureSessionState = {
  sourceName: "Capture",
  quality: "medium",
  blurEnabled: false,
  bwEnabled: false,
  dialogOpen: false,
  windowFocused: false,
  windowMaximized: false,
  windowAlwaysOnTop: false,
};

export const CaptureToolbarApp = () => {
  useWindowRightDrag({ enableLeftWindowDrag: true });

  const initial = useMemo(() => getCaptureLocationParams(), []);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const hideWindowTimeoutRef = useRef<number | null>(null);
  const focusCaptureOnReleaseRef = useRef(false);
  const [sessionState, setSessionState] = useState<CaptureSessionState>({
    ...DEFAULT_CAPTURE_SESSION_STATE,
    sourceName: initial.sourceName,
    quality: initial.quality,
  });
  const [edgeRevealActive, setEdgeRevealActive] = useState(false);
  const [topbarHovered, setTopbarHovered] = useState(false);
  const [topbarVisible, setTopbarVisible] = useState(false);
  const [topbarPointerActive, setTopbarPointerActive] = useState(false);
  const [captureWindowFocused, setCaptureWindowFocused] = useState(false);
  const customResizeEnabled = !sessionState.windowMaximized;
  useWindowResize(customResizeEnabled);

  const postMessage = useCallback((message: CaptureSessionMessage) => {
    channelRef.current?.postMessage(message);
  }, []);

  const focusCaptureWindow = useCallback(() => {
    void window.desktopApi.window.focus().catch(() => undefined);
  }, []);

  const queueCaptureFocusOnRelease = useCallback(() => {
    focusCaptureOnReleaseRef.current = true;
  }, []);

  const clearQueuedCaptureFocus = useCallback(() => {
    focusCaptureOnReleaseRef.current = false;
  }, []);

  const flushQueuedCaptureFocus = useCallback(() => {
    if (!focusCaptureOnReleaseRef.current) {
      return;
    }

    focusCaptureOnReleaseRef.current = false;
    focusCaptureWindow();
  }, [focusCaptureWindow]);

  useEffect(() => {
    const channel = createCaptureSessionChannel(initial.sessionId);
    const handleMessage = (event: MessageEvent<CaptureSessionMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object") {
        return;
      }

      if (message.type === "state") {
        setSessionState(message.state);
        return;
      }

      if (message.type === "set-edge-active") {
        setEdgeRevealActive(message.active);
      }
    };

    channelRef.current = channel;
    channel.addEventListener("message", handleMessage);
    channel.postMessage({ type: "request-state" } satisfies CaptureSessionMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [initial.sessionId]);

  useEffect(
    () => window.desktopApi.capture.onWindowFocusChanged(setCaptureWindowFocused),
    [],
  );

  const effectiveWindowFocused =
    captureWindowFocused || sessionState.windowFocused;

  useEffect(() => {
    if (
      effectiveWindowFocused ||
      edgeRevealActive ||
      topbarHovered ||
      topbarPointerActive
    ) {
      setTopbarVisible(true);
      return;
    }
    setTopbarVisible(false);
  }, [
    effectiveWindowFocused,
    edgeRevealActive,
    topbarHovered,
    topbarPointerActive,
  ]);

  useEffect(() => {
    if (effectiveWindowFocused || edgeRevealActive || topbarPointerActive) {
      return;
    }

    setTopbarHovered(false);
  }, [edgeRevealActive, effectiveWindowFocused, topbarPointerActive]);

  useEffect(() => {
    const clearHoverState = () => {
      setTopbarHovered(false);
      setTopbarPointerActive(false);
      clearQueuedCaptureFocus();
    };

    window.addEventListener("blur", clearHoverState);
    document.addEventListener("visibilitychange", clearHoverState);

    return () => {
      window.removeEventListener("blur", clearHoverState);
      document.removeEventListener("visibilitychange", clearHoverState);
    };
  }, [clearQueuedCaptureFocus]);

  useEffect(() => {
    const handlePointerFinish = () => {
      setTopbarPointerActive(false);
      flushQueuedCaptureFocus();
    };

    const handleWindowBlur = () => {
      setTopbarPointerActive(false);
      clearQueuedCaptureFocus();
    };

    window.addEventListener("pointerup", handlePointerFinish);
    window.addEventListener("pointercancel", handlePointerFinish);
    window.addEventListener("mouseup", handlePointerFinish);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointerup", handlePointerFinish);
      window.removeEventListener("pointercancel", handlePointerFinish);
      window.removeEventListener("mouseup", handlePointerFinish);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [clearQueuedCaptureFocus, flushQueuedCaptureFocus]);

  useEffect(() => {
    if (hideWindowTimeoutRef.current !== null) {
      window.clearTimeout(hideWindowTimeoutRef.current);
      hideWindowTimeoutRef.current = null;
    }

    if (topbarVisible) {
      void window.desktopApi.capture
        .setToolbarVisibility({
          visible: true,
        })
        .catch(() => undefined);
      void window.desktopApi.window
        .setIgnoreMouseEvents({
          ignore: false,
          forward: true,
        })
        .catch(() => undefined);
      return;
    }

    hideWindowTimeoutRef.current = window.setTimeout(() => {
      hideWindowTimeoutRef.current = null;
      void window.desktopApi.window
        .setIgnoreMouseEvents({
          ignore: true,
          forward: true,
        })
        .catch(() => undefined);
      void window.desktopApi.capture
        .setToolbarVisibility({
          visible: false,
        })
        .catch(() => undefined);
    }, CAPTURE_WINDOW_TOPBAR_HIDE_TRANSITION_MS);

    return () => {
      if (hideWindowTimeoutRef.current !== null) {
        window.clearTimeout(hideWindowTimeoutRef.current);
        hideWindowTimeoutRef.current = null;
      }
    };
  }, [topbarVisible]);

  useEffect(
    () => () => {
      if (hideWindowTimeoutRef.current !== null) {
        window.clearTimeout(hideWindowTimeoutRef.current);
      }
    },
    [],
  );

  const syncWindowControlsState = (controls: AppWindowControlsState) => {
    setSessionState((previous) => ({
      ...previous,
      windowAlwaysOnTop: controls.isAlwaysOnTop,
      windowMaximized: controls.isMaximized,
    }));
    postMessage({
      type: "set-window-controls-state",
      controls,
    });
  };

  const setQuality = (quality: CaptureQuality) => {
    postMessage({
      type: "set-quality",
      quality,
    });
    setSessionState((previous) => ({
      ...previous,
      quality,
    }));
  };

  return (
    <div
      className={`capture-toolbar-shell ${topbarVisible ? "toolbar-visible" : "toolbar-hidden"
        }`}
    >
      {customResizeEnabled
        ? CAPTURE_TOOLBAR_RESIZE_DIRECTIONS.map((direction) => (
          <div
            key={direction}
            className={`capture-window-resize-handle capture-window-resize-${direction}`}
            data-window-resize={direction}
            data-window-no-drag="true"
            onPointerDown={(event) => {
              if (event.button !== 0) {
                clearQueuedCaptureFocus();
                return;
              }

              setTopbarPointerActive(true);
              queueCaptureFocusOnRelease();
            }}
            aria-hidden="true"
          />
        ))
        : null}
      <header
        className="capture-window-topbar"
        data-window-left-drag="true"
        onPointerDown={(event) => {
          if (event.button !== 0) {
            setTopbarPointerActive(false);
            clearQueuedCaptureFocus();
            return;
          }

          setTopbarPointerActive(true);
          const target = event.target;
          if (!(target instanceof HTMLElement)) {
            queueCaptureFocusOnRelease();
            return;
          }

          if (target.closest("[data-window-no-drag='true']")) {
            clearQueuedCaptureFocus();
            return;
          }

          queueCaptureFocusOnRelease();
        }}
        onPointerEnter={() => setTopbarHovered(true)}
        onPointerLeave={() => setTopbarHovered(false)}
      >
        <div className="capture-window-drag-region" data-window-left-drag="true">
          <div className="capture-window-toolbar" data-window-no-drag="true">
            <button
              type="button"
              className="toolbar-button"
              onClick={() =>
                postMessage({
                  type: "set-dialog-open",
                  open: true,
                })
              }
            >
              Capture
            </button>

            <div className="capture-quality-switch">
              {(Object.keys(CAPTURE_QUALITY_PROFILES) as CaptureQuality[]).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    className={`toolbar-button ${option === sessionState.quality ? "active" : ""
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
              className={`toolbar-button ${sessionState.blurEnabled ? "active" : ""
                }`}
              onClick={() => postMessage({ type: "toggle-blur" })}
              title="Blur"
            >
              Blur
            </button>
            <button
              type="button"
              className={`toolbar-button ${sessionState.bwEnabled ? "active" : ""}`}
              onClick={() => postMessage({ type: "toggle-bw" })}
              title="B&W"
            >
              B&amp;W
            </button>
          </div>
          <div className="capture-window-drag-spacer" />
        </div>

        <div className="window-cluster" data-window-no-drag="true">
          <button
            type="button"
            className={`window-button ${sessionState.windowAlwaysOnTop ? "active" : ""
              }`}
            onClick={() =>
              void window.desktopApi.window
                .toggleAlwaysOnTop()
                .then(syncWindowControlsState)
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
                .then(syncWindowControlsState)
            }
          >
            {sessionState.windowMaximized ? "❐" : "□"}
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
    </div>
  );
};
