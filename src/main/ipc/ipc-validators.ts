import type {
  CanvasImageExportRequest,
  GroupImagesExportRequest,
  ImageSwatchExtractRequest,
  OpenCaptureWindowRequest,
  ProjectSaveRequest,
  RemoteImageFetchRequest,
  SwatchExportRequest,
  TasksHtmlExportRequest,
} from "../../shared/types/ipc";
import type { Project, Task } from "../../shared/types/project";

export const ensureProject = (value: unknown): Project => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid project payload.");
  }

  return value as Project;
};

export const ensureSavePayload = (value: unknown): ProjectSaveRequest => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid save payload.");
  }

  const payload = value as Record<string, unknown>;
  return {
    project: ensureProject(payload.project),
    filePath:
      typeof payload.filePath === "string" ? payload.filePath : undefined,
  };
};

export const ensureSwatchExportPayload = (
  value: unknown,
): SwatchExportRequest => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid swatch export payload.");
  }

  const payload = value as Record<string, unknown>;
  const parsedSwatches: SwatchExportRequest["swatches"] = Array.isArray(
    payload.swatches,
  )
    ? payload.swatches.flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }

        const record = entry as Record<string, unknown>;
        if (typeof record.colorHex !== "string") {
          return [];
        }

        return [
          {
            colorHex: record.colorHex,
            name: typeof record.name === "string" ? record.name : undefined,
          },
        ];
      })
    : [];

  return {
    swatches: parsedSwatches,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
};

export const ensureCanvasImageExportPayload = (
  value: unknown,
): CanvasImageExportRequest => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid canvas export payload.");
  }

  const payload = value as Record<string, unknown>;
  if (
    typeof payload.dataUrl !== "string" ||
    !payload.dataUrl.startsWith("data:")
  ) {
    throw new Error("Canvas export requires a valid data URL.");
  }

  return {
    dataUrl: payload.dataUrl,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
};

export const ensureGroupImagesExportPayload = (
  value: unknown,
): GroupImagesExportRequest => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid group image export payload.");
  }

  const payload = value as Record<string, unknown>;
  const images: GroupImagesExportRequest["images"] = Array.isArray(
    payload.images,
  )
    ? payload.images.flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }

        const record = entry as Record<string, unknown>;
        if (
          typeof record.assetPath !== "string" ||
          record.assetPath.length === 0
        ) {
          return [];
        }

        return [
          {
            assetPath: record.assetPath,
            label: typeof record.label === "string" ? record.label : undefined,
          },
        ];
      })
    : [];

  return {
    images,
    groupName:
      typeof payload.groupName === "string" ? payload.groupName : undefined,
  };
};

const isTodoItem = (value: unknown): value is Task["todos"][number] => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.text === "string" &&
    typeof record.completed === "boolean" &&
    typeof record.order === "number"
  );
};

const isTask = (value: unknown): value is Task => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.order === "number" &&
    (record.startDate === undefined || typeof record.startDate === "string") &&
    (record.endDate === undefined || typeof record.endDate === "string") &&
    Array.isArray(record.todos) &&
    record.todos.every(isTodoItem)
  );
};

export const ensureTasksHtmlExportPayload = (
  value: unknown,
): TasksHtmlExportRequest => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid task export payload.");
  }

  const payload = value as Record<string, unknown>;
  const tasks = Array.isArray(payload.tasks)
    ? payload.tasks.filter(isTask)
    : [];

  return {
    projectTitle:
      typeof payload.projectTitle === "string"
        ? payload.projectTitle
        : "CanvasTool",
    tasks,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
};

export const ensureCaptureWindowPayload = (
  rawPayload: OpenCaptureWindowRequest,
) => {
  if (
    !rawPayload ||
    typeof rawPayload !== "object" ||
    typeof rawPayload.sourceId !== "string" ||
    typeof rawPayload.sourceName !== "string" ||
    (rawPayload.sourceKind !== undefined &&
      rawPayload.sourceKind !== "window" &&
      rawPayload.sourceKind !== "screen") ||
    typeof rawPayload.quality !== "string"
  ) {
    throw new Error("Invalid capture window payload.");
  }

  return rawPayload;
};

export const ensureClipboardWriteImagePayload = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.dataUrl !== "string") {
    return null;
  }

  return { dataUrl: payload.dataUrl };
};

export const ensureRemoteImageFetchPayload = (
  value: unknown,
): RemoteImageFetchRequest | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.url !== "string") {
    return null;
  }

  return { url: payload.url };
};

export const ensureImageSwatchExtractPayload = (
  value: unknown,
): ImageSwatchExtractRequest | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.source !== "string" || payload.source.length === 0) {
    return null;
  }

  return {
    source: payload.source,
    colorCount:
      typeof payload.colorCount === "number" && Number.isFinite(payload.colorCount)
        ? payload.colorCount
        : undefined,
  };
};
