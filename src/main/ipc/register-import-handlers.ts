import { clipboard, dialog, ipcMain, nativeImage, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
import { MAX_FETCH_SIZE_BYTES, getSenderWindow, isHttpUrl, taskImportDialogFilter, toDataUrl } from "./ipc-utils";
import { extractImageSwatchesFromSource } from "../services/image-swatch-extractor";
import {
  ensureClipboardWriteImagePayload,
  ensureImageSwatchExtractPayload,
  ensureRemoteImageFetchPayload,
} from "./ipc-validators";
import { parseImportedTasks } from "./task-transfer-utils";

export const registerImportHandlers = (window: BrowserWindow) => {
  ipcMain.handle("clipboard:write-image-data-url", (_, rawPayload) => {
    const payload = ensureClipboardWriteImagePayload(rawPayload);
    if (!payload) {
      return false;
    }

    if (!payload.dataUrl.startsWith("data:image/")) {
      return false;
    }

    const image = nativeImage.createFromDataURL(payload.dataUrl);
    if (image.isEmpty()) {
      return false;
    }

    clipboard.writeImage(image);
    return true;
  });

  ipcMain.handle("import:fetch-remote-image-data-url", async (_, rawPayload) => {
    const payload = ensureRemoteImageFetchPayload(rawPayload);
    if (!payload) {
      return null;
    }

    const rawUrl = payload.url.trim();
    if (!isHttpUrl(rawUrl)) {
      return null;
    }

    const response = await fetch(rawUrl, { redirect: "follow" });
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return null;
    }

    const contentLengthValue = response.headers.get("content-length");
    if (contentLengthValue) {
      const parsedLength = Number(contentLengthValue);
      if (
        Number.isFinite(parsedLength) &&
        parsedLength > MAX_FETCH_SIZE_BYTES
      ) {
        return null;
      }
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_FETCH_SIZE_BYTES) {
      return null;
    }

    return toDataUrl(contentType, bytes);
  });

  ipcMain.handle("import:extract-image-swatches", async (_, rawPayload) => {
    const payload = ensureImageSwatchExtractPayload(rawPayload);
    if (!payload) {
      return [];
    }

    try {
      return await extractImageSwatchesFromSource(
        payload.source,
        payload.colorCount,
      );
    } catch {
      return [];
    }
  });

  ipcMain.handle("project:import-tasks", async (event) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    const dialogResult = await dialog.showOpenDialog(targetWindow, {
      title: "Import Tasks",
      properties: ["openFile"],
      filters: taskImportDialogFilter,
    });

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return null;
    }

    const filePath = dialogResult.filePaths[0];
    const contents = await fs.readFile(filePath, "utf8");
    return parseImportedTasks(filePath, contents);
  });
};
