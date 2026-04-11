import { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "success" | "error" | "info";

export interface ToastState {
  kind: ToastKind;
  message: string;
  progress?: number;
}

export interface ProgressToastController {
  update: (progress: number, message?: string) => void;
  complete: (kind: ToastKind, message: string) => void;
  clear: () => void;
}

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const useToast = (dismissMs = 2200) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const activeToastIdRef = useRef(0);

  const clearDismissTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const pushToast = useCallback(
    (kind: ToastKind, message: string) => {
      activeToastIdRef.current += 1;
      clearDismissTimer();
      clearProgressTimer();

      setToast({ kind, message });
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, dismissMs);
    },
    [clearDismissTimer, clearProgressTimer, dismissMs],
  );

  const beginProgressToast = useCallback(
    (label: string, initialProgress = 8): ProgressToastController => {
      activeToastIdRef.current += 1;
      const toastId = activeToastIdRef.current;
      clearDismissTimer();
      clearProgressTimer();

      let latestProgress = clampProgress(initialProgress);
      let latestLabel = label;

      const syncToast = (progress: number, message?: string) => {
        if (activeToastIdRef.current !== toastId) {
          return;
        }

        latestProgress = clampProgress(progress);
        const nextMessage = message ?? `${latestLabel} ${latestProgress}%`;
        setToast({
          kind: "info",
          message: nextMessage,
          progress: latestProgress,
        });
      };

      syncToast(latestProgress);
      progressTimerRef.current = window.setInterval(() => {
        if (activeToastIdRef.current !== toastId) {
          clearProgressTimer();
          return;
        }

        const step =
          latestProgress < 40 ? 7 : latestProgress < 70 ? 4 : latestProgress < 88 ? 2 : 1;
        syncToast(Math.min(94, latestProgress + step));
      }, 220);

      return {
        update: (progress, message) => {
          if (typeof message === "string" && message.trim().length > 0) {
            latestLabel = message.trim().replace(/\s+\d+%$/, "");
          }
          syncToast(progress, message);
        },
        complete: (kind, message) => {
          if (activeToastIdRef.current !== toastId) {
            return;
          }

          clearProgressTimer();
          pushToast(kind, message);
        },
        clear: () => {
          if (activeToastIdRef.current !== toastId) {
            return;
          }

          activeToastIdRef.current += 1;
          clearDismissTimer();
          clearProgressTimer();
          setToast(null);
        },
      };
    },
    [clearDismissTimer, clearProgressTimer, pushToast],
  );

  useEffect(() => {
    return () => {
      clearDismissTimer();
      clearProgressTimer();
    };
  }, [clearDismissTimer, clearProgressTimer]);

  return {
    toast,
    pushToast,
    beginProgressToast,
  };
};
