import { useCallback, useRef } from "react";
import { Texture } from "pixi.js";
import type { CaptureItem } from "@shared/types/project";
import {
  CAPTURE_QUALITY_PROFILES,
  createDesktopCaptureConstraints,
} from "@renderer/features/connect/utils";
import type { CaptureSession } from "@renderer/pixi/types";

export const useCaptureSessions = () => {
  const captureSessionByIdRef = useRef(new Map<string, CaptureSession>());

  const stopCaptureSession = useCallback((captureId: string) => {
    const session = captureSessionByIdRef.current.get(captureId);
    if (!session) {
      return;
    }

    captureSessionByIdRef.current.delete(captureId);
    session.stream.getTracks().forEach((track) => track.stop());
    session.texture.destroy(true);
    session.video.pause();
    session.video.srcObject = null;
  }, []);

  const ensureCaptureSession = useCallback(
    async (item: CaptureItem) => {
      const existing = captureSessionByIdRef.current.get(item.id);
      if (
        existing &&
        existing.sourceId === item.sourceId &&
        existing.quality === item.quality
      ) {
        return existing;
      }

      if (existing) {
        stopCaptureSession(item.id);
      }

      const profile = CAPTURE_QUALITY_PROFILES[item.quality];
      const stream = await navigator.mediaDevices.getUserMedia(
        createDesktopCaptureConstraints(item.sourceId, profile),
      );

      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      const texture = Texture.from(video);
      const session: CaptureSession = {
        sourceId: item.sourceId,
        quality: item.quality,
        stream,
        video,
        texture,
      };
      captureSessionByIdRef.current.set(item.id, session);
      return session;
    },
    [stopCaptureSession],
  );

  return {
    captureSessionByIdRef,
    stopCaptureSession,
    ensureCaptureSession,
  };
};
