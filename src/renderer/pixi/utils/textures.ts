import { Assets, Texture } from "pixi.js";

const boardTextureCache = new Map<string, Promise<Texture>>();

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
}

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
  const cacheKey = `${assetPath}::${options?.preferHighResolution ? "hq" : "std"}`;
  const cachedTexture = boardTextureCache.get(cacheKey);

  if (cachedTexture) {
    return cachedTexture;
  }

  const texturePromise = (async () => {
    if (options?.preferHighResolution) {
      return loadTextureDirectly(assetPath);
    }

    try {
      const texture = await Assets.load<Texture>(assetPath);
      return configureBoardTextureQuality(texture);
    } catch {
      return loadTextureDirectly(assetPath);
    }
  })();

  boardTextureCache.set(cacheKey, texturePromise);

  try {
    return await texturePromise;
  } catch {
    boardTextureCache.delete(cacheKey);
    throw new Error(`Failed to decode texture for ${assetPath}`);
  }
};
