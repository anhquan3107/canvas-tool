import { Texture } from "pixi.js";
import type { ImageItem } from "@shared/types/project";

interface TextureCacheEntry {
  promise: Promise<Texture>;
  sourceAssetPath: string;
}

const boardTextureCache = new Map<string, TextureCacheEntry>();
const boardTextureVariantCache = new Map<string, Promise<string>>();
const IS_WINDOWS =
  typeof navigator !== "undefined" &&
  /windows/i.test(navigator.userAgent);
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

const loadTextureDirectly = async (assetPath: string) =>
  scheduleTextureDecode(
    () =>
      new Promise<Texture>((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () =>
          resolve(configureBoardTextureQuality(Texture.from(image)));
        image.onerror = () =>
          reject(new Error(`Failed to decode texture for ${assetPath}`));
        image.src = assetPath;
      }),
  );

export const loadTextureForAssetPath = async (
  assetPath: string,
  options?: LoadTextureOptions,
) => {
  const resolvedAssetPath = await resolveTextureAssetPath(assetPath, options);
  const cacheKey = `${resolvedAssetPath}::${options?.preferHighResolution ? "hq" : "std"}`;
  const cachedTexture = boardTextureCache.get(cacheKey)?.promise;

  if (cachedTexture) {
    return cachedTexture;
  }

  const texturePromise = loadTextureDirectly(resolvedAssetPath);

  boardTextureCache.set(cacheKey, {
    promise: texturePromise,
    sourceAssetPath: assetPath,
  });

  try {
    return await texturePromise;
  } catch {
    boardTextureCache.delete(cacheKey);
    throw new Error(`Failed to decode texture for ${resolvedAssetPath}`);
  }
};

export const pruneBoardTextureCache = (allowedAssetPaths: Set<string>) => {
  boardTextureCache.forEach((entry, cacheKey) => {
    if (allowedAssetPaths.has(entry.sourceAssetPath)) {
      return;
    }

    boardTextureCache.delete(cacheKey);
    void entry.promise
      .then((texture) => {
        texture.destroy(true);
      })
      .catch(() => undefined);
  });

  boardTextureVariantCache.forEach((_, cacheKey) => {
    const sourceAssetPath = cacheKey.replace(/::dot-gain-20$/, "");
    if (!allowedAssetPaths.has(sourceAssetPath)) {
      boardTextureVariantCache.delete(cacheKey);
    }
  });
};
