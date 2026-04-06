const SUPPORTED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".tif",
  ".tiff",
  ".ico",
]);

export const normalizeUrlCandidate = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return trimmed;
};

export const isDataImageUrl = (value: string) => {
  const normalized = normalizeUrlCandidate(value);
  return /^data:image\//i.test(normalized);
};

export const toUrlFingerprint = (value: string) => {
  const normalized = normalizeUrlCandidate(value);

  if (isDataImageUrl(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return normalized;
  }
};

export const isHttpUrl = (value: string) => {
  try {
    const url = new URL(normalizeUrlCandidate(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const isImportableImageSource = (value: string) =>
  isHttpUrl(value) || isDataImageUrl(value);

export const fileHasSupportedExtension = (name: string) => {
  const lowered = name.toLowerCase();
  for (const extension of SUPPORTED_EXTENSIONS) {
    if (lowered.endsWith(extension)) {
      return true;
    }
  }

  return false;
};

export const isImageFile = (file: File) => {
  if (file.type.startsWith("image/")) {
    return true;
  }

  return fileHasSupportedExtension(file.name);
};

const normalizeFormatLabel = (value: string) => {
  const cleaned = value.trim().toLowerCase();
  switch (cleaned) {
    case "jpeg":
    case "jpg":
      return "JPG";
    case "png":
      return "PNG";
    case "webp":
      return "WEBP";
    case "gif":
      return "GIF";
    case "bmp":
      return "BMP";
    case "tif":
    case "tiff":
      return "TIFF";
    case "ico":
      return "ICO";
    case "svg+xml":
    case "svg":
      return "SVG";
    case "avif":
      return "AVIF";
    default:
      return cleaned ? cleaned.toUpperCase() : null;
  }
};

export const inferImageFormatLabel = (value?: string) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dataUrlMatch = trimmed.match(/^data:image\/([^;,]+)/i);
  if (dataUrlMatch) {
    return normalizeFormatLabel(dataUrlMatch[1]);
  }

  const mimeTypeMatch = trimmed.match(/^image\/([^;,]+)/i);
  if (mimeTypeMatch) {
    return normalizeFormatLabel(mimeTypeMatch[1]);
  }

  const withoutQuery = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  const extensionMatch = withoutQuery.match(/\.([a-z0-9+]+)$/i);
  if (extensionMatch) {
    return normalizeFormatLabel(extensionMatch[1]);
  }

  return null;
};
