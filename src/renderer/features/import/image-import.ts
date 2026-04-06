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

export { getDataUrlByteLength, inferImageFormatLabel };
