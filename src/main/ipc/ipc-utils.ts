import { BrowserWindow, app, type WebContents } from "electron";
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

export const getCaptureWindowBounds = (payload: OpenCaptureWindowRequest) => {
  const sourceWidth = Math.max(320, payload.sourceWidth ?? 1280);
  const sourceHeight = Math.max(180, payload.sourceHeight ?? 720);
  const aspectRatio = sourceWidth / sourceHeight || 16 / 9;
  const maxWidth = 1320;
  const maxHeight = 920;
  const minWidth = 760;
  const preferredWidth = Math.min(maxWidth, Math.max(minWidth, sourceWidth));
  const preferredHeight = Math.round(preferredWidth / aspectRatio);

  if (preferredHeight <= maxHeight) {
    return {
      width: preferredWidth,
      height: Math.max(520, preferredHeight + 52),
    };
  }

  const fittedHeight = maxHeight;
  return {
    width: Math.round(fittedHeight * aspectRatio),
    height: fittedHeight + 52,
  };
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
