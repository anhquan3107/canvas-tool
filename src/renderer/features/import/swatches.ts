import type { ColorSwatch } from "@shared/types/project";

const DEFAULT_COLOR_COUNT = 16;

export const extractImageSwatches = async (
  source: string,
  colorCount = DEFAULT_COLOR_COUNT,
): Promise<ColorSwatch[]> => {
  return window.desktopApi.import.extractImageSwatches({
    source,
    colorCount,
  });
};
