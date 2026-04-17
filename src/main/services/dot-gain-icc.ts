import { app } from "electron";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { decodeDataUrl, toDataUrl } from "../ipc/ipc-utils";

const DOT_GAIN_20_PROFILE_FILE = "Dot_Gain_20%_Canvas.icc";
const DOT_GAIN_20_OUTPUT_MIME = "image/png";

const dotGain20Cache = new Map<string, Promise<string | null>>();

const getDotGain20ProfilePath = () => {
  const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(basePath, "assets", DOT_GAIN_20_PROFILE_FILE);
};

const normalizeSourcePath = (source: string) => {
  if (source.startsWith("file://")) {
    return fileURLToPath(source);
  }

  return source;
};

const getSharpInput = (source: string) => {
  if (source.startsWith("data:")) {
    return decodeDataUrl(source).buffer;
  }

  return normalizeSourcePath(source);
};

const transformImageToDotGain20 = async (source: string) => {
  const output = await sharp(getSharpInput(source))
    .rotate()
    .withIccProfile(getDotGain20ProfilePath(), { attach: true })
    .png()
    .toBuffer();

  return toDataUrl(DOT_GAIN_20_OUTPUT_MIME, output);
};

export const getDotGain20ImageDataUrl = async (source: string) => {
  const normalizedSource = source.trim();
  if (!normalizedSource) {
    return null;
  }

  const cacheKey = crypto
    .createHash("sha1")
    .update(normalizedSource)
    .digest("hex");
  const cached = dotGain20Cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const transformPromise = transformImageToDotGain20(normalizedSource).catch(
    () => null,
  );
  dotGain20Cache.set(cacheKey, transformPromise);
  return transformPromise;
};
