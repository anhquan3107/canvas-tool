import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type {
  ColorSwatch,
  ImageItem,
  Project,
  ReferenceGroup,
  Task,
  TodoItem,
} from "../../shared/types/project";
import {
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "../../shared/project-defaults";

const MAIN_CANVAS_GROUP_ID = "canvas-main";

interface LegacyDrawingData {
  canvasDrawings?: Record<string, string>;
}

interface LegacyCanvasSaveData {
  version: number;
  savedAt?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  items?: LegacyCanvasItemData[];
  groups?: LegacyGroupData[];
  imageCache?: Record<string, string | number[]>;
  drawingData?: LegacyDrawingData;
  tasks?: LegacyTaskData[];
  todos?: LegacyTodoData[];
  publicCanvasZoomLevel?: number;
  publicCanvasPanX?: number;
  publicCanvasPanY?: number;
}

interface LegacyCanvasItemData {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  zIndex?: number;
  originalFilePath?: string | null;
  originalFileName?: string | null;
  originalFileExtension?: string | null;
  imageId?: string | null;
  extractedColors?: string[];
  groupId?: string | null;
  showColorPalette?: boolean;
  isFlippedHorizontally?: boolean;
}

interface LegacyGroupData {
  id?: string;
  name?: string;
  icon?: string;
  color?: string;
  isExpanded?: boolean;
  itemIds?: string[];
  originalStates?: Record<string, LegacyItemStateData>;
  canvasWidth?: number;
  canvasHeight?: number;
  zoomLevel?: number;
  panX?: number;
  panY?: number;
}

interface LegacyItemStateData {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

interface LegacyTaskData {
  id?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  isCompleted?: boolean;
  linkedCanvasId?: string | null;
  linkedCanvasName?: string | null;
  todoListId?: string;
}

interface LegacyTodoData {
  id?: string;
  text?: string;
  isCompleted?: boolean;
  createdDate?: string;
  completedDate?: string | null;
  taskDeadlineId?: string | null;
}

interface LegacyImageBase {
  id: string;
  assetPath: string;
  source: ImageItem["source"];
  label?: string;
  originalWidth?: number;
  originalHeight?: number;
  fileSizeBytes?: number;
  format?: string;
  flippedX: boolean;
  swatchHex?: string;
  swatches?: ColorSwatch[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const isLegacyCanvasSaveData = (value: unknown): value is LegacyCanvasSaveData => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.version === "number" &&
    (value.items === undefined || Array.isArray(value.items)) &&
    (value.groups === undefined || Array.isArray(value.groups))
  );
};

const toPositiveNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;

const toFiniteNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toOptionalIsoString = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
};

const normalizeImageFormatLabel = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  const cleaned = value
    .trim()
    .replace(/^image\//i, "")
    .replace(/^\./, "")
    .toLowerCase();
  switch (cleaned) {
    case "jpeg":
    case "jpg":
      return "JPG";
    case "png":
      return "PNG";
    case "gif":
      return "GIF";
    case "bmp":
      return "BMP";
    case "webp":
      return "WEBP";
    case "tif":
    case "tiff":
      return "TIFF";
    case "ico":
      return "ICO";
    case "avif":
      return "AVIF";
    default:
      return cleaned ? cleaned.toUpperCase() : undefined;
  }
};

const inferMimeTypeFromExtension = (extension?: string | null) => {
  switch ((extension ?? "").trim().toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".webp":
      return "image/webp";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    case ".ico":
      return "image/x-icon";
    case ".avif":
      return "image/avif";
    default:
      return null;
  }
};

const inferMimeTypeFromBuffer = (buffer: Buffer) => {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 6 &&
    buffer.subarray(0, 3).toString("ascii") === "GIF"
  ) {
    return "image/gif";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return "image/bmp";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x01 &&
    buffer[3] === 0x00
  ) {
    return "image/x-icon";
  }

  if (
    buffer.length >= 12 &&
    ((buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
      buffer.subarray(8, 12).toString("ascii").startsWith("av")) ||
      buffer.subarray(8, 12).toString("ascii") === "avis")
  ) {
    return "image/avif";
  }

  return "image/png";
};

