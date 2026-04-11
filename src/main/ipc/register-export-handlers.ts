import {
  dialog,
  ipcMain,
  nativeImage,
  type BrowserWindow,
  type OpenDialogOptions,
} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectExportResult } from "../../shared/types/ipc";
import { readSettings, setLastExportPath } from "../services/app-settings-service";
import { createAcoBuffer } from "./export-utils";
import {
  acoDialogFilter,
  canvasImageDialogFilter,
  decodeDataUrl,
  getDefaultDocumentsPath,
  getSenderWindow,
  htmlDialogFilter,
  textDialogFilter,
  sanitizeFileStem,
} from "./ipc-utils";
import {
  ensureCanvasImageExportPayload,
  ensureGroupImagesExportPayload,
  ensureSwatchExportPayload,
  ensureTasksHtmlExportPayload,
  ensureTasksTxtExportPayload,
} from "./ipc-validators";
import { renderTasksHtml, renderTasksTxt } from "./task-transfer-utils";

const getExportDefaultPath = async (fileName: string) => {
  const settings = await readSettings();
  return settings.lastExportPath
    ? path.join(settings.lastExportPath, fileName)
    : getDefaultDocumentsPath(fileName);
};

export const registerExportHandlers = (window: BrowserWindow) => {
  const sendOperationProgress = (
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
    message: string,
    progress: number,
  ) => {
    event.sender.send("project:operation-progress", {
      message,
      progress,
    });
  };

  ipcMain.handle(
    "project:export-swatch-aco",
    async (event, rawPayload: unknown): Promise<ProjectExportResult | null> => {
      const targetWindow = getSenderWindow(event.sender) ?? window;
      const payload = ensureSwatchExportPayload(rawPayload);
      if (payload.swatches.length === 0) {
        throw new Error("No swatches selected for export.");
      }
      const defaultStem =
        sanitizeFileStem(payload.name ?? "Swatch") || "Swatch";
      const defaultFileName = `${defaultStem}.aco`;
      let dialogResult;
      const defaultPath = await getExportDefaultPath(defaultFileName);

      try {
        dialogResult = await dialog.showSaveDialog(targetWindow, {
          defaultPath,
          filters: acoDialogFilter,
        });
      } catch {
        dialogResult = await dialog.showSaveDialog({
          defaultPath,
          filters: acoDialogFilter,
        });
      }

      if (dialogResult.canceled || !dialogResult.filePath) {
        return null;
      }

      const safePath = dialogResult.filePath.endsWith(".aco")
        ? dialogResult.filePath
        : `${dialogResult.filePath}.aco`;

      sendOperationProgress(event, "Exporting swatches 20%", 20);
      await fs.writeFile(safePath, createAcoBuffer(payload.swatches));
      sendOperationProgress(event, "Exporting swatches 86%", 86);
      await setLastExportPath(path.dirname(safePath));
      return { filePath: safePath };
    },
  );

  ipcMain.handle(
    "project:export-canvas-image",
    async (event, rawPayload: unknown): Promise<ProjectExportResult | null> => {
      const targetWindow = getSenderWindow(event.sender) ?? window;
      const payload = ensureCanvasImageExportPayload(rawPayload);
      const defaultStem =
        sanitizeFileStem(payload.name ?? "Canvas") || "Canvas";
      const defaultPath = await getExportDefaultPath(`${defaultStem}.png`);
      const dialogResult = await dialog.showSaveDialog(targetWindow, {
        defaultPath,
        filters: canvasImageDialogFilter,
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return null;
      }

      const requestedExtension = path
        .extname(dialogResult.filePath)
        .toLowerCase();
      const safePath = requestedExtension
        ? dialogResult.filePath
        : `${dialogResult.filePath}.png`;
      const outputExtension = path.extname(safePath).toLowerCase();

      sendOperationProgress(event, "Exporting canvas image 18%", 18);
      if (outputExtension === ".jpg" || outputExtension === ".jpeg") {
        await fs.writeFile(
          safePath,
          nativeImage.createFromDataURL(payload.dataUrl).toJPEG(92),
        );
        sendOperationProgress(event, "Exporting canvas image 86%", 86);
        await setLastExportPath(path.dirname(safePath));
        return { filePath: safePath };
      }

      const finalPath =
        outputExtension === ".png" ? safePath : `${safePath}.png`;
      const { buffer } = decodeDataUrl(payload.dataUrl);
      await fs.writeFile(finalPath, buffer);
      sendOperationProgress(event, "Exporting canvas image 86%", 86);
      await setLastExportPath(path.dirname(finalPath));
      return { filePath: finalPath };
    },
  );

  ipcMain.handle(
    "project:export-group-images",
    async (event, rawPayload: unknown): Promise<ProjectExportResult | null> => {
      const targetWindow = getSenderWindow(event.sender) ?? window;
      const payload = ensureGroupImagesExportPayload(rawPayload);
      if (payload.images.length === 0) {
        throw new Error("No images available to export.");
      }

      const defaultFolder =
        sanitizeFileStem(payload.groupName ?? "Canvas Images") ||
        "Canvas Images";
      const defaultPath = await getExportDefaultPath(defaultFolder);
      const dialogOptions: OpenDialogOptions = {
        title: "Export Images to Folder",
        properties: ["openDirectory", "createDirectory"],
      };
      if (process.platform !== "win32") {
        dialogOptions.defaultPath = defaultPath;
      }
      const dialogResult = await dialog.showOpenDialog(targetWindow, dialogOptions);

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return null;
      }

      const folderPath = dialogResult.filePaths[0];
      await fs.mkdir(folderPath, { recursive: true });

      sendOperationProgress(event, "Exporting images 16%", 16);

      for (const [index, image] of payload.images.entries()) {
        const safeStem =
          sanitizeFileStem(image.label ?? `Image ${index + 1}`) ||
          `Image ${index + 1}`;

        if (image.assetPath.startsWith("data:")) {
          const { mimeType, buffer } = decodeDataUrl(image.assetPath);
          const extension =
            mimeType === "image/jpeg"
              ? "jpg"
              : mimeType === "image/webp"
                ? "webp"
                : "png";
          await fs.writeFile(
            path.join(folderPath, `${safeStem}.${extension}`),
            buffer,
          );
        } else {
          const parsedExtension =
            path.extname(image.assetPath).replace(".", "") || "png";
          await fs.copyFile(
            image.assetPath,
            path.join(folderPath, `${safeStem}.${parsedExtension}`),
          );
        }

        const progress = Math.min(
          92,
          Math.round(((index + 1) / payload.images.length) * 76) + 16,
        );
        sendOperationProgress(
          event,
          `Exporting images ${progress}%`,
          progress,
        );
      }

      await setLastExportPath(folderPath);
      return { filePath: folderPath };
    },
  );

  ipcMain.handle(
    "project:export-tasks-html",
    async (event, rawPayload: unknown): Promise<ProjectExportResult | null> => {
      const targetWindow = getSenderWindow(event.sender) ?? window;
      const payload = ensureTasksHtmlExportPayload(rawPayload);
      const defaultStem =
        sanitizeFileStem(payload.name ?? `${payload.projectTitle}`) || "Tasks";
      const defaultPath = await getExportDefaultPath(`${defaultStem}.html`);
      const dialogResult = await dialog.showSaveDialog(targetWindow, {
        defaultPath,
        filters: htmlDialogFilter,
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return null;
      }

      const safePath = dialogResult.filePath.endsWith(".html")
        ? dialogResult.filePath
        : `${dialogResult.filePath}.html`;
      sendOperationProgress(event, "Exporting task HTML 18%", 18);
      await fs.writeFile(
        safePath,
        renderTasksHtml(payload.projectTitle, payload.tasks),
        "utf8",
      );
      sendOperationProgress(event, "Exporting task HTML 86%", 86);
      await setLastExportPath(path.dirname(safePath));
      return { filePath: safePath };
    },
  );

  ipcMain.handle(
    "project:export-tasks-txt",
    async (event, rawPayload: unknown): Promise<ProjectExportResult | null> => {
      const targetWindow = getSenderWindow(event.sender) ?? window;
      const payload = ensureTasksTxtExportPayload(rawPayload);
      const defaultStem =
        sanitizeFileStem(payload.name ?? `${payload.projectTitle}`) || "Tasks";
      const defaultPath = await getExportDefaultPath(`${defaultStem}.txt`);
      const dialogResult = await dialog.showSaveDialog(targetWindow, {
        defaultPath,
        filters: textDialogFilter,
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return null;
      }

      const safePath = dialogResult.filePath.endsWith(".txt")
        ? dialogResult.filePath
        : `${dialogResult.filePath}.txt`;
      sendOperationProgress(event, "Exporting task TXT 18%", 18);
      await fs.writeFile(
        safePath,
        renderTasksTxt(payload.projectTitle, payload.tasks),
        "utf8",
      );
      sendOperationProgress(event, "Exporting task TXT 86%", 86);
      await setLastExportPath(path.dirname(safePath));
      return { filePath: safePath };
    },
  );
};
