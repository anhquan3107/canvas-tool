import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AppWindowControlsState } from "@shared/types/ipc";
import {
  createCaptureSessionChannel,
  getCaptureLocationParams,
  type CaptureSessionMessage,
  type CaptureSessionState,
} from "@renderer/app/capture-session";
import { useWindowResize } from "@renderer/app/hooks/use-window-resize";
import { useWindowRightDrag } from "@renderer/app/hooks/use-window-right-drag";
import { useI18n } from "@renderer/i18n";
import type { CaptureQuality } from "@renderer/features/connect/types";
import { CAPTURE_QUALITY_PROFILES } from "@renderer/features/connect/utils";

const CAPTURE_WINDOW_TOPBAR_HIDE_TRANSITION_MS = 250;
const CAPTURE_TOOLBAR_RESIZE_DIRECTIONS = ["e", "w", "ne", "nw"] as const;
const DOUBLE_CLICK_TOGGLE_SUPPRESS_MS = 250;

const DEFAULT_CAPTURE_SESSION_STATE: CaptureSessionState = {
  sourceName: "",
  quality: "medium",
  blurEnabled: false,
  bwEnabled: false,
  dialogOpen: false,
  windowFocused: false,
  windowMaximized: false,
  windowAlwaysOnTop: false,
};

export const CaptureToolbarApp = () => useCaptureToolbarApp();

