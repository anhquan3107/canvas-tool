import { Assets, Texture } from "pixi.js";

const boardTextureCache = new Map<string, Promise<Texture>>();
const boardTextureVariantCache = new Map<string, Promise<string>>();

export const configureBoardTextureQuality = (
  texture: Texture,
  options?: { dynamic?: boolean },
) => {
  const source = texture.source;

  source.scaleMode = "linear";
  source.minFilter = "linear";
  source.magFilter = "linear";
  source.mipmapFilter = "linear";
  source.maxAnisotropy = 8;

  if (!options?.dynamic) {
    source.autoGenerateMipmaps = true;
  }

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

const loadTextureDirectly = async (assetPath: string) =>
  new Promise<Texture>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () =>
      resolve(configureBoardTextureQuality(Texture.from(image)));
    image.onerror = () =>
      reject(new Error(`Failed to decode texture for ${assetPath}`));
    image.src = assetPath;
  });

export const loadTextureForAssetPath = async (
  assetPath: string,
  options?: LoadTextureOptions,
) => {
  const resolvedAssetPath = await resolveTextureAssetPath(assetPath, options);
  const cacheKey = `${resolvedAssetPath}::${options?.preferHighResolution ? "hq" : "std"}`;
  const cachedTexture = boardTextureCache.get(cacheKey);

  if (cachedTexture) {
    return cachedTexture;
  }

  const texturePromise = (async () => {
    if (options?.preferHighResolution) {
      return loadTextureDirectly(resolvedAssetPath);
    }

    try {
      const texture = await Assets.load<Texture>(resolvedAssetPath);
      return configureBoardTextureQuality(texture);
    } catch {
      return loadTextureDirectly(resolvedAssetPath);
    }
  })();

  boardTextureCache.set(cacheKey, texturePromise);

  try {
    return await texturePromise;
  } catch {
    boardTextureCache.delete(cacheKey);
    throw new Error(`Failed to decode texture for ${resolvedAssetPath}`);
  }
};
