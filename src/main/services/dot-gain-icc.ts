import { app } from "electron";
import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { decodeDataUrl, toDataUrl } from "../ipc/ipc-utils";
import { resolveLocalAssetPath } from "./canvas-asset-files";

const DOT_GAIN_20_PROFILE_FILE = "Dot_Gain_20%_Canvas.icc";
const DOT_GAIN_20_OUTPUT_MIME = "image/png";
const DOT_GAIN_20_TRANSFER_TABLE_SIZE = 256;

const dotGain20Cache = new Map<string, Promise<string | null>>();
let dotGain20TransferTablePromise: Promise<string | null> | null = null;
let dotGain20CaptureLookupTablePromise: Promise<number[] | null> | null = null;

const getDotGain20ProfilePath = () => {
  const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(basePath, "assets", DOT_GAIN_20_PROFILE_FILE);
};

const normalizeSourcePath = (source: string) => {
  return resolveLocalAssetPath(source) ?? source;
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

  // Live capture frames are unique data URLs; caching each one would grow
  // unbounded and degrade memory over long sessions.
  if (normalizedSource.startsWith("data:")) {
    return transformImageToDotGain20(normalizedSource).catch(() => null);
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

export const getDotGain20TransferTable = async () => {
  if (dotGain20TransferTablePromise) {
    return dotGain20TransferTablePromise;
  }

  dotGain20TransferTablePromise = (async () => {
    const input = Buffer.alloc(DOT_GAIN_20_TRANSFER_TABLE_SIZE * 3);
    for (let index = 0; index < DOT_GAIN_20_TRANSFER_TABLE_SIZE; index += 1) {
      input[index * 3] = index;
      input[index * 3 + 1] = index;
      input[index * 3 + 2] = index;
    }

    const { data, info } = await sharp(input, {
      raw: {
        width: DOT_GAIN_20_TRANSFER_TABLE_SIZE,
        height: 1,
        channels: 3,
      },
    })
      .withIccProfile(getDotGain20ProfilePath(), { attach: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels < 1 || data.length < DOT_GAIN_20_TRANSFER_TABLE_SIZE) {
      return null;
    }

    return Array.from(data.slice(0, DOT_GAIN_20_TRANSFER_TABLE_SIZE), (value) =>
      (value / 255).toFixed(6),
    ).join(" ");
  })().catch(() => null);

  return dotGain20TransferTablePromise;
};

const linearToSrgbByte = (value: number) => {
  const boundedValue = Math.max(0, Math.min(1, value));
  const srgb =
    boundedValue <= 0.0031308
      ? boundedValue * 12.92
      : 1.055 * Math.pow(boundedValue, 1 / 2.4) - 0.055;

  return Math.max(0, Math.min(255, Math.round(srgb * 255)));
};

export const getDotGain20CaptureLookupTable = async () => {
  if (dotGain20CaptureLookupTablePromise) {
    return dotGain20CaptureLookupTablePromise;
  }

  dotGain20CaptureLookupTablePromise = (async () => {
    const input = Buffer.alloc(DOT_GAIN_20_TRANSFER_TABLE_SIZE * 3);
    for (let index = 0; index < DOT_GAIN_20_TRANSFER_TABLE_SIZE; index += 1) {
      const srgbValue = linearToSrgbByte(index / 255);
      input[index * 3] = srgbValue;
      input[index * 3 + 1] = srgbValue;
      input[index * 3 + 2] = srgbValue;
    }

    const { data, info } = await sharp(input, {
      raw: {
        width: DOT_GAIN_20_TRANSFER_TABLE_SIZE,
        height: 1,
        channels: 3,
      },
    })
      .withIccProfile(getDotGain20ProfilePath(), { attach: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.channels < 1 || data.length < DOT_GAIN_20_TRANSFER_TABLE_SIZE) {
      return null;
    }

    return Array.from(data.slice(0, DOT_GAIN_20_TRANSFER_TABLE_SIZE));
  })().catch(() => null);

  return dotGain20CaptureLookupTablePromise;
};
