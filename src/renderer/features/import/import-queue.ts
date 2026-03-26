import type { Project } from "@shared/types/project";
import type { ImportPayload } from "@renderer/features/import/image-import";

export interface ImportQueueEntry {
  id: string;
  source: ImportPayload["source"];
  groupId: string;
  importedCount: number;
  blockedItemIds: string[];
  createdAt: string;
}

const IMPORT_QUEUE_STORAGE_PREFIX = "canvastool.import-queue.v1";
export const blockedSuffix = " (preview blocked)";

export const toImportQueueStorageKey = (project: Project) => {
  const projectScope = project.filePath ?? project.id;
  return `${IMPORT_QUEUE_STORAGE_PREFIX}:${projectScope}`;
};

const isImportQueueEntry = (value: unknown): value is ImportQueueEntry => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    (record.source === "drop" || record.source === "clipboard") &&
    typeof record.groupId === "string" &&
    typeof record.importedCount === "number" &&
    Array.isArray(record.blockedItemIds) &&
    record.blockedItemIds.every((item) => typeof item === "string") &&
    typeof record.createdAt === "string"
  );
};

export const loadImportQueueFromSession = (
  storageKey: string,
): ImportQueueEntry[] => {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isImportQueueEntry).slice(0, 12);
  } catch {
    return [];
  }
};

export const persistImportQueueToSession = (
  storageKey: string,
  queue: ImportQueueEntry[],
) => {
  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify(queue.slice(0, 12)),
    );
  } catch {
    return;
  }
};

export const normalizePreviewSize = (width: number, height: number) => {
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

export const measureImageSize = (source: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || 320,
        height: image.naturalHeight || 240,
      });
    image.onerror = () => reject(new Error("Failed to decode image preview."));
    image.src = source;
  });

export const stripBlockedSuffix = (value: string | undefined) => {
  if (!value) {
    return value;
  }

  return value.endsWith(blockedSuffix)
    ? value.slice(0, -blockedSuffix.length)
    : value;
};
