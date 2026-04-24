import sharp from "sharp";

export const BOARD_PREVIEW_MAX_DIMENSION = 1280;
export const THUMBNAIL_MAX_DIMENSION = 320;

export interface ImageAssetVariant {
  buffer: Buffer;
  extension: string;
}

export interface ImageAssetVariants {
  preview: ImageAssetVariant | null;
  thumbnail: ImageAssetVariant | null;
}

const normalizeExtension = (value?: string | null) => {
  const normalized = (value ?? "").trim().toLowerCase().replace(/^\./, "");

  switch (normalized) {
    case "jpeg":
      return "jpg";
    case "jpg":
    case "png":
    case "gif":
    case "bmp":
    case "webp":
    case "tiff":
    case "tif":
    case "ico":
    case "avif":
      return normalized === "tif" ? "tiff" : normalized;
    default:
      return null;
  }
};

const renderVariant = async (
  pipeline: sharp.Sharp,
  maxDimension: number,
  hasAlpha: boolean,
) => {
  const resized = pipeline.resize({
    width: maxDimension,
    height: maxDimension,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (hasAlpha) {
    return {
      buffer: await resized.png({ compressionLevel: 9 }).toBuffer(),
      extension: "png",
    } satisfies ImageAssetVariant;
  }

  return {
    buffer: await resized.jpeg({
      quality: maxDimension <= THUMBNAIL_MAX_DIMENSION ? 70 : 82,
      mozjpeg: true,
    }).toBuffer(),
    extension: "jpg",
  } satisfies ImageAssetVariant;
};

export const buildImageAssetVariantsFromBuffer = async (
  source: Buffer,
  extensionHint?: string | null,
): Promise<ImageAssetVariants> => {
  const pipeline = sharp(source).rotate();
  const metadata = await pipeline.metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;
  const hasAlpha = Boolean(metadata.hasAlpha);
  const normalizedHint = normalizeExtension(extensionHint);
  const normalizedFormat = normalizeExtension(metadata.format);
  const shouldPreferAlphaSafeEncoding =
    hasAlpha ||
    normalizedHint === "png" ||
    normalizedFormat === "png" ||
    normalizedFormat === "gif" ||
    normalizedFormat === "webp" ||
    normalizedFormat === "avif";

  const longestEdge = Math.max(sourceWidth, sourceHeight);

  const preview =
    longestEdge > BOARD_PREVIEW_MAX_DIMENSION
      ? await renderVariant(
          pipeline.clone(),
          BOARD_PREVIEW_MAX_DIMENSION,
          shouldPreferAlphaSafeEncoding,
        )
      : null;
  const thumbnail =
    longestEdge > THUMBNAIL_MAX_DIMENSION
      ? await renderVariant(
          pipeline.clone(),
          THUMBNAIL_MAX_DIMENSION,
          shouldPreferAlphaSafeEncoding,
        )
      : null;

  return {
    preview,
    thumbnail,
  };
};