const decodeLegacyImageBytes = (value: string | number[] | undefined) => {
  if (typeof value === "string") {
    try {
      return Buffer.from(value, "base64");
    } catch {
      return null;
    }
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === "number")) {
    return Buffer.from(value);
  }

  return null;
};

const toDataUrl = (buffer: Buffer, mimeType: string) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const buildSwatches = (colors: string[] | undefined): ColorSwatch[] | undefined => {
  if (!Array.isArray(colors) || colors.length === 0) {
    return undefined;
  }

  const seen = new Set<string>();
  const swatches = colors.flatMap((colorHex) => {
    if (typeof colorHex !== "string") {
      return [];
    }

    const normalized = colorHex.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) {
      return [];
    }

    seen.add(normalized.toLowerCase());
    return [
      {
        id: randomUUID(),
        colorHex: normalized,
        origin: "image" as const,
      },
    ];
  });

  return swatches.length > 0 ? swatches : undefined;
};

const sortItemsByZIndex = <T extends { zIndex: number }>(items: T[]) =>
  [...items].sort((left, right) => left.zIndex - right.zIndex);

const coerceGroupName = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

const createLegacyImageBase = async (
  item: LegacyCanvasItemData,
  imageCache: LegacyCanvasSaveData["imageCache"],
): Promise<LegacyImageBase | null> => {
  const imageBuffer =
    decodeLegacyImageBytes(item.imageId ? imageCache?.[item.imageId] : undefined) ??
    (typeof item.originalFilePath === "string" && item.originalFilePath.length > 0
      ? await fs.readFile(item.originalFilePath).catch(() => null)
      : null);

  if (!imageBuffer) {
    return null;
  }

  const extension =
    item.originalFileExtension ??
    (typeof item.originalFilePath === "string" ? path.extname(item.originalFilePath) : "") ??
    "";
  const mimeType =
    inferMimeTypeFromExtension(extension) ?? inferMimeTypeFromBuffer(imageBuffer);
  const swatches = buildSwatches(item.extractedColors);
  const label =
    (typeof item.originalFileName === "string" && item.originalFileName.trim().length > 0
      ? item.originalFileName.trim()
      : undefined) ??
    (typeof item.originalFilePath === "string" && item.originalFilePath.length > 0
      ? path.basename(item.originalFilePath)
      : undefined);

  return {
    id:
      typeof item.id === "string" && item.id.trim().length > 0
        ? item.id
        : randomUUID(),
    assetPath: toDataUrl(imageBuffer, mimeType),
    source: "local",
    label,
    originalWidth: toPositiveNumber(item.width, toPositiveNumber(item.displayWidth, 320)),
    originalHeight: toPositiveNumber(item.height, toPositiveNumber(item.displayHeight, 240)),
    fileSizeBytes: imageBuffer.length,
    format: normalizeImageFormatLabel(extension) ?? normalizeImageFormatLabel(mimeType),
    flippedX: Boolean(item.isFlippedHorizontally),
    swatchHex: swatches?.[0]?.colorHex,
    swatches,
  };
};

const materializeImageItem = (
  base: LegacyImageBase,
  item: LegacyCanvasItemData,
  stateOverride?: LegacyItemStateData,
): ImageItem => {
  const visibleWidth = toPositiveNumber(
    stateOverride?.width,
    toPositiveNumber(item.displayWidth, toPositiveNumber(item.width, 320)),
  );
  const visibleHeight = toPositiveNumber(
    stateOverride?.height,
    toPositiveNumber(item.displayHeight, toPositiveNumber(item.height, 240)),
  );

  return {
    id: base.id,
    type: "image",
    source: base.source,
    assetPath: base.assetPath,
    label: base.label,
    originalWidth: base.originalWidth,
    originalHeight: base.originalHeight,
    fileSizeBytes: base.fileSizeBytes,
    format: base.format,
    swatchHex: base.swatchHex,
    swatches: base.swatches,
    x: Math.round(toFiniteNumber(stateOverride?.x, toFiniteNumber(item.x))),
    y: Math.round(toFiniteNumber(stateOverride?.y, toFiniteNumber(item.y))),
    width: Math.round(visibleWidth),
    height: Math.round(visibleHeight),
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    flippedX: base.flippedX,
    locked: false,
    visible: true,
    zIndex: Math.round(toFiniteNumber(stateOverride?.zIndex, toFiniteNumber(item.zIndex))),
  };
};

