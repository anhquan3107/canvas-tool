import { Texture } from "pixi.js";
import type { ImageItem } from "@shared/types/project";

interface TextureCacheEntry {
  promise: Promise<Texture>;
  sourceAssetPath: string;
  byteSize: number;
  lastUsedAt: number;
}

const boardTextureCache = new Map<string, TextureCacheEntry>();
const boardTextureVariantCache = new Map<string, Promise<string>>();
const activeBoardTextureAssetPaths = new Set<string>();
const IS_WINDOWS =
  typeof navigator !== "undefined" &&
  /windows/i.test(navigator.userAgent);
const navigatorWithDeviceMemory =
  typeof navigator !== "undefined"
    ? (navigator as Navigator & { deviceMemory?: number })
    : undefined;
const DEVICE_MEMORY_GB =
  typeof navigatorWithDeviceMemory?.deviceMemory === "number"
    ? navigatorWithDeviceMemory.deviceMemory
    : 8;
const MAX_TEXTURE_CACHE_ENTRIES = IS_WINDOWS ? 48 : 64;
const MAX_TEXTURE_CACHE_BYTES =
  DEVICE_MEMORY_GB <= 4
    ? 160 * 1024 * 1024
    : IS_WINDOWS
      ? 256 * 1024 * 1024
      : 384 * 1024 * 1024;
const MAX_PARALLEL_TEXTURE_DECODES = Math.max(
  2,
  Math.min(
    IS_WINDOWS ? 3 : 6,
    Math.floor(
      ((typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 8) /
        2,
    ),
  ),
);
let activeTextureDecodeCount = 0;
let textureCacheSequence = 0;
const pendingTextureDecodeTasks: Array<() => void> = [];

export const configureBoardTextureQuality = (
  texture: Texture,
  options?: { dynamic?: boolean },
) => {
  const source = texture.source;

  source.scaleMode = "linear";
  source.minFilter = "linear";
  source.magFilter = "linear";
  source.mipmapFilter = "linear";
  source.maxAnisotropy = 2;
  source.autoGenerateMipmaps = false;

  return texture;
};

interface LoadTextureOptions {
  preferHighResolution?: boolean;
  dotGain20?: boolean;
}

const resolveTextureAssetPath = async (
  assetPath: string,
  options?: LoadTextureOptions,
) => {
  if (!options?.dotGain20) {
    return assetPath;
  }

  const cacheKey = `${assetPath}::dot-gain-20`;
  const cachedVariant = boardTextureVariantCache.get(cacheKey);
  if (cachedVariant) {
    return cachedVariant;
  }

  const variantPromise = window.desktopApi.import
    .convertImageToDotGain20DataUrl({ source: assetPath })
    .then((transformedAssetPath) => transformedAssetPath ?? assetPath)
    .catch(() => assetPath);
  boardTextureVariantCache.set(cacheKey, variantPromise);
  return variantPromise;
};

export const warmDotGain20TextureAssetPath = async (assetPath: string) =>
  resolveTextureAssetPath(assetPath, { dotGain20: true });

export const getBoardRenderAssetPath = (
  item: Pick<ImageItem, "assetPath" | "previewAssetPath">,
  options?: { preferHighResolution?: boolean },
) =>
  options?.preferHighResolution
    ? item.assetPath ?? item.previewAssetPath
    : item.previewAssetPath ?? item.assetPath;

const scheduleTextureDecode = <T>(task: () => Promise<T>) =>
  new Promise<T>((resolve, reject) => {
    const runTask = () => {
      activeTextureDecodeCount += 1;

      void task()
        .then(resolve, reject)
        .finally(() => {
          activeTextureDecodeCount = Math.max(0, activeTextureDecodeCount - 1);
          const nextTask = pendingTextureDecodeTasks.shift();
          nextTask?.();
        });
    };

    if (activeTextureDecodeCount < MAX_PARALLEL_TEXTURE_DECODES) {
      runTask();
      return;
    }

    pendingTextureDecodeTasks.push(runTask);
  });

const estimateTextureBytes = (texture: Texture) => {
  const width = Math.max(1, Math.ceil(texture.width || 1));
  const height = Math.max(1, Math.ceil(texture.height || 1));
  return width * height * 4;
};

const destroyTexturePromise = (promise: Promise<Texture>) => {
  void promise
    .then((texture) => {
      texture.destroy(true);
    })
    .catch(() => undefined);
};

const touchCacheEntry = (cacheKey: string, entry: TextureCacheEntry) => {
  entry.lastUsedAt = ++textureCacheSequence;
  boardTextureCache.delete(cacheKey);
  boardTextureCache.set(cacheKey, entry);
};

const getTextureCacheBytes = () => {
  let total = 0;
  boardTextureCache.forEach((entry) => {
    total += entry.byteSize;
  });
  return total;
};

const enforceTextureCacheLimits = () => {
  let totalBytes = getTextureCacheBytes();

  for (const [cacheKey, entry] of boardTextureCache) {
    const overEntryLimit = boardTextureCache.size > MAX_TEXTURE_CACHE_ENTRIES;
    const overByteLimit = totalBytes > MAX_TEXTURE_CACHE_BYTES;
    if (!overEntryLimit && !overByteLimit) {
      break;
    }

    if (activeBoardTextureAssetPaths.has(entry.sourceAssetPath)) {
      continue;
    }

    boardTextureCache.delete(cacheKey);
    totalBytes -= entry.byteSize;
    destroyTexturePromise(entry.promise);
  }
};

const textureFromBlob = async (blob: Blob) => {
  if (typeof createImageBitmap !== "function") {
    return null;
  }

  const bitmap = await createImageBitmap(blob);
  return configureBoardTextureQuality(Texture.from(bitmap));
};

const loadTextureDirectly = async (assetPath: string) =>
  scheduleTextureDecode(
    async () => {
      try {
        const response = await fetch(assetPath);
        if (response.ok) {
          const bitmapTexture = await textureFromBlob(await response.blob());
          if (bitmapTexture) {
            return bitmapTexture;
          }
        }
      } catch {
        // Fall back to DOM image decoding below for protocols fetch cannot read.
      }

      return new Promise<Texture>((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          image.onload = null;
          image.onerror = null;
          resolve(configureBoardTextureQuality(Texture.from(image)));
        };
        image.onerror = () => {
          image.onload = null;
          image.onerror = null;
          reject(new Error(`Failed to decode texture for ${assetPath}`));
        };
        image.src = assetPath;
      });
    },
  );

