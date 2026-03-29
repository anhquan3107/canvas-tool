import { useEffect, useMemo } from "react";
import type { CanvasItem, LayoutMode } from "@shared/types/project";
import type { ShortcutBindings } from "@shared/shortcuts";
import { useShortcuts } from "@renderer/hooks/use-shortcuts";
import {
  collectClipboardPayload,
  type ImportPayload,
} from "@renderer/features/import/image-import";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";

interface UseAppShortcutsOptions {
  shortcutBindings: ShortcutBindings;
  activeTool: ToolMode | null;
  selectedItemIds: string[];
  clipboardItems: CanvasItem[];
  handleOpenProject: () => Promise<unknown>;
  handleSaveProject: () => Promise<unknown>;
  handleSaveProjectAs: () => Promise<unknown>;
  handleExportCanvasImage: () => Promise<unknown> | void;
  handleExportGroupImages: () => Promise<unknown> | void;
  handleExportAllTasksHtml: () => Promise<unknown> | void;
  undo: () => void;
  redo: () => void;
  cutSelectedItems: () => void;
  copySelectedItemsToClipboard: () => void;
  pasteClipboardItems: () => void;
  deleteSelectedItems: () => void;
  cropSelectedImage: () => void;
  flipSelectedItemsHorizontally: () => void;
  resetView: () => void;
  openCanvasSizeDialog: () => void;
  toggleCanvasLock: () => void;
  clearTransientUi: () => void;
  openGroupDialog: () => void;
  openTaskDialog: () => void;
  arrangeSelectedItems: (mode: LayoutMode) => void;
  autoArrange: () => void;
  toggleSnap: () => void;
  toggleAutoArrangeOnImport: () => void;
  openConnectDialog: () => void;
  toggleDoodle: () => void;
  setDoodleMode: (mode: DoodleMode) => void;
  toggleBlur: () => void;
  toggleBlackAndWhite: () => void;
  toggleAlwaysOnTop: () => void;
  quitApplication: () => void;
  importFromPayload: (payload: ImportPayload) => Promise<void>;
}

export const useAppShortcuts = ({
  shortcutBindings,
  activeTool,
  selectedItemIds,
  clipboardItems,
  handleOpenProject,
  handleSaveProject,
  handleSaveProjectAs,
  handleExportCanvasImage,
  handleExportGroupImages,
  handleExportAllTasksHtml,
  undo,
  redo,
  cutSelectedItems,
  copySelectedItemsToClipboard,
  pasteClipboardItems,
  deleteSelectedItems,
  cropSelectedImage,
  flipSelectedItemsHorizontally,
  resetView,
  openCanvasSizeDialog,
  toggleCanvasLock,
  clearTransientUi,
  openGroupDialog,
  openTaskDialog,
  arrangeSelectedItems,
  autoArrange,
  toggleSnap,
  toggleAutoArrangeOnImport,
  openConnectDialog,
  toggleDoodle,
  setDoodleMode,
  toggleBlur,
  toggleBlackAndWhite,
  toggleAlwaysOnTop,
  quitApplication,
  importFromPayload,
}: UseAppShortcutsOptions) => {
  const actionHandlers = useMemo(
    () => ({
      "file.open": () => void handleOpenProject(),
      "file.save": () => void handleSaveProject(),
      "file.saveAs": () => void handleSaveProjectAs(),
      "export.canvasImage": () => void handleExportCanvasImage(),
      "export.groupImages": () => void handleExportGroupImages(),
      "export.allTasks": () => void handleExportAllTasksHtml(),
      "edit.undo": undo,
      "edit.redo": redo,
      "edit.cut": cutSelectedItems,
      "edit.copy": copySelectedItemsToClipboard,
      "edit.paste": pasteClipboardItems,
      "edit.delete": deleteSelectedItems,
      "edit.crop": cropSelectedImage,
      "edit.flipHorizontal": flipSelectedItemsHorizontally,
      "canvas.resetView": resetView,
      "canvas.changeSize": openCanvasSizeDialog,
      "canvas.toggleLock": toggleCanvasLock,
      "canvas.clearTransientUi": clearTransientUi,
      "groups.create": openGroupDialog,
      "tasks.add": openTaskDialog,
      "arrange.auto": autoArrange,
      "arrange.horizontal": () => arrangeSelectedItems("horizontal"),
      "arrange.toggleSnap": toggleSnap,
      "arrange.toggleAutoArrangeOnImport": toggleAutoArrangeOnImport,
      "tools.connect": openConnectDialog,
      "tools.toggleDoodle": toggleDoodle,
      "tools.doodleBrush": () => {
        if (activeTool !== "doodle") {
          return;
        }

        setDoodleMode("brush");
      },
      "tools.doodleEraser": () => {
        if (activeTool !== "doodle") {
          return;
        }

        setDoodleMode("erase-line");
      },
      "tools.toggleBlur": toggleBlur,
      "tools.toggleBlackAndWhite": toggleBlackAndWhite,
      "window.toggleAlwaysOnTop": toggleAlwaysOnTop,
      "app.quit": quitApplication,
      "window.closeAuxiliary": () => {
        // Main window ignores this. Auxiliary windows handle it locally.
      },
    }),
    [
      activeTool,
      arrangeSelectedItems,
      autoArrange,
      clearTransientUi,
      copySelectedItemsToClipboard,
      cropSelectedImage,
      cutSelectedItems,
      deleteSelectedItems,
      flipSelectedItemsHorizontally,
      handleExportAllTasksHtml,
      handleExportCanvasImage,
      handleExportGroupImages,
      handleOpenProject,
      handleSaveProject,
      handleSaveProjectAs,
      openCanvasSizeDialog,
      openConnectDialog,
      openGroupDialog,
      openTaskDialog,
      pasteClipboardItems,
      quitApplication,
      redo,
      resetView,
      setDoodleMode,
      toggleAlwaysOnTop,
      toggleAutoArrangeOnImport,
      toggleBlackAndWhite,
      toggleBlur,
      toggleCanvasLock,
      toggleDoodle,
      toggleSnap,
      undo,
    ],
  );

  const shortcutHandlers = useMemo(() => {
    const handlers: Partial<Record<string, () => void>> = {};

    Object.entries(shortcutBindings).forEach(([actionId, binding]) => {
      if (!binding) {
        return;
      }

      const handler = actionHandlers[actionId as keyof typeof actionHandlers];
      if (!handler) {
        return;
      }

      handlers[binding] = handler;
    });

    return handlers;
  }, [actionHandlers, shortcutBindings]);

  useShortcuts(shortcutHandlers);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (event.target instanceof HTMLElement) {
        if (
          event.target.isContentEditable ||
          event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.tagName === "SELECT"
        ) {
          return;
        }
      }

      if (clipboardItems.length > 0) {
        event.preventDefault();
        pasteClipboardItems();
        return;
      }

      const payload = collectClipboardPayload(event);
      if (payload.files.length === 0 && payload.urls.length === 0) {
        return;
      }

      event.preventDefault();
      void importFromPayload(payload);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [clipboardItems.length, importFromPayload, pasteClipboardItems]);
};
