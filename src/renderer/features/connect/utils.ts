import type { CaptureQuality, CaptureQualityProfile } from "./types";

export const CAPTURE_QUALITY_PROFILES: Record<
  CaptureQuality,
  CaptureQualityProfile
> = {
  low: {
    label: "Low",
    width: 960,
    height: 540,
    frameRate: 8,
    refreshMs: 160,
  },
  medium: {
    label: "Medium",
    width: 1280,
    height: 720,
    frameRate: 14,
    refreshMs: 96,
  },
  high: {
    label: "High",
    width: 1920,
    height: 1080,
    frameRate: 24,
    refreshMs: 48,
  },
};
