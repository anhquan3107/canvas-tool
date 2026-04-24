import sharp from "sharp";
import type { ColorSwatch } from "@shared/types/project";
import { decodeDataUrl, isHttpUrl } from "../ipc/ipc-utils";
import { resolveLocalAssetPath } from "./canvas-asset-files";

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

interface HsvColor {
  hue: number;
  saturation: number;
  value: number;
}

interface ColorFrequencyEntry {
  color: RgbColor;
  frequency: number;
  hsv: HsvColor;
}

interface ExtractedColorEntry {
  color: RgbColor;
  frequency: number;
  hsv: HsvColor;
}

interface DistinctColorEntry extends ExtractedColorEntry {
  distinctiveness: number;
}

const DEFAULT_COLOR_COUNT = 16;
const GRID_SIZE = 5;
const QUANTIZE_STEP = 16;
const PHASE_ONE_RGB_DISTANCE = 39;
const PHASE_ONE_HSV_DISTANCE = 0.2;
const PHASE_TWO_RGB_DISTANCE = 50;
const PHASE_TWO_HUE_DISTANCE = 30;
const MIN_PHASE_TWO_FREQUENCY = 2;

const rgbToHex = ({ red, green, blue }: RgbColor) =>
  `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;

const toKey = (color: RgbColor) => `${color.red},${color.green},${color.blue}`;

const getColorDistance = (first: RgbColor, second: RgbColor) => {
  const redDelta = first.red - second.red;
  const greenDelta = first.green - second.green;
  const blueDelta = first.blue - second.blue;
  return Math.sqrt(
    redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta,
  );
};

const rgbToHsv = ({ red, green, blue }: RgbColor): HsvColor => {
  const redUnit = red / 255;
  const greenUnit = green / 255;
  const blueUnit = blue / 255;

  const max = Math.max(redUnit, greenUnit, blueUnit);
  const min = Math.min(redUnit, greenUnit, blueUnit);
  const delta = max - min;

  let hue = 0;
  const saturation = max === 0 ? 0 : delta / max;
  const value = max;

  if (delta !== 0) {
    if (max === redUnit) {
      hue = 60 * (((greenUnit - blueUnit) / delta) % 6);
    } else if (max === greenUnit) {
      hue = 60 * ((blueUnit - redUnit) / delta + 2);
    } else {
      hue = 60 * ((redUnit - greenUnit) / delta + 4);
    }

    if (hue < 0) {
      hue += 360;
    }
  }

  return { hue, saturation, value };
};

const hsvToRgb = ({ hue, saturation, value }: HsvColor): RgbColor => {
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = secondary;
  } else if (hue < 120) {
    red = secondary;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = secondary;
  } else if (hue < 240) {
    green = secondary;
    blue = chroma;
  } else if (hue < 300) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  return {
    red: Math.round((red + match) * 255),
    green: Math.round((green + match) * 255),
    blue: Math.round((blue + match) * 255),
  };
};

const getHsvDistance = (first: HsvColor, second: HsvColor) => {
  let hueDifference = Math.abs(first.hue - second.hue);
  if (hueDifference > 180) {
    hueDifference = 360 - hueDifference;
  }
  hueDifference /= 180;

  const saturationDifference = Math.abs(first.saturation - second.saturation);
  const valueDifference = Math.abs(first.value - second.value);

  return (
    hueDifference * 0.9 +
    saturationDifference * 0.2 +
    valueDifference * 0.5
  );
};

const calculateColorTemperature = (color: RgbColor) => {
  const hsv = rgbToHsv(color);
  const { hue, saturation, value } = hsv;

  let temperature = 0.5;

  if (hue >= 180 && hue <= 300) {
    const distanceFromBlue = Math.abs(hue - 240) / 60;
    temperature = 0.1 + distanceFromBlue * 0.2;
  } else if (hue >= 120 && hue < 180) {
    temperature = 0.3 + ((180 - hue) / 60) * 0.1;
  } else if (hue >= 60 && hue < 120) {
    temperature = 0.5 + ((120 - hue) / 60) * 0.1;
  } else if (hue >= 0 && hue < 60) {
    if (hue <= 30) {
      temperature = 0.9 + (hue / 30) * 0.1;
    } else {
      temperature = 1 - ((hue - 30) / 30) * 0.2;
    }
  } else if (hue >= 300 && hue < 360) {
    temperature = 0.3 + ((hue - 300) / 60) * 0.6;
  }

  if (saturation < 0.3) {
    temperature = 0.4 + (temperature - 0.4) * saturation * 3.33;
  }

  if (saturation < 0.05) {
    temperature = 0.4 + value * 0.2;
  }

  return temperature;
};

const calculateColorSortScore = (color: RgbColor) => {
  const hsv = rgbToHsv(color);
  const { hue, saturation, value } = hsv;

  if (saturation < 0.1) {
    return -1000 + value * 100;
  }

  let rainbowOrder: number;

  if (hue >= 240 && hue <= 300) {
    rainbowOrder = (300 - hue) / 60;
  } else if (hue >= 180 && hue < 240) {
    rainbowOrder = 1 + (240 - hue) / 60;
  } else if (hue >= 120 && hue < 180) {
    rainbowOrder = 2 + (180 - hue) / 60;
  } else if (hue >= 60 && hue < 120) {
    rainbowOrder = 3 + (120 - hue) / 60;
  } else if (hue >= 30 && hue < 60) {
    rainbowOrder = 4 + (60 - hue) / 30;
  } else if (hue >= 0 && hue < 30) {
    rainbowOrder = 5 + (30 - hue) / 30;
  } else {
    rainbowOrder = 6 + (360 - hue) / 60;
  }

  return rainbowOrder * 100000 + value * 10000;
};

const buildColorFrequencyList = (
  data: Buffer<ArrayBufferLike>,
  width: number,
  height: number,
  channels: number,
) => {
  const colorCounts = new Map<string, number>();

  for (let y = 0; y < height; y += GRID_SIZE) {
    for (let x = 0; x < width; x += GRID_SIZE) {
      const index = (y * width + x) * channels;
      if (index + 2 >= data.length) {
        continue;
      }

      let red = data[index];
      let green = data[index + 1];
      let blue = data[index + 2];

      red = Math.floor(red / QUANTIZE_STEP) * QUANTIZE_STEP;
      green = Math.floor(green / QUANTIZE_STEP) * QUANTIZE_STEP;
      blue = Math.floor(blue / QUANTIZE_STEP) * QUANTIZE_STEP;

      const key = toKey({ red, green, blue });
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
    }
  }

  return [...colorCounts.entries()].map<ColorFrequencyEntry>(
    ([key, frequency]) => {
      const [red, green, blue] = key.split(",").map((value) => Number(value));
      const color = { red, green, blue };
      return {
        color,
        frequency,
        hsv: rgbToHsv(color),
      };
    },
  );
};

const extractFrequentColors = (
  colorDataList: ColorFrequencyEntry[],
  colorCount: number,
) => {
  const extractedColors: ExtractedColorEntry[] = [];
  const byFrequency = [...colorDataList].sort(
    (left, right) => right.frequency - left.frequency,
  );
  const frequentColorSlots = Math.floor(colorCount * 0.9);

  for (const colorData of byFrequency) {
    if (extractedColors.length >= frequentColorSlots) {
      break;
    }

    const isSimilar = extractedColors.some((existingColor) => {
      return (
        getColorDistance(colorData.color, existingColor.color) <
          PHASE_ONE_RGB_DISTANCE ||
        getHsvDistance(colorData.hsv, existingColor.hsv) < PHASE_ONE_HSV_DISTANCE
      );
    });

    if (!isSimilar) {
      extractedColors.push({
        color: colorData.color,
        frequency: colorData.frequency,
        hsv: colorData.hsv,
      });
    }
  }

  return extractedColors;
};

const extractDistinctColors = (
  colorDataList: ColorFrequencyEntry[],
  extractedColors: ExtractedColorEntry[],
  colorCount: number,
) => {
  const extractedKeys = new Set(extractedColors.map((entry) => toKey(entry.color)));
  const remainingColors = colorDataList.filter(
    (entry) => !extractedKeys.has(toKey(entry.color)),
  );

  const distinctColors: DistinctColorEntry[] = [];

  for (const colorData of remainingColors) {
    if (colorData.frequency < MIN_PHASE_TWO_FREQUENCY) {
      continue;
    }

    let minimumRgbDistance = Number.POSITIVE_INFINITY;
    let minimumHsvDistance = Number.POSITIVE_INFINITY;

    for (const extractedColor of extractedColors) {
      const rgbDistance = getColorDistance(colorData.color, extractedColor.color);
      const hsvDistance = getHsvDistance(colorData.hsv, extractedColor.hsv);

      if (rgbDistance < minimumRgbDistance) {
        minimumRgbDistance = rgbDistance;
      }

      if (hsvDistance < minimumHsvDistance) {
        minimumHsvDistance = hsvDistance;
      }
    }

    const distinctiveness =
      minimumRgbDistance * 0.8 + minimumHsvDistance * 100 * 0.7;

    distinctColors.push({
      color: colorData.color,
      frequency: colorData.frequency,
      hsv: colorData.hsv,
      distinctiveness,
    });
  }

  for (const distinctColor of [...distinctColors].sort(
    (left, right) => right.distinctiveness - left.distinctiveness,
  )) {
    if (extractedColors.length >= colorCount) {
      break;
    }

    const isDistinct = extractedColors.every((existingColor) => {
      let hueDifference = Math.abs(distinctColor.hsv.hue - existingColor.hsv.hue);

      if (hueDifference > 180) {
        hueDifference = 360 - hueDifference;
      }

      return !(
        hueDifference < PHASE_TWO_HUE_DISTANCE &&
        getColorDistance(distinctColor.color, existingColor.color) <
          PHASE_TWO_RGB_DISTANCE
      );
    });

    if (isDistinct) {
      extractedColors.push({
        color: distinctColor.color,
        frequency: distinctColor.frequency,
        hsv: rgbToHsv(distinctColor.color),
      });
    }
  }
};

const toSharpInput = (source: string) => {
  if (source.startsWith("data:")) {
    return decodeDataUrl(source).buffer;
  }

  if (isHttpUrl(source)) {
    throw new Error("Remote URLs must be fetched before swatch extraction.");
  }

  return resolveLocalAssetPath(source) ?? source;
};

export const extractImageSwatchesFromSource = async (
  source: string,
  colorCount = DEFAULT_COLOR_COUNT,
): Promise<ColorSwatch[]> => {
  const input = toSharpInput(source);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const colorDataList = buildColorFrequencyList(data, width, height, channels);
  const extractedColors = extractFrequentColors(colorDataList, colorCount);
  extractDistinctColors(colorDataList, extractedColors, colorCount);

  return extractedColors
    .map((entry) => ({
      color: entry.color,
      sortScore: calculateColorSortScore(entry.color),
    }))
    .sort((left, right) => left.sortScore - right.sortScore || 0)
    .map((entry, index) => ({
      id: crypto.randomUUID(),
      colorHex: rgbToHex(entry.color),
      origin: "image" as const,
      label: `Swatch ${index + 1}`,
    }));
};

void calculateColorTemperature;
void hsvToRgb;
