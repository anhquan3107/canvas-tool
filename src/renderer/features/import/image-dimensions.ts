import { normalizeUrlCandidate } from "@renderer/features/import/image-format";

export const measureImage = (source: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || 320,
        height: image.naturalHeight || 240,
      });
    };
    image.onerror = () => reject(new Error("Failed to decode image."));
    image.src = source;
  });

export const normalizeSize = (width: number, height: number) => {
  const max = 520;
  const min = 90;

  if (width <= max && height <= max) {
    return {
      width: Math.max(min, width),
      height: Math.max(min, height),
    };
  }

  const ratio = Math.min(max / width, max / height);
  return {
    width: Math.max(min, Math.round(width * ratio)),
    height: Math.max(min, Math.round(height * ratio)),
  };
};

const readDimensionScore = (value: string) => {
  const normalized = normalizeUrlCandidate(value).toLowerCase();
  let bestArea = 0;

  const matches = normalized.matchAll(/(\d{2,5})x(\d{2,5})/g);
  for (const match of matches) {
    const width = Number.parseInt(match[1], 10);
    const height = Number.parseInt(match[2], 10);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      bestArea = Math.max(bestArea, width * height);
    }
  }

  if (normalized.includes("/originals/")) {
    bestArea = Math.max(bestArea, 50_000_000);
  }

  return bestArea;
};

export const pickBestDropImageCandidate = (urls: string[]) => {
  if (urls.length <= 1) {
    return urls;
  }

  const ranked = [...urls].sort((left, right) => {
    const scoreDelta = readDimensionScore(right) - readDimensionScore(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return right.length - left.length;
  });

  return ranked.slice(0, 1);
};
