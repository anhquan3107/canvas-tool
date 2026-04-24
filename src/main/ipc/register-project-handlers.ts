import { dialog, ipcMain, type BrowserWindow } from "electron";
import { loadCanvasProject, saveCanvasProject } from "../persistence/canvas-project-persistence";
import { addRecentFile } from "../services/app-settings-service";
import { canvasDialogFilter, getSenderWindow, updateWindowTitle } from "./ipc-utils";
import { ensureSavePayload } from "./ipc-validators";

export const registerProjectHandlers = (window: BrowserWindow) => {
  const sendOperationProgress = (
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
    message: string,
    progress: number,
  ) => {
    event.sender.send("project:operation-progress", {
      message,
      progress,
    });
  };

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
      sendOperationProgress(event, "Loading canvas 16%", 16);
      const project = await loadCanvasProject(filePath);
      const resolvedFilePath = project.filePath ?? filePath;
      sendOperationProgress(event, "Loading canvas 82%", 82);
      await addRecentFile(resolvedFilePath);
      updateWindowTitle(window, project);
      return { project, filePath: resolvedFilePath };
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

  ipcMain.handle("project:save", async (event, rawPayload: unknown) => {
    const payload = ensureSavePayload(rawPayload);
    const currentProject = {
      ...payload.project,
      updatedAt: new Date().toISOString(),
    };

    const targetPath = payload.filePath ?? currentProject.filePath;

    if (!targetPath) {
      throw new Error("Missing file path. Use Save As first.");
    }

    sendOperationProgress(event, "Saving canvas 18%", 18);
    const savedPath = await saveCanvasProject(currentProject, targetPath);
    sendOperationProgress(event, "Saving canvas 84%", 84);
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

  ipcMain.handle("project:save-as", async (event, rawPayload: unknown) => {
    const payload = ensureSavePayload(rawPayload);

    const dialogResult = await dialog.showSaveDialog(window, {
      defaultPath: payload.filePath ?? "Untitled.canvas",
      filters: canvasDialogFilter,
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return null;
    }

    sendOperationProgress(event, "Saving canvas 18%", 18);
    const savedPath = await saveCanvasProject(
      {
        ...payload.project,
        updatedAt: new Date().toISOString(),
      },
      dialogResult.filePath,
    );

    sendOperationProgress(event, "Saving canvas 84%", 84);
    await addRecentFile(savedPath);

    updateWindowTitle(window, {
      ...payload.project,
      filePath: savedPath,
    });

    return { filePath: savedPath };
  });
};
