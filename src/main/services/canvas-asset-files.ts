import { protocol } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANVAS_ASSET_PROTOCOL = "canvastool-asset";

const CACHE_ROOT = path.join(os.tmpdir(), "canvastool-assets");

const isPathInside = (candidatePath: string, rootPath: string) => {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
};

export const registerCanvasAssetProtocolPrivileges = () => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CANVAS_ASSET_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
};

export const getCanvasAssetCacheRoot = () => CACHE_ROOT;

export const canvasAssetUrlToPath = (value: string) => {
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== `${CANVAS_ASSET_PROTOCOL}:` ||
      parsed.hostname !== "local"
    ) {
      return null;
    }

    const decodedPath = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    const resolvedPath = path.resolve(decodedPath);
    const cacheRoot = getCanvasAssetCacheRoot();

    return isPathInside(resolvedPath, cacheRoot) ? resolvedPath : null;
  } catch {
    return null;
  }
};

export const toCanvasAssetUrl = (filePath: string) =>
  `${CANVAS_ASSET_PROTOCOL}://local/${encodeURIComponent(path.resolve(filePath))}`;

export const resolveLocalAssetPath = (assetPath: string) => {
  const canvasAssetPath = canvasAssetUrlToPath(assetPath);
  if (canvasAssetPath) {
    return canvasAssetPath;
  }

  if (assetPath.startsWith("file://")) {
    return fileURLToPath(assetPath);
  }

  if (path.isAbsolute(assetPath)) {
    return assetPath;
  }

  return null;
};

export const registerCanvasAssetProtocol = () => {
  protocol.registerFileProtocol(CANVAS_ASSET_PROTOCOL, (request, callback) => {
    const filePath = canvasAssetUrlToPath(request.url);
    callback(filePath ?? "");
  });
};

export const createCanvasAssetTempDir = async () => {
  const dirPath = path.join(
    getCanvasAssetCacheRoot(),
    `${Date.now()}-${randomUUID()}`,
  );
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
};

const sanitizeAssetFileName = (value: string) =>
  path
    .basename(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim() || `${randomUUID()}.png`;

export const writeCanvasAssetTempFile = async (
  tempDir: string,
  fileName: string,
  buffer: Buffer,
) => {
  const safeFileName = sanitizeAssetFileName(fileName);
  const filePath = path.join(tempDir, safeFileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  return toCanvasAssetUrl(filePath);
};
