import {
  isImportableImageSource,
  normalizeUrlCandidate,
  toUrlFingerprint,
} from "@renderer/features/import/image-format";

export const parseUrlText = (input: string) => {
  const unique = new Map<string, string>();
  for (const part of input.split(/\r?\n/)) {
    const url = normalizeUrlCandidate(part);
    if (
      url.length === 0 ||
      url.startsWith("#") ||
      !isImportableImageSource(url)
    ) {
      continue;
    }

    const fingerprint = toUrlFingerprint(url);
    if (!unique.has(fingerprint)) {
      unique.set(fingerprint, url);
    }
  }

  return [...unique.values()];
};

const parseSrcSet = (srcset: string) => {
  const urls: string[] = [];
  for (const entry of srcset.split(",")) {
    const candidate = normalizeUrlCandidate(entry.trim().split(/\s+/)[0] ?? "");
    if (candidate.length > 0 && isImportableImageSource(candidate)) {
      urls.push(candidate);
    }
  }

  return urls;
};

export const parseUrlsFromHtml = (html: string) => {
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

export const dedupeFiles = (files: File[]) => {
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
