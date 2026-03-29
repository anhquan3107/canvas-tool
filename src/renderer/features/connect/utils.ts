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

export const isWindowsDesktopCapturePlatform = () =>
  /win/i.test(
    (() => {
      if (typeof navigator === "undefined") {
        return "";
      }

      const navigatorWithUAData = navigator as Navigator & {
        userAgentData?: { platform?: string };
      };

      return navigatorWithUAData.userAgentData?.platform ?? navigator.platform ?? "";
    })(),
  );

export const createDesktopCaptureConstraints = (
  sourceId: string,
  profile: CaptureQualityProfile,
) => {
  const effectiveFrameRate = isWindowsDesktopCapturePlatform()
    ? Math.min(profile.frameRate, 18)
    : profile.frameRate;

  return {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxWidth: CONSISTENT_CAPTURE_STREAM_SIZE.width,
        maxHeight: CONSISTENT_CAPTURE_STREAM_SIZE.height,
        maxFrameRate: effectiveFrameRate,
      },
    } as MediaTrackConstraints,
  } as MediaStreamConstraints;
};
