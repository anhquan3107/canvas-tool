import { useCallback, useEffect, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastState {
  kind: ToastKind;
  message: string;
}

export const useToast = (dismissMs = 2200) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  const pushToast = useCallback(
    (kind: ToastKind, message: string) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      setToast({ kind, message });
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, dismissMs);
    },
    [dismissMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    toast,
    pushToast,
  };
};
