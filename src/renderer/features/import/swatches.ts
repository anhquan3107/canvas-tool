import type { ColorSwatch } from "@shared/types/project";

const MAX_SWATCHES = 10;
const SAMPLE_SIZE = 40;
const QUANTIZE_STEP = 32;
const MIN_COLOR_DISTANCE = 42;

const rgbToHex = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const colorDistance = (first: string, second: string) => {
  const left = hexToRgb(first);
  const right = hexToRgb(second);
  return Math.hypot(
    left.red - right.red,
    left.green - right.green,
    left.blue - right.blue,
  );
};

export const extractImageSwatches = (source: string) =>
  new Promise<ColorSwatch[]>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        resolve([]);
        return;
      }

      context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
      const counts = new Map<string, number>();

      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3];
        if (alpha < 32) {
          continue;
        }

        const red = Math.min(
          255,
          Math.round(pixels[index] / QUANTIZE_STEP) * QUANTIZE_STEP,
        );
        const green = Math.min(
          255,
          Math.round(pixels[index + 1] / QUANTIZE_STEP) * QUANTIZE_STEP,
        );
        const blue = Math.min(
          255,
          Math.round(pixels[index + 2] / QUANTIZE_STEP) * QUANTIZE_STEP,
        );
        const key = rgbToHex(red, green, blue);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      const rankedColors = [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([colorHex]) => colorHex);

      const picked = rankedColors.reduce<string[]>((palette, colorHex) => {
        if (palette.length >= MAX_SWATCHES) {
          return palette;
        }

        if (
          palette.some(
            (existingColor) =>
              colorDistance(existingColor, colorHex) < MIN_COLOR_DISTANCE,
          )
        ) {
          return palette;
        }

        palette.push(colorHex);
        return palette;
      }, []);

      const fallbackPalette = picked.length > 0 ? picked : rankedColors.slice(0, 1);
      resolve(
        fallbackPalette.map((colorHex, index) => ({
          id: crypto.randomUUID(),
          colorHex,
          origin: "image",
          label: `Swatch ${index + 1}`,
        })),
      );
    };
    image.onerror = () => resolve([]);
    image.src = source;
  });
