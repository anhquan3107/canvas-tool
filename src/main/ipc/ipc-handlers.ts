import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain,
  nativeImage,
} from "electron";
import path from "node:path";
import type {
  AppWindowState,
  ClipboardWriteImageRequest,
  OpenCaptureWindowRequest,
  ProjectSaveRequest,
  RemoteImageFetchRequest,
} from "../../shared/types/ipc";
import type { Project } from "../../shared/types/project";
import {
  loadCanvasProject,
  saveCanvasProject,
} from "../persistence/canvas-project-persistence";
import { createDefaultProject } from "../services/project-service";
import { addRecentFile, readSettings } from "../services/app-settings-service";

const canvasDialogFilter = [
  { name: "CanvasTool Project", extensions: ["canvas"] },
];

const ensureProject = (value: unknown): Project => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid project payload.");
  }

  return value as Project;
};

const ensureSavePayload = (value: unknown): ProjectSaveRequest => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid save payload.");
  }

  const payload = value as Record<string, unknown>;
  return {
    project: ensureProject(payload.project),
    filePath:
      typeof payload.filePath === "string" ? payload.filePath : undefined,
  };
};

const updateWindowTitle = (window: BrowserWindow | null, project: Project) => {
  const fileName = project.filePath
    ? path.basename(project.filePath)
    : "Untitled.canvas";
  window?.setTitle(`CanvasTool - ${fileName}`);
};

const MAX_FETCH_SIZE_BYTES = 25 * 1024 * 1024;

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const toDataUrl = (contentType: string, buffer: Buffer) => {
  const type = contentType.split(";")[0].trim() || "image/png";
  const base64 = buffer.toString("base64");
  return `data:${type};base64,${base64}`;
};

const getSenderWindow = (sender: Electron.WebContents) =>
  BrowserWindow.fromWebContents(sender);

const getCaptureWindowBounds = (payload: OpenCaptureWindowRequest) => {
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

export const setupIpcHandlers = (window: BrowserWindow) => {
  ipcMain.handle("app:get-version", () => app.getVersion());

  ipcMain.handle("project:create", () => createDefaultProject());

  ipcMain.handle("project:get-recent-files", async () => {
    const settings = await readSettings();
    return settings.recentFiles;
  });

  ipcMain.handle("capture:list-sources", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      fetchWindowIcons: true,
      thumbnailSize: {
        width: 320,
        height: 180,
      },
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith("screen:") ? "screen" : "window",
      thumbnailDataUrl: source.thumbnail.isEmpty()
        ? null
        : source.thumbnail.toDataURL(),
      thumbnailWidth: source.thumbnail.getSize().width,
      thumbnailHeight: source.thumbnail.getSize().height,
      appIconDataUrl:
        source.appIcon && !source.appIcon.isEmpty()
          ? source.appIcon.toDataURL()
          : null,
    }));
  });

  ipcMain.handle(
    "capture:open-window",
    async (_, rawPayload: OpenCaptureWindowRequest) => {
      if (
        !rawPayload ||
        typeof rawPayload !== "object" ||
        typeof rawPayload.sourceId !== "string" ||
        typeof rawPayload.sourceName !== "string" ||
        typeof rawPayload.quality !== "string"
      ) {
        throw new Error("Invalid capture window payload.");
      }

      const bounds = getCaptureWindowBounds(rawPayload);
      const captureWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        minWidth: 640,
        minHeight: 420,
        frame: false,
        backgroundColor: "#12100f",
        title: `Capture - ${rawPayload.sourceName}`,
        webPreferences: {
          preload: path.join(__dirname, "../preload/index.js"),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      const query = new URLSearchParams({
        mode: "capture",
        sourceId: rawPayload.sourceId,
        sourceName: rawPayload.sourceName,
        quality: rawPayload.quality,
      }).toString();

      const devServerUrl = process.env.VITE_DEV_SERVER_URL;
      if (devServerUrl) {
        await captureWindow.loadURL(`${devServerUrl}?${query}`);
      } else {
        await captureWindow.loadFile(
          path.join(__dirname, "../renderer/index.html"),
          { query: { mode: "capture", sourceId: rawPayload.sourceId, sourceName: rawPayload.sourceName, quality: rawPayload.quality } },
        );
      }
    },
  );

  ipcMain.handle("project:open", async (event) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    const result = await dialog.showOpenDialog(targetWindow, {
      properties: ["openFile"],
      filters: canvasDialogFilter,
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];

    try {
      const project = await loadCanvasProject(filePath);
      await addRecentFile(filePath);
      updateWindowTitle(window, project);
      return { project, filePath };
    } catch (error) {
      await dialog.showMessageBox(targetWindow, {
        type: "error",
        title: "Could not open project",
        message:
          error instanceof Error
            ? error.message
            : "Unknown error while opening file.",
      });

      return null;
    }
  });

  ipcMain.handle("project:save", async (_, rawPayload: unknown) => {
    const payload = ensureSavePayload(rawPayload);
    const currentProject = {
      ...payload.project,
      updatedAt: new Date().toISOString(),
    };

    const targetPath = payload.filePath ?? currentProject.filePath;

    if (!targetPath) {
      throw new Error("Missing file path. Use Save As first.");
    }

    const savedPath = await saveCanvasProject(currentProject, targetPath);
    await addRecentFile(savedPath);

    const projectWithPath = {
      ...currentProject,
      filePath: savedPath,
    };

    updateWindowTitle(window, projectWithPath);

    return {
      filePath: savedPath,
    };
  });

  ipcMain.handle("project:save-as", async (_, rawPayload: unknown) => {
    const payload = ensureSavePayload(rawPayload);

    const dialogResult = await dialog.showSaveDialog(window, {
      defaultPath: payload.filePath ?? "Untitled.canvas",
      filters: canvasDialogFilter,
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return null;
    }

    const savedPath = await saveCanvasProject(
      {
        ...payload.project,
        updatedAt: new Date().toISOString(),
      },
      dialogResult.filePath,
    );

    await addRecentFile(savedPath);

    updateWindowTitle(window, {
      ...payload.project,
      filePath: savedPath,
    });

    return { filePath: savedPath };
  });

  ipcMain.handle("window:set-title", (event, payload: AppWindowState) => {
    const safeTitle = payload.fileName
      ? `CanvasTool - ${payload.fileName}`
      : `CanvasTool - ${payload.title}`;

    getSenderWindow(event.sender)?.setTitle(safeTitle);
  });

  ipcMain.handle("window:minimize", (event) => {
    getSenderWindow(event.sender)?.minimize();
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const targetWindow = getSenderWindow(event.sender) ?? window;
    if (targetWindow.isMaximized()) {
      targetWindow.unmaximize();
    } else {
      targetWindow.maximize();
    }

    return {
      isMaximized: targetWindow.isMaximized(),
    };
  });

  ipcMain.handle("window:close", (event) => {
    getSenderWindow(event.sender)?.close();
  });

  ipcMain.handle("window:get-controls-state", (event) => ({
    isMaximized: (getSenderWindow(event.sender) ?? window).isMaximized(),
  }));

  ipcMain.handle(
    "clipboard:write-image-data-url",
    (_, payload: ClipboardWriteImageRequest) => {
      if (
        !payload ||
        typeof payload !== "object" ||
        typeof payload.dataUrl !== "string"
      ) {
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
    },
  );

  ipcMain.handle(
    "import:fetch-remote-image-data-url",
    async (_, payload: RemoteImageFetchRequest) => {
      if (
        !payload ||
        typeof payload !== "object" ||
        typeof payload.url !== "string"
      ) {
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
    },
  );
};
