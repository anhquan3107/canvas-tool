import { clipboard, ipcMain, nativeImage } from "electron";
import { MAX_FETCH_SIZE_BYTES, isHttpUrl, toDataUrl } from "./ipc-utils";
import {
  ensureClipboardWriteImagePayload,
  ensureRemoteImageFetchPayload,
} from "./ipc-validators";

export const registerImportHandlers = () => {
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
};
