import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import type { ImageItem, Project, ReferenceGroup } from "../../shared/types/project";
import {
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "../../shared/project-defaults";
import {
  createCanvasAssetTempDir,
  resolveLocalAssetPath,
  writeCanvasAssetTempFile,
} from "../services/canvas-asset-files";
import { buildImageAssetVariantsFromBuffer } from "../services/image-asset-variants";
import { loadLegacyCanvasProject } from "./legacy-canvas-project";

interface CanvasManifest {
  id: string;
  version: number;
  title: string;
  canvasSize: Project["canvasSize"];
  activeGroupId: string;
  groupFiles: string[];
  createdAt: string;
  updatedAt: string;
  formatVersion: number;
}

const FORMAT_VERSION = 2;
const PACKAGE_ASSET_DIR = "assets";
const PACKAGE_ORIGINAL_ASSET_DIR = `${PACKAGE_ASSET_DIR}/original`;
const PACKAGE_PREVIEW_ASSET_DIR = `${PACKAGE_ASSET_DIR}/preview`;
const PACKAGE_THUMBNAIL_ASSET_DIR = `${PACKAGE_ASSET_DIR}/thumbnail`;

const decodeDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(
    /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/,
  );
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1] ?? "application/octet-stream",
    buffer: Buffer.from(match[2], "base64"),
  };
};

const extensionFromMimeType = (mimeType?: string | null) => {
  switch ((mimeType ?? "").toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/bmp":
      return "bmp";
    case "image/webp":
      return "webp";
    case "image/tiff":
      return "tiff";
    case "image/x-icon":
      return "ico";
    case "image/avif":
      return "avif";
    default:
      return null;
  }
};

const extensionFromFormatLabel = (format?: string) => {
  switch ((format ?? "").trim().toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "gif":
      return "gif";
    case "bmp":
      return "bmp";
    case "webp":
      return "webp";
    case "tif":
    case "tiff":
      return "tiff";
    case "ico":
      return "ico";
    case "avif":
      return "avif";
    default:
      return null;
  }
};

const getImageAssetExtension = (
  item: ImageItem,
  assetPath: string,
  mimeType?: string | null,
) => {
  const localPath = resolveLocalAssetPath(assetPath);
  const extension =
    (localPath ? path.extname(localPath) : path.extname(assetPath))
      .replace(".", "")
      .toLowerCase() ||
    extensionFromMimeType(mimeType) ||
    extensionFromFormatLabel(item.format);

  return extension || "png";
};

const toPackageAssetPath = (
  item: ImageItem,
  assetIndex: number,
  extension: string,
  directory = PACKAGE_ORIGINAL_ASSET_DIR,
) => {
  const safeId =
    item.id.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-") ||
    `image-${assetIndex + 1}`;
  return `${directory}/${String(assetIndex).padStart(4, "0")}-${safeId}.${extension}`;
};

const isPackageAssetPath = (assetPath: string) => {
  const normalized = assetPath.replace(/\\/g, "/");
  return (
    normalized.startsWith(`${PACKAGE_ASSET_DIR}/`) &&
    !normalized.split("/").includes("..")
  );
};

const readImageAssetForSave = async (item: ImageItem) => {
  if (!item.assetPath) {
    return null;
  }

  const decoded = item.assetPath.startsWith("data:")
    ? decodeDataUrl(item.assetPath)
    : null;
  if (decoded) {
    return {
      buffer: decoded.buffer,
      extension: getImageAssetExtension(item, item.assetPath, decoded.mimeType),
    };
  }

  const sourcePath = resolveLocalAssetPath(item.assetPath);
  if (!sourcePath) {
    return null;
  }

  return {
    buffer: await fs.readFile(sourcePath),
    extension: getImageAssetExtension(item, sourcePath),
  };
};

const readImageSaveAssets = async (item: ImageItem) => {
  const original = await readImageAssetForSave(item);
  if (!original) {
    return null;
  }

  const variants = await buildImageAssetVariantsFromBuffer(
    original.buffer,
    original.extension,
  );

  return {
    original,
    preview: variants.preview,
    thumbnail: variants.thumbnail,
  };
};

