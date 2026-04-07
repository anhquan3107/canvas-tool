import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppWindowControlsState } from "@shared/types/ipc";
import {
  createCaptureSessionChannel,
  getCaptureLocationParams,
  type CaptureSessionMessage,
  type CaptureSessionState,
} from "@renderer/app/capture-session";
import { useWindowRightDrag } from "@renderer/app/hooks/use-window-right-drag";
import type { CaptureQuality } from "@renderer/features/connect/types";
import { CAPTURE_QUALITY_PROFILES } from "@renderer/features/connect/utils";

const CAPTURE_WINDOW_TOPBAR_HIDE_DELAY_MS = 160;

const DEFAULT_CAPTURE_SESSION_STATE: CaptureSessionState = {
  sourceName: "Capture",
  quality: "medium",
  blurEnabled: false,
  bwEnabled: false,
  dialogOpen: false,
  windowMaximized: false,
  windowAlwaysOnTop: false,
};

export const CaptureToolbarApp = () => {
  useWindowRightDrag();

  const initial = useMemo(() => getCaptureLocationParams(), []);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [sessionState, setSessionState] = useState<CaptureSessionState>({
    ...DEFAULT_CAPTURE_SESSION_STATE,
    sourceName: initial.sourceName,
    quality: initial.quality,
  });
  const [edgeRevealActive, setEdgeRevealActive] = useState(false);
  const [topbarHovered, setTopbarHovered] = useState(false);
  const [topbarVisible, setTopbarVisible] = useState(false);

  const postMessage = useCallback((message: CaptureSessionMessage) => {
    channelRef.current?.postMessage(message);
  }, []);

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

  useEffect(() => {
    if (edgeRevealActive || topbarHovered) {
      setTopbarVisible(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTopbarVisible(false);
    }, CAPTURE_WINDOW_TOPBAR_HIDE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [edgeRevealActive, topbarHovered]);

  useEffect(() => {
    void window.desktopApi.window
      .setIgnoreMouseEvents({
        ignore: !topbarVisible,
        forward: true,
      })
      .catch(() => undefined);
  }, [topbarVisible]);

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
      className={`capture-toolbar-shell ${
        topbarVisible ? "toolbar-visible" : "toolbar-hidden"
      }`}
    >
      <header
        className="capture-window-topbar"
        data-window-left-drag="true"
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
                    className={`toolbar-button ${
                      option === sessionState.quality ? "active" : ""
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
              className={`toolbar-button ${
                sessionState.blurEnabled ? "active" : ""
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
            className={`window-button ${
              sessionState.windowAlwaysOnTop ? "active" : ""
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
