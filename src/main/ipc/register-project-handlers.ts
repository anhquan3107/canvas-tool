import { dialog, ipcMain, type BrowserWindow } from "electron";
import { loadCanvasProject, saveCanvasProject } from "../persistence/canvas-project-persistence";
import { addRecentFile } from "../services/app-settings-service";
import { canvasDialogFilter, getSenderWindow, updateWindowTitle } from "./ipc-utils";
import { ensureSavePayload } from "./ipc-validators";

export const registerProjectHandlers = (window: BrowserWindow) => {
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
};