const prepareProjectForSave = async (project: Project, zip: JSZip) => {
  const packageAssetsBySource = new Map<
    string,
    {
      assetPath: string;
      previewAssetPath?: string;
      thumbnailAssetPath?: string;
    }
  >();
  let assetIndex = 0;

  const groups: ReferenceGroup[] = [];
  for (const group of project.groups) {
    const items: ReferenceGroup["items"] = [];

    for (const item of group.items) {
      if (item.type !== "image" || !item.assetPath) {
        items.push(item);
        continue;
      }

      const cachedAssets = packageAssetsBySource.get(item.assetPath);
      let packagedAssets = cachedAssets;

      if (!packagedAssets) {
        const assets = await readImageSaveAssets(item);
        if (!assets) {
          items.push(item);
          continue;
        }

        const packageIndex = assetIndex++;
        const assetPath = toPackageAssetPath(
          item,
          packageIndex,
          assets.original.extension,
          PACKAGE_ORIGINAL_ASSET_DIR,
        );
        zip.file(assetPath, assets.original.buffer);

        const previewAssetPath = assets.preview
          ? toPackageAssetPath(
              item,
              packageIndex,
              assets.preview.extension,
              PACKAGE_PREVIEW_ASSET_DIR,
            )
          : undefined;
        if (previewAssetPath && assets.preview) {
          zip.file(previewAssetPath, assets.preview.buffer);
        }

        const thumbnailAssetPath = assets.thumbnail
          ? toPackageAssetPath(
              item,
              packageIndex,
              assets.thumbnail.extension,
              PACKAGE_THUMBNAIL_ASSET_DIR,
            )
          : undefined;
        if (thumbnailAssetPath && assets.thumbnail) {
          zip.file(thumbnailAssetPath, assets.thumbnail.buffer);
        }

        packagedAssets = {
          assetPath,
          previewAssetPath,
          thumbnailAssetPath,
        };
        packageAssetsBySource.set(item.assetPath, packagedAssets);
      }

      items.push({
        ...item,
        assetPath: packagedAssets.assetPath,
        previewAssetPath: packagedAssets.previewAssetPath,
        thumbnailAssetPath: packagedAssets.thumbnailAssetPath,
      });
    }

    groups.push({
      ...group,
      items,
    });
  }

  return {
    ...project,
    groups,
  };
};

const materializeLoadedAssetPath = async (
  assetPath: string | undefined,
  zip: JSZip,
  tempDir: string,
  materializedAssetPaths: Map<string, string>,
) => {
  if (!assetPath) {
    return assetPath;
  }

  const cached = materializedAssetPaths.get(assetPath);
  if (cached) {
    return cached;
  }

  if (assetPath.startsWith("data:")) {
    const decoded = decodeDataUrl(assetPath);
    if (!decoded) {
      return assetPath;
    }

    const extension = extensionFromMimeType(decoded.mimeType) ?? "png";
    const materializedPath = await writeCanvasAssetTempFile(
      tempDir,
      `${String(materializedAssetPaths.size).padStart(4, "0")}.${extension}`,
      decoded.buffer,
    );
    materializedAssetPaths.set(assetPath, materializedPath);
    return materializedPath;
  }

  if (!isPackageAssetPath(assetPath)) {
    return assetPath;
  }

  const assetFile = zip.file(assetPath);
  if (!assetFile) {
    return assetPath;
  }

  const buffer = await assetFile.async("nodebuffer");
  const materializedPath = await writeCanvasAssetTempFile(
    tempDir,
    path.basename(assetPath),
    buffer,
  );
  materializedAssetPaths.set(assetPath, materializedPath);
  return materializedPath;
};

const materializeLoadedGroupAssets = async (
  groups: ReferenceGroup[],
  zip: JSZip,
) => {
  const tempDir = await createCanvasAssetTempDir();
  const materializedAssetPaths = new Map<string, string>();

  const materializedGroups: ReferenceGroup[] = [];
  for (const group of groups) {
    const items: ReferenceGroup["items"] = [];

    for (const item of group.items) {
      if (item.type !== "image") {
        items.push(item);
        continue;
      }

      items.push({
        ...item,
        assetPath: await materializeLoadedAssetPath(
          item.assetPath,
          zip,
          tempDir,
          materializedAssetPaths,
        ),
        previewAssetPath: await materializeLoadedAssetPath(
          item.previewAssetPath,
          zip,
          tempDir,
          materializedAssetPaths,
        ),
        thumbnailAssetPath: await materializeLoadedAssetPath(
          item.thumbnailAssetPath,
          zip,
          tempDir,
          materializedAssetPaths,
        ),
      });
    }

    materializedGroups.push({
      ...group,
      items,
    });
  }

  return materializedGroups;
};

