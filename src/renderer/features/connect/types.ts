import type { DesktopCaptureSource } from "@shared/types/ipc";
import type { CaptureItem } from "@shared/types/project";

export type CaptureSource = DesktopCaptureSource;
export type CaptureQuality = CaptureItem["quality"];

export interface CaptureQualityProfile {
  label: string;
  width: number;
  height: number;
  frameRate: number;
  refreshMs: number;
}
