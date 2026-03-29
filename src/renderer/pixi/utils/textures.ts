import { Assets, Texture } from "pixi.js";

export const loadTextureForAssetPath = async (assetPath: string) => {
  try {
    return await Assets.load<Texture>(assetPath);
  } catch {
    return await new Promise<Texture>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(Texture.from(image));
      image.onerror = () =>
        reject(new Error(`Failed to decode texture for ${assetPath}`));
      image.src = assetPath;
    });
  }
};
