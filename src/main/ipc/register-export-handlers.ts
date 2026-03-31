import { dialog, ipcMain, nativeImage, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectExportResult } from "../../shared/types/ipc";
import { readSettings, setLastExportPath } from "../services/app-settings-service";
import { createAcoBuffer, renderTasksHtml } from "./export-utils";
import {
  acoDialogFilter,
  canvasImageDialogFilter,
  decodeDataUrl,
  getDefaultDocumentsPath,
  getSenderWindow,
  htmlDialogFilter,
  sanitizeFileStem,
} from "./ipc-utils";
import {
  ensureCanvasImageExportPayload,
  ensureGroupImagesExportPayload,
  ensureSwatchExportPayload,
  ensureTasksHtmlExportPayload,
} from "./ipc-validators";

const getExportDefaultPath = async (fileName: string) => {
  const settings = await readSettings();
  return settings.lastExportPath
    ? path.join(settings.lastExportPath, fileName)
    : getDefaultDocumentsPath(fileName);
};

export const registerExportHandlers = (window: BrowserWindow) => {
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

      await fs.writeFile(safePath, createAcoBuffer(payload.swatches));
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

      if (outputExtension === ".jpg" || outputExtension === ".jpeg") {
        await fs.writeFile(
          safePath,
          nativeImage.createFromDataURL(payload.dataUrl).toJPEG(92),
        );
        await setLastExportPath(path.dirname(safePath));
        return { filePath: safePath };
      }

      const finalPath =
        outputExtension === ".png" ? safePath : `${safePath}.png`;
      const { buffer } = decodeDataUrl(payload.dataUrl);
      await fs.writeFile(finalPath, buffer);
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
      const dialogResult = await dialog.showOpenDialog(targetWindow, {
        title: "Export Images to Folder",
        defaultPath,
        properties: ["openDirectory", "createDirectory"],
      });

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return null;
      }

      const folderPath = dialogResult.filePaths[0];
      await fs.mkdir(folderPath, { recursive: true });

      await Promise.all(
        payload.images.map(async (image, index) => {
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
            return;
          }

          const parsedExtension =
            path.extname(image.assetPath).replace(".", "") || "png";
          await fs.copyFile(
            image.assetPath,
            path.join(folderPath, `${safeStem}.${parsedExtension}`),
          );
        }),
      );

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
      await fs.writeFile(
        safePath,
        renderTasksHtml(payload.projectTitle, payload.tasks),
        "utf8",
      );
      await setLastExportPath(path.dirname(safePath));
      return { filePath: safePath };
    },
  );
};
