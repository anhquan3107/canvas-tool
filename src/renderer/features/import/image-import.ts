import type { ImageItem, ReferenceGroup } from "@shared/types/project";

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

  return [...new Set(urls)];
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

const parseUrlsFromHtml = (html: string) => {
  if (!html.trim()) {
    return [];
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");
  const candidates = new Set<string>();

  const pushCandidate = (value: string | null) => {
    if (!value) {
      return;
    }

    const trimmed = normalizeUrlCandidate(value);
    if (isImportableImageSource(trimmed)) {
      candidates.add(trimmed);
    }
  };

  documentNode.querySelectorAll("img").forEach((element) => {
    pushCandidate(element.getAttribute("src"));
    for (const parsed of parseSrcSet(element.getAttribute("srcset") ?? "")) {
      candidates.add(parsed);
    }
  });

  documentNode.querySelectorAll("source").forEach((element) => {
    pushCandidate(element.getAttribute("src"));
    for (const parsed of parseSrcSet(element.getAttribute("srcset") ?? "")) {
      candidates.add(parsed);
    }
  });

  documentNode
    .querySelectorAll(
      'meta[property="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]',
    )
    .forEach((element) => {
      pushCandidate(element.getAttribute("content"));
    });

  documentNode.querySelectorAll("a").forEach((element) => {
    const href = element.getAttribute("href");
    if (!href) {
      return;
    }

    const lowered = href.toLowerCase();
    if (
      Array.from(SUPPORTED_EXTENSIONS).some((extension) =>
        lowered.includes(extension),
      )
    ) {
      pushCandidate(href);
    }
  });

  return [...candidates];
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

  const urls = [
    ...new Set([
      ...parseUrlText(uriList),
      ...parseUrlText(plainText),
      ...parseUrlsFromHtml(html),
    ]),
  ];

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

  const webItems = await Promise.all(
    payload.urls.map(async (url, index) => {
      let size = { width: 320, height: 220 };
      let previewStatus: ImageItem["previewStatus"] = "ready";
      let finalAssetPath = url;

      try {
        const measured = await measureImage(url);
        size = normalizeSize(measured.width, measured.height);
      } catch {
        if (resolveRemoteUrl) {
          try {
            const dataUrl = await resolveRemoteUrl(url);
            if (dataUrl) {
              finalAssetPath = dataUrl;
              const measured = await measureImage(dataUrl);
              size = normalizeSize(measured.width, measured.height);
            } else {
              previewStatus = "blocked";
            }
          } catch {
            previewStatus = "blocked";
          }
        } else {
          previewStatus = "blocked";
        }
      }

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
        label:
          previewStatus === "blocked"
            ? `${payload.source === "clipboard" ? "Clipboard link: " : ""}${fallbackLabel} (preview blocked)`
            : `${payload.source === "clipboard" ? "Clipboard link: " : ""}${fallbackLabel}`,
        previewStatus,
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

  return [...localItems, ...webItems];
};
