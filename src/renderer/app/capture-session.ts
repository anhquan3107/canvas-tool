import type { AppWindowControlsState } from "@shared/types/ipc";
import type { CaptureQuality } from "@renderer/features/connect/types";

export interface CaptureLocationParams {
  sessionId: string;
  sourceId: string;
  sourceName: string;
  sourceKind: "window" | "screen";
  quality: CaptureQuality;
}

export interface CaptureSessionState {
  sourceName: string;
  quality: CaptureQuality;
  blurEnabled: boolean;
  bwEnabled: boolean;
  dialogOpen: boolean;
  windowMaximized: boolean;
  windowAlwaysOnTop: boolean;
}

export type CaptureSessionMessage =
  | { type: "request-state" }
  | { type: "state"; state: CaptureSessionState }
  | { type: "set-dialog-open"; open: boolean }
  | { type: "set-quality"; quality: CaptureQuality }
  | { type: "toggle-blur" }
  | { type: "toggle-bw" }
  | { type: "set-edge-active"; active: boolean }
  | {
      type: "set-window-controls-state";
      controls: AppWindowControlsState;
    };

export const getCaptureLocationParams = (): CaptureLocationParams => {
  const params = new URLSearchParams(window.location.search);
  const qualityParam = params.get("quality");
  const quality: CaptureQuality =
    qualityParam === "low" || qualityParam === "high" ? qualityParam : "medium";
  const sourceKindParam = params.get("sourceKind");
  const sourceKind: "window" | "screen" =
    sourceKindParam === "screen" || sourceKindParam === "window"
      ? sourceKindParam
      : "window";

  return {
    sessionId: params.get("sessionId") ?? "default",
    sourceId: params.get("sourceId") ?? "",
    sourceName: params.get("sourceName") ?? "Capture",
    sourceKind,
    quality,
  };
};

export const createCaptureSessionChannel = (sessionId: string) =>
  new BroadcastChannel(`canvas-tool-capture-session:${sessionId}`);