const buildTodoMap = (todos: LegacyTodoData[] | undefined) => {
  const todosByTaskId = new Map<string, LegacyTodoData[]>();

  for (const todo of todos ?? []) {
    if (!todo || typeof todo.taskDeadlineId !== "string" || todo.taskDeadlineId.length === 0) {
      continue;
    }

    const bucket = todosByTaskId.get(todo.taskDeadlineId) ?? [];
    bucket.push(todo);
    todosByTaskId.set(todo.taskDeadlineId, bucket);
  }

  return todosByTaskId;
};

const mapLinkedGroupId = (
  task: LegacyTaskData,
  groups: ReferenceGroup[],
) => {
  if (
    typeof task.linkedCanvasId === "string" &&
    groups.some((group) => group.id === task.linkedCanvasId)
  ) {
    return task.linkedCanvasId;
  }

  if (
    typeof task.linkedCanvasId === "string" &&
    task.linkedCanvasId.trim().toLowerCase() === MAIN_CANVAS_GROUP_ID
  ) {
    return MAIN_CANVAS_GROUP_ID;
  }

  if (typeof task.linkedCanvasName !== "string" || task.linkedCanvasName.trim().length === 0) {
    return undefined;
  }

  const normalizedName = task.linkedCanvasName.trim().toLowerCase();
  const matchedGroup = groups.find(
    (group) => group.name.trim().toLowerCase() === normalizedName,
  );

  if (matchedGroup) {
    return matchedGroup.id;
  }

  if (normalizedName === "canvas" || normalizedName === "main canvas") {
    return MAIN_CANVAS_GROUP_ID;
  }

  return undefined;
};

