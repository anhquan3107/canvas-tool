import type { CaptureQuality, CaptureQualityProfile } from "./types";

export const CONSISTENT_CAPTURE_STREAM_SIZE = {
  width: 1600,
  height: 900,
} as const;

export const CAPTURE_QUALITY_PROFILES: Record<
  CaptureQuality,
  CaptureQualityProfile
> = {
  low: {
    label: "Low",
    width: CONSISTENT_CAPTURE_STREAM_SIZE.width,
    height: CONSISTENT_CAPTURE_STREAM_SIZE.height,
    frameRate: 8,
    refreshMs: 160,
  },
  medium: {
    label: "Medium",
    width: CONSISTENT_CAPTURE_STREAM_SIZE.width,
    height: CONSISTENT_CAPTURE_STREAM_SIZE.height,
    frameRate: 14,
    refreshMs: 96,
  },
  high: {
    label: "High",
    width: CONSISTENT_CAPTURE_STREAM_SIZE.width,
    height: CONSISTENT_CAPTURE_STREAM_SIZE.height,
    frameRate: 24,
    refreshMs: 48,
  },
};
