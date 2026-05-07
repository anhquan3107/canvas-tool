import { createHash } from "node:crypto";
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

type ProjectProgressReporter = (message: string, progress: number) => void;

interface SaveCanvasProjectOptions {
  onProgress?: ProjectProgressReporter;
  progressLabel?: string;
  progressStart?: number;
  progressEnd?: number;
}

interface PrepareProjectForSaveOptions {
  onProgress?: ProjectProgressReporter;
  progressLabel: string;
  progressStart: number;
  progressEnd: number;
}

interface LoadCanvasProjectOptions {
  onProgress?: ProjectProgressReporter;
}

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
// Image formats are already compressed; deflating them in JS is slow on Windows.
const STORED_ZIP_BINARY_OPTIONS = { compression: "STORE" } as const;

const reportProgress = (
  onProgress: ProjectProgressReporter | undefined,
  label: string,
  progress: number,
) => {
  if (!onProgress) {
    return;
  }

  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  onProgress(`${label} ${clampedProgress}%`, clampedProgress);
};

const scaleProgress = (start: number, end: number, relativeProgress: number) =>
  start + ((end - start) * relativeProgress) / 100;

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

const getAssetPathExtension = (
  assetPath: string,
  mimeType?: string | null,
) => {
  const localPath = resolveLocalAssetPath(assetPath);
  return (
    (localPath ? path.extname(localPath) : path.extname(assetPath))
      .replace(".", "")
      .toLowerCase() ||
    extensionFromMimeType(mimeType)
  );
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

const readAssetPathForSave = async (assetPath: string | undefined) => {
  if (!assetPath) {
    return null;
  }

  const decoded = assetPath.startsWith("data:")
    ? decodeDataUrl(assetPath)
    : null;
  if (decoded) {
    return {
      buffer: decoded.buffer,
      extension: getAssetPathExtension(assetPath, decoded.mimeType),
    };
  }

  const sourcePath = resolveLocalAssetPath(assetPath);
  if (!sourcePath) {
    return null;
  }

  return {
    buffer: await fs.readFile(sourcePath),
    extension: getAssetPathExtension(sourcePath),
  };
};

const readImageAssetForSave = async (item: ImageItem) => {
  if (!item.assetPath) {
    return null;
  }

  const asset = await readAssetPathForSave(item.assetPath);
  if (!asset) {
    return null;
  }

  return {
    buffer: asset.buffer,
    extension:
      asset.extension ??
      getImageAssetExtension(item, item.assetPath) ??
      extensionFromFormatLabel(item.format) ??
      "png",
  };
};

const getImageAssetFingerprint = (buffer: Buffer) =>
  createHash("sha1").update(buffer).digest("hex");

const packageImageVariantAsset = async (
  zip: JSZip,
  item: ImageItem,
  assetIndex: number,
  assetPath: string | undefined,
  directory: string,
) => {
  const variant = await readAssetPathForSave(assetPath);
  if (!variant) {
    return undefined;
  }

  const packageAssetPath = toPackageAssetPath(
    item,
    assetIndex,
    variant.extension ?? "png",
    directory,
  );
  zip.file(packageAssetPath, variant.buffer, STORED_ZIP_BINARY_OPTIONS);
  return packageAssetPath;
};

const countSaveableImageItems = (project: Project) =>
  project.groups.reduce(
    (count, group) =>
      count +
      group.items.filter((item) => item.type === "image" && Boolean(item.assetPath))
        .length,
    0,
  );

const prepareProjectForSave = async (
  project: Project,
  zip: JSZip,
  options?: PrepareProjectForSaveOptions,
) => {
  const packageAssetsBySource = new Map<
    string,
    {
      assetPath: string;
      previewAssetPath?: string;
      thumbnailAssetPath?: string;
    }
  >();
  const packageAssetsByFingerprint = new Map<
    string,
    {
      assetPath: string;
      previewAssetPath?: string;
      thumbnailAssetPath?: string;
    }
  >();
  let assetIndex = 0;
  let processedImageItems = 0;
  let lastReportedProgress = -1;
  const imageItemCount = countSaveableImageItems(project);

  const reportAssetProgress = () => {
    if (!options || imageItemCount === 0) {
      return;
    }

    const progress = Math.round(
      scaleProgress(
        options.progressStart,
        options.progressEnd,
        (processedImageItems / imageItemCount) * 100,
      ),
    );
    if (progress <= lastReportedProgress) {
      return;
    }

    lastReportedProgress = progress;
    reportProgress(options.onProgress, options.progressLabel, progress);
  };

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
        const original = await readImageAssetForSave(item);
        if (!original) {
          processedImageItems += 1;
          reportAssetProgress();
          items.push(item);
          continue;
        }

        const fingerprint = getImageAssetFingerprint(original.buffer);
        packagedAssets = packageAssetsByFingerprint.get(fingerprint);

        if (!packagedAssets) {
          const packageIndex = assetIndex++;
          const assetPath = toPackageAssetPath(
            item,
            packageIndex,
            original.extension,
            PACKAGE_ORIGINAL_ASSET_DIR,
          );
          zip.file(assetPath, original.buffer, STORED_ZIP_BINARY_OPTIONS);

          let previewAssetPath = await packageImageVariantAsset(
            zip,
            item,
            packageIndex,
            item.previewAssetPath,
            PACKAGE_PREVIEW_ASSET_DIR,
          );
          let thumbnailAssetPath = await packageImageVariantAsset(
            zip,
            item,
            packageIndex,
            item.thumbnailAssetPath,
            PACKAGE_THUMBNAIL_ASSET_DIR,
          );

          if (!previewAssetPath && !thumbnailAssetPath) {
            const variants = await buildImageAssetVariantsFromBuffer(
              original.buffer,
              original.extension,
            );

            previewAssetPath = variants.preview
              ? toPackageAssetPath(
                  item,
                  packageIndex,
                  variants.preview.extension,
                  PACKAGE_PREVIEW_ASSET_DIR,
                )
              : undefined;
            if (previewAssetPath && variants.preview) {
              zip.file(
                previewAssetPath,
                variants.preview.buffer,
                STORED_ZIP_BINARY_OPTIONS,
              );
            }

            thumbnailAssetPath = variants.thumbnail
              ? toPackageAssetPath(
                  item,
                  packageIndex,
                  variants.thumbnail.extension,
                  PACKAGE_THUMBNAIL_ASSET_DIR,
                )
              : undefined;
            if (thumbnailAssetPath && variants.thumbnail) {
              zip.file(
                thumbnailAssetPath,
                variants.thumbnail.buffer,
                STORED_ZIP_BINARY_OPTIONS,
              );
            }
          }

          packagedAssets = {
            assetPath,
            previewAssetPath,
            thumbnailAssetPath,
          };
          packageAssetsByFingerprint.set(fingerprint, packagedAssets);
        }

        packageAssetsBySource.set(item.assetPath, packagedAssets);
      }

      processedImageItems += 1;
      reportAssetProgress();
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
  const materializedFileName = assetPath
    .replace(/\\/g, "/")
    .replace(/\//g, "--");
  const materializedPath = await writeCanvasAssetTempFile(
    tempDir,
    materializedFileName,
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
  options: SaveCanvasProjectOptions = {},
) => {
  const safePath = validatePath(targetPath);
  const zip = new JSZip();
  const progressLabel = options.progressLabel ?? "Saving canvas";
  const progressStart = options.progressStart ?? 18;
  const progressEnd = options.progressEnd ?? 96;
  const progressAt = (relativeProgress: number) =>
    scaleProgress(progressStart, progressEnd, relativeProgress);

  reportProgress(options.onProgress, progressLabel, progressAt(8));
  const projectForSave = await prepareProjectForSave(project, zip, {
    onProgress: options.onProgress,
    progressLabel,
    progressStart: progressAt(12),
    progressEnd: progressAt(68),
  });

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

  let lastZipProgress = -1;
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    streamFiles: true,
  }, (metadata) => {
    const progress = Math.round(progressAt(72 + metadata.percent * 0.18));
    if (progress <= lastZipProgress) {
      return;
    }

    lastZipProgress = progress;
    reportProgress(options.onProgress, progressLabel, progress);
  });
  reportProgress(options.onProgress, progressLabel, progressAt(94));
  await fs.writeFile(safePath, buffer);
  reportProgress(options.onProgress, progressLabel, progressAt(100));

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

const loadPackagedCanvasProject = async (
  raw: Buffer,
  safePath: string,
): Promise<Project> => {
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

export const loadCanvasProject = async (
  sourcePath: string,
  options: LoadCanvasProjectOptions = {},
): Promise<Project> => {
  const safePath = validatePath(sourcePath);
  reportProgress(options.onProgress, "Reading canvas", 12);
  const raw = await fs.readFile(safePath);
  const isZipPackage = raw.length >= 2 && raw[0] === 0x50 && raw[1] === 0x4b;
  const isGzipJson = raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b;

  if (isGzipJson) {
    reportProgress(options.onProgress, "Converting legacy canvas", 18);
    const legacyProject = await loadLegacyCanvasProject(raw, safePath, {
      onProgress: options.onProgress,
      progressStart: 18,
      progressEnd: 72,
    });
    await saveCanvasProject(
      {
        ...legacyProject,
        filePath: safePath,
      },
      safePath,
      {
        onProgress: options.onProgress,
        progressLabel: "Writing converted canvas",
        progressStart: 74,
        progressEnd: 96,
      },
    );

    reportProgress(options.onProgress, "Converted canvas", 98);
    return {
      ...legacyProject,
      filePath: safePath,
    };
  }

  if (!isZipPackage) {
    throw new Error("Unsupported .canvas format.");
  }

  reportProgress(options.onProgress, "Opening canvas package", 34);
  const project = await loadPackagedCanvasProject(raw, safePath);
  reportProgress(options.onProgress, "Loaded canvas package", 92);
  return project;
};
