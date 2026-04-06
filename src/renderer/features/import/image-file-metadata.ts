import {
  isImportableImageSource,
  normalizeUrlCandidate,
  toUrlFingerprint,
} from "@renderer/features/import/image-format";

export const parseUrlText = (input: string) => {
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

const parseSrcSet = (srcset: string) =>
  srcset
    .split(",")
    .map((entry) => entry.trim())
    .map((entry) => entry.split(/\s+/)[0])
    .map((entry) => normalizeUrlCandidate(entry))
    .filter((candidate) => candidate.length > 0)
    .filter(isImportableImageSource);

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
