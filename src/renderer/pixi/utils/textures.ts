import { Assets, Texture } from "pixi.js";

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

export const loadTextureForAssetPath = async (assetPath: string) => {
  try {
    const texture = await Assets.load<Texture>(assetPath);
    return configureBoardTextureQuality(texture);
  } catch {
    return await new Promise<Texture>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () =>
        resolve(configureBoardTextureQuality(Texture.from(image)));
      image.onerror = () =>
        reject(new Error(`Failed to decode texture for ${assetPath}`));
      image.src = assetPath;
    });
  }
};
