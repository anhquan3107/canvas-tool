import type { ImageItem, ReferenceGroup } from "@shared/types/project";
import { extractImageSwatches } from "./swatches";

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

const normalizeUrlCandidate = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return trimmed;
};

const toUrlFingerprint = (value: string) => {
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

const isDataImageUrl = (value: string) => {
  const normalized = normalizeUrlCandidate(value);
  return /^data:image\//i.test(normalized);
};

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(normalizeUrlCandidate(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isImportableImageSource = (value: string) => {
  return isHttpUrl(value) || isDataImageUrl(value);
};

const fileHasSupportedExtension = (name: string) => {
  const lowered = name.toLowerCase();
  for (const extension of SUPPORTED_EXTENSIONS) {
    if (lowered.endsWith(extension)) {
      return true;
    }
  }

  return false;
};

const isImageFile = (file: File) => {
  if (file.type.startsWith("image/")) {
    return true;
  }

  return fileHasSupportedExtension(file.name);
};

const normalizeFormatLabel = (value: string) => {
  const cleaned = value.trim().toLowerCase();
  switch (cleaned) {
    case "jpeg":
      return "JPG";
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

export const getDataUrlByteLength = (value?: string) => {
  if (!value?.startsWith("data:")) {
    return null;
  }

  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) {
    return null;
  }

  const header = value.slice(0, commaIndex);
  const payload = value.slice(commaIndex + 1);

  if (header.includes(";base64")) {
    const sanitized = payload.replace(/\s/g, "");
    const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((sanitized.length * 3) / 4) - padding);
  }

  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).length;
  } catch {
    return null;
  }
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error(`Failed to read file: ${file.name}`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

const measureImage = (source: string) =>
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

const normalizeSize = (width: number, height: number) => {
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

const parseUrlText = (input: string) => {
  const urls = input
    .split(/\r?\n/)
    .map((part) => normalizeUrlCandidate(part))
    .filter((part) => part.length > 0)
    .filter((part) => !part.startsWith("#"))
    .filter(isImportableImageSource);

  const unique = new Map<string, string>();
  urls.forEach((url) => {
    const fingerprint = toUrlFingerprint(url);
    if (!unique.has(fingerprint)) {
      unique.set(fingerprint, url);
    }
  });

  return [...unique.values()];
};

const parseSrcSet = (srcset: string) => {
  return srcset
    .split(",")
    .map((entry) => entry.trim())
    .map((entry) => entry.split(/\s+/)[0])
    .map((entry) => normalizeUrlCandidate(entry))
    .filter((candidate) => candidate.length > 0)
    .filter(isImportableImageSource);
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

const pickBestDropImageCandidate = (urls: string[]) => {
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

const parseUrlsFromHtml = (html: string) => {
  if (!html.trim()) {
    return [];
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");
  const candidates = new Map<string, string>();

  const pushCandidate = (value: string | null) => {
    if (!value) {
      return;
    }

    const trimmed = normalizeUrlCandidate(value);
    if (isImportableImageSource(trimmed)) {
      const fingerprint = toUrlFingerprint(trimmed);
      if (!candidates.has(fingerprint)) {
        candidates.set(fingerprint, trimmed);
      }
    }
  };

  documentNode.querySelectorAll("img").forEach((element) => {
    pushCandidate(element.getAttribute("src"));
    for (const parsed of parseSrcSet(element.getAttribute("srcset") ?? "")) {
      pushCandidate(parsed);
    }
  });

  documentNode.querySelectorAll("source").forEach((element) => {
    pushCandidate(element.getAttribute("src"));
    for (const parsed of parseSrcSet(element.getAttribute("srcset") ?? "")) {
      pushCandidate(parsed);
    }
  });

  documentNode
    .querySelectorAll(
      'meta[property="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]',
    )
    .forEach((element) => {
      pushCandidate(element.getAttribute("content"));
    });

  return [...candidates.values()];
};

const dedupeFiles = (files: File[]) => {
  const seen = new Set<string>();
  const unique: File[] = [];

  for (const file of files) {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(file);
  }

  return unique;
};

export interface ImportPayload {
  source: "drop" | "clipboard";
  files: File[];
  urls: string[];
}

export const collectDropPayload = (event: DragEvent): ImportPayload => {
  const transfer = event.dataTransfer;

  if (!transfer) {
    return { source: "drop", files: [], urls: [] };
  }

  const files = dedupeFiles(
    Array.from(transfer.files).filter((file) => isImageFile(file)),
  );

  const uriList = transfer.getData("text/uri-list");
  const plainText = transfer.getData("text/plain");
  const html = transfer.getData("text/html");

  const htmlUrls = parseUrlsFromHtml(html);
  const fallbackUrls =
    htmlUrls.length > 0
      ? []
      : [...parseUrlText(uriList), ...parseUrlText(plainText)];
  const urls =
    htmlUrls.length > 0
      ? pickBestDropImageCandidate(htmlUrls)
      : [...new Set([...fallbackUrls])];

  return {
    source: "drop",
    files,
    urls,
  };
};

export const collectClipboardPayload = (
  event: ClipboardEvent,
): ImportPayload => {
  const clipboard = event.clipboardData;
  if (!clipboard) {
    return { source: "clipboard", files: [], urls: [] };
  }

  const files = dedupeFiles(
    Array.from(clipboard.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)
      .filter((file) => isImageFile(file)),
  );

  const rawUrls = [
    ...new Set([
      ...parseUrlText(clipboard.getData("text/plain")),
      ...parseUrlsFromHtml(clipboard.getData("text/html")),
      ...parseUrlText(clipboard.getData("text/uri-list")),
    ]),
  ];

  // Favor direct clipboard files over noisy page URL payloads.
  const urls = files.length > 0 ? [] : rawUrls.slice(0, 8);

  return {
    source: "clipboard",
    files,
    urls,
  };
};

interface BuildImageItemsOptions {
  payload: ImportPayload;
  group: ReferenceGroup;
  viewportWidth: number;
  viewportHeight: number;
  resolveRemoteUrl?: (url: string) => Promise<string | null>;
}

export const buildImageItemsFromPayload = async ({
  payload,
  group,
  viewportWidth,
  viewportHeight,
  resolveRemoteUrl,
}: BuildImageItemsOptions): Promise<ImageItem[]> => {
  const startX = Math.max(40, (viewportWidth * 0.45 - group.panX) / group.zoom);
  const startY = Math.max(40, (viewportHeight * 0.5 - group.panY) / group.zoom);
  const maxZ = group.items.reduce(
    (acc, item) => Math.max(acc, item.zIndex),
    -1,
  );

  const localItems = await Promise.all(
    payload.files.map(async (file, index) => {
      const dataUrl = await fileToDataUrl(file);
      const measured = await measureImage(dataUrl);
      const swatches = await extractImageSwatches(dataUrl);
      const size = normalizeSize(measured.width, measured.height);
      const sourceType: ImageItem["source"] =
        payload.source === "clipboard" ? "clipboard" : "local";
      const baseName = file.name.trim() || `Image ${index + 1}`;
      const label =
        sourceType === "clipboard" ? `Clipboard: ${baseName}` : baseName;

      return {
        id: crypto.randomUUID(),
        type: "image" as const,
        source: sourceType,
        assetPath: dataUrl,
        label,
        originalWidth: measured.width,
        originalHeight: measured.height,
        fileSizeBytes: file.size,
        format: inferImageFormatLabel(file.type) ?? inferImageFormatLabel(file.name) ?? undefined,
        swatchHex: swatches[0]?.colorHex,
        swatches,
        x: Math.round(startX + (index % 4) * 46),
        y: Math.round(startY + index * 36),
        width: size.width,
        height: size.height,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        flippedX: false,
        locked: false,
        visible: true,
        zIndex: maxZ + index + 1,
      };
    }),
  );

  const webStart = localItems.length;

  const webItems = await Promise.all<ImageItem | null>(
    payload.urls.map(async (url, index): Promise<ImageItem | null> => {
      let size = { width: 320, height: 220 };
      let originalSize = size;
      let finalAssetPath: string | null = isDataImageUrl(url) ? url : null;

      if (!finalAssetPath && resolveRemoteUrl) {
        try {
          finalAssetPath = await resolveRemoteUrl(url);
        } catch {
          finalAssetPath = null;
        }
      }

      if (!finalAssetPath) {
        return null;
      }

      try {
        const measured = await measureImage(finalAssetPath);
        originalSize = measured;
        size = normalizeSize(measured.width, measured.height);
      } catch {
        return null;
      }

      const swatches = await extractImageSwatches(finalAssetPath);

      const fallbackLabel = (() => {
        if (isDataImageUrl(url)) {
          return "Embedded clipboard image";
        }

        try {
          const parsedUrl = new URL(url);
          return `${parsedUrl.hostname}${parsedUrl.pathname}`;
        } catch {
          return "Imported image link";
        }
      })();

      return {
        id: crypto.randomUUID(),
        type: "image" as const,
        source: "web" as const,
        assetPath: finalAssetPath,
        label: `${payload.source === "clipboard" ? "Clipboard link: " : ""}${fallbackLabel}`,
        originalWidth: originalSize.width,
        originalHeight: originalSize.height,
        fileSizeBytes: getDataUrlByteLength(finalAssetPath) ?? undefined,
        format:
          inferImageFormatLabel(url) ??
          inferImageFormatLabel(finalAssetPath) ??
          undefined,
        previewStatus: "ready" as const,
        swatchHex: swatches[0]?.colorHex,
        swatches,
        x: Math.round(startX + ((webStart + index) % 4) * 46),
        y: Math.round(startY + (webStart + index) * 36),
        width: size.width,
        height: size.height,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        flippedX: false,
        locked: false,
        visible: true,
        zIndex: maxZ + webStart + index + 1,
      };
    }),
  );

  const seenAssetPaths = new Set<string>();

  return [...localItems, ...webItems.filter((item) => item !== null)].filter(
    (item) => {
      const fingerprint = item.assetPath
        ? toUrlFingerprint(item.assetPath)
        : `${item.type}-${item.label ?? item.id}`;

      if (seenAssetPaths.has(fingerprint)) {
        return false;
      }

      seenAssetPaths.add(fingerprint);
      return true;
    },
  );
};