export const loadTextureForAssetPath = async (
  assetPath: string,
  options?: LoadTextureOptions,
) => {
  const resolvedAssetPath = await resolveTextureAssetPath(assetPath, options);
  const cacheKey = resolvedAssetPath;
  const cachedEntry = boardTextureCache.get(cacheKey);

  if (cachedEntry) {
    touchCacheEntry(cacheKey, cachedEntry);
    return cachedEntry.promise;
  }

  const texturePromise = loadTextureDirectly(resolvedAssetPath).then((texture) => {
    const entry = boardTextureCache.get(cacheKey);
    if (entry) {
      entry.byteSize = estimateTextureBytes(texture);
      touchCacheEntry(cacheKey, entry);
      enforceTextureCacheLimits();
    }

    return texture;
  });

  boardTextureCache.set(cacheKey, {
    promise: texturePromise,
    sourceAssetPath: assetPath,
    byteSize: 0,
    lastUsedAt: ++textureCacheSequence,
  });
  enforceTextureCacheLimits();

  try {
    return await texturePromise;
  } catch {
    boardTextureCache.delete(cacheKey);
    throw new Error(`Failed to decode texture for ${resolvedAssetPath}`);
  }
};

export const pruneBoardTextureCache = (allowedAssetPaths: Set<string>) => {
  activeBoardTextureAssetPaths.clear();
  allowedAssetPaths.forEach((assetPath) => {
    activeBoardTextureAssetPaths.add(assetPath);
  });

  boardTextureCache.forEach((entry, cacheKey) => {
    if (allowedAssetPaths.has(entry.sourceAssetPath)) {
      return;
    }

    boardTextureCache.delete(cacheKey);
    destroyTexturePromise(entry.promise);
  });
  enforceTextureCacheLimits();

  boardTextureVariantCache.forEach((_, cacheKey) => {
    const sourceAssetPath = cacheKey.replace(/::dot-gain-20$/, "");
    if (!allowedAssetPaths.has(sourceAssetPath)) {
      boardTextureVariantCache.delete(cacheKey);
    }
  });
};
