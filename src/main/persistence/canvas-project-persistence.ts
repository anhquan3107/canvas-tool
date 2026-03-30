import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import type { Project, ReferenceGroup } from "../../shared/types/project";
import {
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "../../shared/project-defaults";

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

const FORMAT_VERSION = 1;

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

  const groupFiles = project.groups.map((group, index) => {
    const name = toGroupFileName(group, index);
    zip.file(name, JSON.stringify(group, null, 2));
    return name;
  });

  const manifest: CanvasManifest = {
    id: project.id,
    version: project.version,
    title: project.title,
    canvasSize: project.canvasSize,
    activeGroupId: project.activeGroupId,
    groupFiles,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    formatVersion: FORMAT_VERSION,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("tasks.json", JSON.stringify(project.tasks, null, 2));

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

  const groups = await Promise.all(
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

  const tasksFile = zip.file("tasks.json");
  const tasksRaw = tasksFile ? await tasksFile.async("text") : "[]";

  const tasks = JSON.parse(tasksRaw) as Project["tasks"];

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