const validatePath = (targetPath: string) => {
  const resolved = path.resolve(targetPath);

  if (!resolved.endsWith(".canvas")) {
    throw new Error("File must use .canvas extension.");
  }

  return resolved;
};

const toGroupFileName = (group: ReferenceGroup, index: number) =>
  `groups/${String(index).padStart(3, "0")}-${group.id}.json`;

export const saveCanvasProject = async (
  project: Project,
  targetPath: string,
) => {
  const safePath = validatePath(targetPath);
  const zip = new JSZip();
  const projectForSave = await prepareProjectForSave(project, zip);

  const groupFiles = projectForSave.groups.map((group, index) => {
    const name = toGroupFileName(group, index);
    zip.file(name, JSON.stringify(group, null, 2));
    return name;
  });

  const manifest: CanvasManifest = {
    id: projectForSave.id,
    version: projectForSave.version,
    title: projectForSave.title,
    canvasSize: projectForSave.canvasSize,
    activeGroupId: projectForSave.activeGroupId,
    groupFiles,
    createdAt: projectForSave.createdAt,
    updatedAt: projectForSave.updatedAt,
    formatVersion: FORMAT_VERSION,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("tasks.json", JSON.stringify(projectForSave.tasks, null, 2));

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  await fs.writeFile(safePath, buffer);

  return safePath;
};

const isCanvasManifest = (value: unknown): value is CanvasManifest => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.version === "number" &&
    typeof record.title === "string" &&
    typeof record.activeGroupId === "string" &&
    Array.isArray(record.groupFiles) &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
};

export const loadCanvasProject = async (
  sourcePath: string,
): Promise<Project> => {
  const safePath = validatePath(sourcePath);
  const raw = await fs.readFile(safePath);
  const isZipPackage = raw.length >= 2 && raw[0] === 0x50 && raw[1] === 0x4b;
  const isGzipJson = raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b;

  if (isGzipJson) {
    return loadLegacyCanvasProject(raw, safePath);
  }

  if (!isZipPackage) {
    throw new Error("Unsupported .canvas format.");
  }

  const zip = await JSZip.loadAsync(raw);

  const manifestFile = zip.file("manifest.json");

  if (!manifestFile) {
    throw new Error("Invalid .canvas package: missing manifest.json");
  }

  const manifestRaw = await manifestFile.async("text");
  const parsedManifest = JSON.parse(manifestRaw) as unknown;

  if (!isCanvasManifest(parsedManifest)) {
    throw new Error("Invalid .canvas package: malformed manifest");
  }

  const parsedGroups = await Promise.all(
    parsedManifest.groupFiles.map(async (groupFilePath, index) => {
      if (typeof groupFilePath !== "string") {
        throw new Error("Invalid .canvas package: malformed group file entry");
      }

      const groupFile = zip.file(groupFilePath);
      if (!groupFile) {
        throw new Error(`Invalid .canvas package: missing ${groupFilePath}`);
      }

      const groupRaw = await groupFile.async("text");
      const parsedGroup = JSON.parse(groupRaw) as ReferenceGroup;
      return {
        ...parsedGroup,
        kind: parsedGroup.kind ?? (index === 0 ? "canvas" : "group"),
        locked: parsedGroup.locked ?? false,
        canvasColor: parsedGroup.canvasColor ?? DEFAULT_GROUP_CANVAS_COLOR,
        backgroundColor:
          parsedGroup.backgroundColor ?? DEFAULT_GROUP_BACKGROUND_COLOR,
      };
    }),
  );
  const groups = await materializeLoadedGroupAssets(parsedGroups, zip);

  const tasksFile = zip.file("tasks.json");
  const tasksRaw = tasksFile ? await tasksFile.async("text") : "[]";

  const tasks = (JSON.parse(tasksRaw) as Project["tasks"]).map((task) => ({
    ...task,
    completed: task.completed ?? false,
  }));

  return {
    id: parsedManifest.id,
    version: parsedManifest.version,
    filePath: safePath,
    title: parsedManifest.title,
    canvasSize: parsedManifest.canvasSize,
    activeGroupId: parsedManifest.activeGroupId,
    groups,
    tasks,
    createdAt: parsedManifest.createdAt,
    updatedAt: parsedManifest.updatedAt,
  };
};