const useCaptureToolbarApp = () => {
  const { copy } = useI18n();

  const initial = useMemo(() => getCaptureLocationParams(), []);
  useWindowRightDrag({ enableLeftWindowDrag: true, mode: "renderer" });
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastPointerDoubleClickToggleRef = useRef(0);

  useLayoutEffect(() => {
    const root = document.getElementById("root");
    Object.assign(document.body.style, { background: "transparent" });
    Object.assign(document.documentElement.style, { background: "transparent" });
    if (root) {
      Object.assign(root.style, { background: "transparent" });
    }
    return () => {
      Object.assign(document.body.style, { background: "" });
      Object.assign(document.documentElement.style, { background: "" });
      if (root) {
        Object.assign(root.style, { background: "" });
      }
    };
  }, []);
  const hideWindowTimeoutRef = useRef<number | null>(null);
  const focusCaptureOnReleaseRef = useRef(false);
  const edgeRevealActiveRef = useRef(false);
  const topbarHoveredRef = useRef(false);
  const topbarPointerActiveRef = useRef(false);
  const captureWindowFocusedRef = useRef(false);
  const sessionWindowFocusedRef = useRef(DEFAULT_CAPTURE_SESSION_STATE.windowFocused);
  const [sessionState, setSessionState] = useState<CaptureSessionState>({
    ...DEFAULT_CAPTURE_SESSION_STATE,
    sourceName: initial.sourceName || copy.capture.title,
    quality: initial.quality,
  });
  const [topbarVisible, setTopbarVisible] = useState(false);
  const customResizeEnabled = !sessionState.windowMaximized;
  useWindowResize(customResizeEnabled, { lockAspectRatio: true });

  const syncTopbarVisibility = useCallback(() => {
    const focused =
      captureWindowFocusedRef.current || sessionWindowFocusedRef.current;
    if (
      !focused &&
      !edgeRevealActiveRef.current &&
      !topbarPointerActiveRef.current
    ) {
      topbarHoveredRef.current = false;
    }

    setTopbarVisible(
      focused ||
        edgeRevealActiveRef.current ||
        topbarHoveredRef.current ||
        topbarPointerActiveRef.current,
    );
  }, []);

  const setEdgeRevealActive = useCallback(
    (active: boolean) => {
      edgeRevealActiveRef.current = active;
      syncTopbarVisibility();
    },
    [syncTopbarVisibility],
  );

  const setTopbarHovered = useCallback(
    (hovered: boolean) => {
      topbarHoveredRef.current = hovered;
      syncTopbarVisibility();
    },
    [syncTopbarVisibility],
  );

  const setTopbarPointerActive = useCallback(
    (active: boolean) => {
      topbarPointerActiveRef.current = active;
      syncTopbarVisibility();
    },
    [syncTopbarVisibility],
  );

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

  const clearHoverStateEvent = useEffectEvent(() => {
    setTopbarHovered(false);
    setTopbarPointerActive(false);
    clearQueuedCaptureFocus();
  });

  const finishPointerEvent = useEffectEvent(() => {
    setTopbarPointerActive(false);
    flushQueuedCaptureFocus();
  });

  const clearPointerOnBlurEvent = useEffectEvent(() => {
    setTopbarPointerActive(false);
    clearQueuedCaptureFocus();
  });

  useEffect(() => {
    const channel = createCaptureSessionChannel(initial.sessionId);
    const handleMessage = (event: MessageEvent<CaptureSessionMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object") {
        return;
      }

      if (message.type === "state") {
        sessionWindowFocusedRef.current = message.state.windowFocused;
        setSessionState(message.state);
        syncTopbarVisibility();
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
  }, [initial.sessionId, setEdgeRevealActive, syncTopbarVisibility]);

  useEffect(
    () =>
      window.desktopApi.capture.onWindowFocusChanged((focused) => {
        captureWindowFocusedRef.current = focused;
        syncTopbarVisibility();
      }),
    [syncTopbarVisibility],
  );

  useEffect(() => {
    const clearHoverState = () => {
      clearHoverStateEvent();
    };

    window.addEventListener("blur", clearHoverState);
    document.addEventListener("visibilitychange", clearHoverState);

    return () => {
      window.removeEventListener("blur", clearHoverState);
      document.removeEventListener("visibilitychange", clearHoverState);
    };
  }, []);

  useEffect(() => {
    const handlePointerFinish = () => {
      finishPointerEvent();
    };

    const handleWindowBlur = () => {
      clearPointerOnBlurEvent();
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
  }, []);

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

  const syncWindowControlsState = useCallback((controls: AppWindowControlsState) => {
    setSessionState((previous) => ({
      ...previous,
      windowAlwaysOnTop: controls.isAlwaysOnTop,
      windowMaximized: controls.isMaximized,
    }));
    postMessage({
      type: "set-window-controls-state",
      controls,
    });
  }, [postMessage]);

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

  const toggleMaximize = useCallback(() => {
    void window.desktopApi.window.toggleMaximize().then(syncWindowControlsState);
  }, [syncWindowControlsState]);

  const toggleMaximizeFromPointerDoubleClick = useCallback(() => {
    lastPointerDoubleClickToggleRef.current = performance.now();
    toggleMaximize();
  }, [toggleMaximize]);

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        clearQueuedCaptureFocus();
        return;
      }

      setTopbarPointerActive(true);
      queueCaptureFocusOnRelease();
    },
    [clearQueuedCaptureFocus, queueCaptureFocusOnRelease, setTopbarPointerActive],
  );

  const handleTopbarPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        setTopbarPointerActive(false);
        clearQueuedCaptureFocus();
        return;
      }

      setTopbarPointerActive(true);
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        if (event.detail === 2) {
          event.preventDefault();
          toggleMaximizeFromPointerDoubleClick();
          return;
        }

        queueCaptureFocusOnRelease();
        return;
      }

      if (target.closest("[data-window-no-drag='true']")) {
        clearQueuedCaptureFocus();
        return;
      }

      if (event.detail === 2) {
        event.preventDefault();
        toggleMaximizeFromPointerDoubleClick();
        return;
      }

      queueCaptureFocusOnRelease();
    },
    [
      clearQueuedCaptureFocus,
      queueCaptureFocusOnRelease,
      setTopbarPointerActive,
      toggleMaximizeFromPointerDoubleClick,
    ],
  );

  const handleTopbarDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (
        performance.now() - lastPointerDoubleClickToggleRef.current <
        DOUBLE_CLICK_TOGGLE_SUPPRESS_MS
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("[data-window-no-drag='true']")
      ) {
        return;
      }

      toggleMaximize();
    },
    [toggleMaximize],
  );

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
            onPointerDown={handleResizePointerDown}
            aria-hidden="true"
          />
        ))
        : null}
      <header
        className="capture-window-topbar"
        data-window-left-drag="true"
        onPointerDown={handleTopbarPointerDown}
        onDoubleClick={handleTopbarDoubleClick}
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
              {copy.capture.openPicker}
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
                    {copy.capture.quality[option]}
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              className={`toolbar-button ${sessionState.blurEnabled ? "active" : ""
                }`}
              onClick={() => postMessage({ type: "toggle-blur" })}
              title={copy.capture.blur}
            >
              {copy.capture.blur}
            </button>
            <button
              type="button"
              className={`toolbar-button ${sessionState.bwEnabled ? "active" : ""}`}
              onClick={() => postMessage({ type: "toggle-bw" })}
              title={copy.capture.bw}
            >
              {copy.capture.bw}
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
            title={copy.capture.alwaysOnTop}
            aria-label={copy.capture.toggleAlwaysOnTop}
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
            onClick={toggleMaximize}
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