export const loadLegacyCanvasProject = async (
  raw: Buffer,
  sourcePath: string,
): Promise<Project> => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(gunzipSync(raw).toString("utf8"));
  } catch {
    throw new Error("Unsupported legacy .canvas format.");
  }

  if (!isLegacyCanvasSaveData(parsed)) {
    throw new Error("Legacy .canvas file is missing expected save data.");
  }

  const savedAt = toOptionalIsoString(parsed.savedAt) ?? new Date().toISOString();
  const itemDataById = new Map<string, LegacyCanvasItemData>();
  const imageBases = new Map<string, LegacyImageBase>();

  await Promise.all(
    (parsed.items ?? []).map(async (item) => {
      const base = await createLegacyImageBase(item, parsed.imageCache);
      if (!base) {
        return;
      }

      imageBases.set(base.id, base);
      itemDataById.set(base.id, item);
    }),
  );

  const assignedItemIds = new Set<string>();
  const groups: ReferenceGroup[] = [];

  const canvasGroup: ReferenceGroup = {
    id: MAIN_CANVAS_GROUP_ID,
    name: "Canvas",
    kind: "canvas",
    order: 0,
    locked: false,
    canvasColor: DEFAULT_GROUP_CANVAS_COLOR,
    backgroundColor: DEFAULT_GROUP_BACKGROUND_COLOR,
    canvasSize: {
      width: Math.round(toPositiveNumber(parsed.canvasWidth, 980)),
      height: Math.round(toPositiveNumber(parsed.canvasHeight, 640)),
    },
    zoom: toFiniteNumber(parsed.publicCanvasZoomLevel, 1),
    panX: toFiniteNumber(parsed.publicCanvasPanX),
    panY: toFiniteNumber(parsed.publicCanvasPanY),
    layoutMode: "pinterest-dynamic",
    filters: {
      blur: 0,
      grayscale: 0,
    },
    items: [],
    annotations: [],
    extractedSwatches: [],
  };

  groups.push(canvasGroup);

  (parsed.groups ?? []).forEach((groupData, index) => {
    const itemIds = Array.isArray(groupData.itemIds) ? groupData.itemIds : [];
    const groupItems = sortItemsByZIndex(
      itemIds.flatMap((itemId) => {
        const item = itemDataById.get(itemId);
        const base = imageBases.get(itemId);

        if (!item || !base) {
          return [];
        }

        assignedItemIds.add(itemId);
        return [materializeImageItem(base, item, groupData.originalStates?.[itemId])];
      }),
    );

    groups.push({
      id:
        typeof groupData.id === "string" && groupData.id.trim().length > 0
          ? groupData.id
          : randomUUID(),
      name: coerceGroupName(groupData.name, `Group ${index + 1}`),
      kind: "group",
      order: index + 1,
      locked: false,
      icon:
        typeof groupData.icon === "string" && groupData.icon.trim().length > 0
          ? groupData.icon
          : undefined,
      accentColor:
        typeof groupData.color === "string" && groupData.color.trim().length > 0
          ? groupData.color
          : undefined,
      canvasColor: DEFAULT_GROUP_CANVAS_COLOR,
      backgroundColor: DEFAULT_GROUP_BACKGROUND_COLOR,
      canvasSize: {
        width: Math.round(
          toPositiveNumber(groupData.canvasWidth, canvasGroup.canvasSize.width),
        ),
        height: Math.round(
          toPositiveNumber(groupData.canvasHeight, canvasGroup.canvasSize.height),
        ),
      },
      zoom: toFiniteNumber(groupData.zoomLevel, 1),
      panX: toFiniteNumber(groupData.panX),
      panY: toFiniteNumber(groupData.panY),
      layoutMode: "pinterest-dynamic",
      filters: {
        blur: 0,
        grayscale: 0,
      },
      items: groupItems,
      annotations: [],
      extractedSwatches: [],
    });
  });

  canvasGroup.items = sortItemsByZIndex(
    [...imageBases.entries()].flatMap(([itemId, base]) => {
      if (assignedItemIds.has(itemId)) {
        return [];
      }

      const item = itemDataById.get(itemId);
      if (!item) {
        return [];
      }

      return [materializeImageItem(base, item)];
    }),
  );

  const todosByTaskId = buildTodoMap(parsed.todos);
  const tasks: Task[] = (parsed.tasks ?? []).map((task, index) => {
    const taskId =
      typeof task.id === "string" && task.id.trim().length > 0
        ? task.id
        : randomUUID();
    const todos = (todosByTaskId.get(taskId) ?? []).map<TodoItem>((todo, todoIndex) => ({
      id:
        typeof todo.id === "string" && todo.id.trim().length > 0
          ? todo.id
          : randomUUID(),
      text: typeof todo.text === "string" ? todo.text : "",
      completed: Boolean(todo.isCompleted),
      order: todoIndex,
      createdAt: toOptionalIsoString(todo.createdDate),
      completedAt: toOptionalIsoString(todo.completedDate ?? undefined),
    }));

    return {
      id: taskId,
      title:
        typeof task.title === "string" && task.title.trim().length > 0
          ? task.title
          : `Task ${index + 1}`,
      order: index,
      completed: Boolean(task.isCompleted),
      startDate: toOptionalIsoString(task.startDate),
      endDate: toOptionalIsoString(task.endDate),
      linkedGroupId: mapLinkedGroupId(task, groups),
      todos,
    };
  });

  const expandedGroup = (parsed.groups ?? []).find((group) => group.isExpanded);

  return {
    id: randomUUID(),
    version: 1,
    filePath: sourcePath,
    title: path.basename(sourcePath, path.extname(sourcePath)),
    canvasSize: { ...canvasGroup.canvasSize },
    activeGroupId:
      typeof expandedGroup?.id === "string" && groups.some((group) => group.id === expandedGroup.id)
        ? expandedGroup.id
        : MAIN_CANVAS_GROUP_ID,
    groups,
    tasks,
    createdAt: savedAt,
    updatedAt: savedAt,
    legacy: {
      sourceFormat: "legacy-optimized-canvas",
      sourceVersion: parsed.version,
      drawingCanvasById: parsed.drawingData?.canvasDrawings ?? {},
    },
  };
};
