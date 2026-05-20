import type { ImageItem, ReferenceGroup } from "@shared/types/project";
import { extractImageSwatches } from "./swatches";
import {
  fileToDataUrl,
  getDataUrlByteLength,
} from "@renderer/features/import/image-data-url";
import {
  measureImage,
  normalizeSize,
  pickBestDropImageCandidate,
} from "@renderer/features/import/image-dimensions";
import { dedupeFiles, parseUrlText, parseUrlsFromHtml } from "@renderer/features/import/image-file-metadata";
import {
  inferImageFormatLabel,
  isDataImageUrl,
  isImageFile,
  toUrlFingerprint,
} from "@renderer/features/import/image-format";

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

  const clipboardFiles: File[] = [];
  for (const item of clipboard.items) {
    if (item.kind !== "file") {
      continue;
    }

    const file = item.getAsFile();
    if (file && isImageFile(file)) {
      clipboardFiles.push(file);
    }
  }

  const files = dedupeFiles(clipboardFiles);

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

  const localItemsPromise = Promise.all(
    payload.files.map(async (file, index) => {
      const dataUrl = await fileToDataUrl(file);
      const [measured, swatches] = await Promise.all([
        measureImage(dataUrl),
        extractImageSwatches(dataUrl),
      ]);
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

  const webStart = payload.files.length;

  const webItemsPromise = Promise.all<ImageItem | null>(
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

      const measuredPromise = measureImage(finalAssetPath);
      const swatchesPromise = extractImageSwatches(finalAssetPath);
      const measured = await measuredPromise.catch(() => null);
      if (!measured) {
        void swatchesPromise.catch(() => undefined);
        return null;
      }

      originalSize = measured;
      size = normalizeSize(measured.width, measured.height);
      const swatches = await swatchesPromise;

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

  const [localItems, webItems] = await Promise.all([
    localItemsPromise,
    webItemsPromise,
  ]);

  const seenAssetPaths = new Set<string>();
  const dedupedItems: ImageItem[] = [];

  for (const item of [...localItems, ...webItems]) {
    if (!item) {
      continue;
    }

    const fingerprint = item.assetPath
      ? toUrlFingerprint(item.assetPath)
      : `${item.type}-${item.label ?? item.id}`;

    if (!seenAssetPaths.has(fingerprint)) {
      seenAssetPaths.add(fingerprint);
      dedupedItems.push(item);
    }
  }

  return dedupedItems;
};

export { getDataUrlByteLength, inferImageFormatLabel };
