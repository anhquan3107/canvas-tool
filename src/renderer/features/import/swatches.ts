import type { ColorSwatch } from "@shared/types/project";

const MAX_SWATCHES = 16;
const SAMPLE_SIZE = 96;
const QUANTIZE_STEP = 16;
const MIN_COLOR_DISTANCE = 20;
const MIN_ALPHA = 40;
const MIN_NEUTRAL_LUMINANCE_DISTANCE = 6;

interface SwatchBucket {
  count: number;
  redTotal: number;
  greenTotal: number;
  blueTotal: number;
}

interface RankedSwatchCandidate {
  colorHex: string;
  count: number;
  saturation: number;
  luminance: number;
  dominanceScore: number;
  accentScore: number;
  balanceScore: number;
  tonalScore: number;
}

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

const channelToBucket = (value: number) =>
  Math.min(255, Math.round(value / QUANTIZE_STEP) * QUANTIZE_STEP);

const calculateSaturation = (red: number, green: number, blue: number) => {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  if (max === 0) {
    return 0;
  }

  return (max - min) / max;
};

const calculateLuminance = (red: number, green: number, blue: number) =>
  red * 0.2126 + green * 0.7152 + blue * 0.0722;

const isNeutralCandidate = (candidate: Pick<RankedSwatchCandidate, "saturation">) =>
  candidate.saturation < 0.16;

const rankCandidates = (buckets: Map<string, SwatchBucket>) =>
  [...buckets.values()].map<RankedSwatchCandidate>((bucket) => {
      const red = Math.round(bucket.redTotal / bucket.count);
      const green = Math.round(bucket.greenTotal / bucket.count);
      const blue = Math.round(bucket.blueTotal / bucket.count);
      const saturation = calculateSaturation(red, green, blue);
      const luminance = calculateLuminance(red, green, blue);
      const colorHex = rgbToHex(red, green, blue);

      return {
        colorHex,
        count: bucket.count,
        saturation,
        luminance,
        dominanceScore: bucket.count,
        accentScore: Math.sqrt(bucket.count) * (0.55 + saturation * 2.8),
        balanceScore: bucket.count * (1 + saturation * 0.55),
        tonalScore: 0,
      };
    });

const pushDistinctColors = (
  palette: string[],
  candidates: RankedSwatchCandidate[],
  limit: number,
) => {
  candidates.forEach((candidate) => {
    if (palette.length >= limit) {
      return;
    }

    const clashesWithExisting = palette.some((existingColor) => {
      const existingRgb = hexToRgb(existingColor);
      const existingCandidate = {
        saturation: calculateSaturation(
          existingRgb.red,
          existingRgb.green,
          existingRgb.blue,
        ),
        luminance: calculateLuminance(
          existingRgb.red,
          existingRgb.green,
          existingRgb.blue,
        ),
      };

      if (isNeutralCandidate(existingCandidate) && isNeutralCandidate(candidate)) {
        return (
          Math.abs(existingCandidate.luminance - candidate.luminance) <
          MIN_NEUTRAL_LUMINANCE_DISTANCE
        );
      }

      return colorDistance(existingColor, candidate.colorHex) < MIN_COLOR_DISTANCE;
    });

    if (clashesWithExisting) {
      return;
    }

    palette.push(candidate.colorHex);
  });
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
      const buckets = new Map<string, SwatchBucket>();

      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3];
        if (alpha < MIN_ALPHA) {
          continue;
        }

        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const key = rgbToHex(
          channelToBucket(red),
          channelToBucket(green),
          channelToBucket(blue),
        );
        const bucket = buckets.get(key);

        if (bucket) {
          bucket.count += 1;
          bucket.redTotal += red;
          bucket.greenTotal += green;
          bucket.blueTotal += blue;
        } else {
          buckets.set(key, {
            count: 1,
            redTotal: red,
            greenTotal: green,
            blueTotal: blue,
          });
        }
      }

      const ranked = rankCandidates(buckets);
      const dominantBaseLuminance = ranked[0]?.luminance ?? 255;
      ranked.forEach((candidate) => {
        candidate.tonalScore =
          Math.sqrt(candidate.count) * (0.9 + (1 - candidate.saturation) * 1.35) +
          Math.abs(candidate.luminance - dominantBaseLuminance) / 6;
      });
      const palette: string[] = [];

      pushDistinctColors(
        palette,
        [...ranked].sort((left, right) => right.dominanceScore - left.dominanceScore),
        Math.min(5, MAX_SWATCHES),
      );
      pushDistinctColors(
        palette,
        [...ranked].sort((left, right) => right.accentScore - left.accentScore),
        Math.min(11, MAX_SWATCHES),
      );
      pushDistinctColors(
        palette,
        [...ranked].sort((left, right) => right.tonalScore - left.tonalScore),
        Math.min(14, MAX_SWATCHES),
      );
      pushDistinctColors(
        palette,
        [...ranked].sort((left, right) => right.balanceScore - left.balanceScore),
        MAX_SWATCHES,
      );

      const fallbackPalette =
        palette.length > 0
          ? palette
          : ranked.slice(0, 1).map((candidate) => candidate.colorHex);

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
