import { dialog, ipcMain, nativeImage, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectExportResult } from "../../shared/types/ipc";
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

      try {
        dialogResult = await dialog.showSaveDialog(targetWindow, {
          defaultPath: getDefaultDocumentsPath(defaultFileName),
          filters: acoDialogFilter,
        });
      } catch {
        dialogResult = await dialog.showSaveDialog({
          defaultPath: getDefaultDocumentsPath("Swatch.aco"),
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
      const dialogResult = await dialog.showSaveDialog(targetWindow, {
        defaultPath: getDefaultDocumentsPath(`${defaultStem}.png`),
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
        return { filePath: safePath };
      }

      const finalPath =
        outputExtension === ".png" ? safePath : `${safePath}.png`;
      const { buffer } = decodeDataUrl(payload.dataUrl);
      await fs.writeFile(finalPath, buffer);
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
      const dialogResult = await dialog.showOpenDialog(targetWindow, {
        title: "Export Images to Folder",
        defaultPath: getDefaultDocumentsPath(defaultFolder),
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
      const dialogResult = await dialog.showSaveDialog(targetWindow, {
        defaultPath: getDefaultDocumentsPath(`${defaultStem}.html`),
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
      return { filePath: safePath };
    },
  );
};
