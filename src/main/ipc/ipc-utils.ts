import { BrowserWindow, app, screen, type WebContents } from "electron";
import path from "node:path";
import type { OpenCaptureWindowRequest } from "../../shared/types/ipc";
import type { Project } from "../../shared/types/project";

export const canvasDialogFilter = [
  { name: "CanvasTool Project", extensions: ["canvas"] },
];

export const acoDialogFilter = [
  { name: "Adobe Color Swatch", extensions: ["aco"] },
];

export const canvasImageDialogFilter = [
  { name: "PNG Image", extensions: ["png"] },
  { name: "JPEG Image", extensions: ["jpg", "jpeg"] },
];

export const htmlDialogFilter = [
  { name: "HTML Document", extensions: ["html"] },
];

export const textDialogFilter = [
  { name: "Text Document", extensions: ["txt"] },
];

export const taskImportDialogFilter = [
  { name: "CanvasTool Task Transfer", extensions: ["html", "txt"] },
  { name: "HTML Document", extensions: ["html"] },
  { name: "Text Document", extensions: ["txt"] },
];

export const MAX_FETCH_SIZE_BYTES = 25 * 1024 * 1024;

export const sanitizeFileStem = (value: string) =>
  value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);

export const decodeDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(
    /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/,
  );
  if (!match) {
    throw new Error("Invalid data URL payload.");
  }

  const mimeType = match[1] ?? "application/octet-stream";
  return {
    mimeType,
    buffer: Buffer.from(match[2], "base64"),
  };
};

export const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const toDataUrl = (contentType: string, buffer: Buffer) => {
  const type = contentType.split(";")[0].trim() || "image/png";
  const base64 = buffer.toString("base64");
  return `data:${type};base64,${base64}`;
};

export const getSenderWindow = (sender: WebContents) =>
  BrowserWindow.fromWebContents(sender);

const CAPTURE_WINDOW_MIN_EDGE = 220;
const CAPTURE_WINDOW_WORKAREA_MARGIN = 48;
const CAPTURE_WINDOW_DEFAULT_WIDTH_RATIO = 0.62;
const CAPTURE_WINDOW_DEFAULT_HEIGHT_RATIO = 0.58;
const CAPTURE_WINDOW_DEFAULT_MAX_WIDTH = 1120;
const CAPTURE_WINDOW_DEFAULT_MAX_HEIGHT = 760;

export const normalizeCaptureSourceSize = (
  sourceWidth?: number,
  sourceHeight?: number,
) => ({
  width: Math.max(1, Math.round(sourceWidth ?? 1280)),
  height: Math.max(1, Math.round(sourceHeight ?? 720)),
});

export const getCaptureWindowMinimumSize = (sourceSize: {
  width: number;
  height: number;
}) => {
  const scale = Math.max(
    CAPTURE_WINDOW_MIN_EDGE / Math.max(1, sourceSize.width),
    CAPTURE_WINDOW_MIN_EDGE / Math.max(1, sourceSize.height),
  );

  return {
    width: Math.max(160, Math.round(sourceSize.width * scale)),
    height: Math.max(160, Math.round(sourceSize.height * scale)),
  };
};

export const getCaptureWindowBoundsForSource = (
  sourceSize: { width: number; height: number },
  scale = 1,
) => {
  const desiredWidth = Math.max(1, sourceSize.width * scale);
  const desiredHeight = Math.max(1, sourceSize.height * scale);
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const maxWidth = Math.max(320, workArea.width - CAPTURE_WINDOW_WORKAREA_MARGIN);
  const maxHeight = Math.max(220, workArea.height - CAPTURE_WINDOW_WORKAREA_MARGIN);
  const fitScale = Math.min(1, maxWidth / desiredWidth, maxHeight / desiredHeight);

  return {
    width: Math.max(160, Math.round(desiredWidth * fitScale)),
    height: Math.max(160, Math.round(desiredHeight * fitScale)),
  };
};

export const getCaptureWindowBoundsWithinBox = (
  sourceSize: { width: number; height: number },
  targetBox: { width: number; height: number },
) => {
  const normalizedSourceSize = normalizeCaptureSourceSize(
    sourceSize.width,
    sourceSize.height,
  );
  const boundedWidth = Math.max(160, Math.round(targetBox.width));
  const boundedHeight = Math.max(160, Math.round(targetBox.height));
  const fitScale = Math.min(
    boundedWidth / Math.max(1, normalizedSourceSize.width),
    boundedHeight / Math.max(1, normalizedSourceSize.height),
  );

  return {
    width: Math.max(160, Math.round(normalizedSourceSize.width * fitScale)),
    height: Math.max(160, Math.round(normalizedSourceSize.height * fitScale)),
  };
};

const getCaptureWindowDefaultTargetBox = () => {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const availableWidth = Math.max(
    320,
    workArea.width - CAPTURE_WINDOW_WORKAREA_MARGIN,
  );
  const availableHeight = Math.max(
    220,
    workArea.height - CAPTURE_WINDOW_WORKAREA_MARGIN,
  );

  return {
    width: Math.min(
      availableWidth,
      Math.min(
        CAPTURE_WINDOW_DEFAULT_MAX_WIDTH,
        Math.round(availableWidth * CAPTURE_WINDOW_DEFAULT_WIDTH_RATIO),
      ),
    ),
    height: Math.min(
      availableHeight,
      Math.min(
        CAPTURE_WINDOW_DEFAULT_MAX_HEIGHT,
        Math.round(availableHeight * CAPTURE_WINDOW_DEFAULT_HEIGHT_RATIO),
      ),
    ),
  };
};

export const getCaptureWindowBounds = (payload: OpenCaptureWindowRequest) => {
  return getCaptureWindowBoundsWithinBox(
    normalizeCaptureSourceSize(payload.sourceWidth, payload.sourceHeight),
    getCaptureWindowDefaultTargetBox(),
  );
};

export const updateWindowTitle = (
  window: BrowserWindow | null,
  project: Project,
) => {
  const fileName = project.filePath
    ? path.basename(project.filePath)
    : "Untitled.canvas";
  window?.setTitle(`CanvasTool - ${fileName}`);
};

export const getDefaultDocumentsPath = (fileName: string) =>
  path.join(app.getPath("documents"), fileName);
