import { useEffect, useMemo } from "react";
import type { CanvasItem, LayoutMode } from "@shared/types/project";
import type { ShortcutBindings } from "@shared/shortcuts";
import { useShortcuts } from "@renderer/hooks/use-shortcuts";
import {
  collectClipboardPayload,
  type ImportPayload,
} from "@renderer/features/import/image-import";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";

const isMacPlatform = () =>
  /mac/i.test(
    (() => {
      if (typeof navigator === "undefined") {
        return "";
      }

      const navigatorWithUAData = navigator as Navigator & {
        userAgentData?: { platform?: string };
      };

      return navigatorWithUAData.userAgentData?.platform ?? navigator.platform ?? "";
    })(),
  );

const NATIVE_MENU_DEFAULT_BINDINGS = {
  "window.showSettings": "F1",
  "canvas.toggleLock": "F2",
  "canvas.changeSize": "Ctrl+Alt+I",
  "canvas.resetView": "Ctrl+Shift+F",
} as const;

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
  selectAllItems: () => void;
  undo: () => void;
  redo: () => void;
  cutSelectedItems: () => void;
  copySelectedItemsToClipboard: () => void;
  pasteClipboardItems: () => void;
  deleteSelectedItems: () => void;
  clearDoodles: () => void;
  cropSelectedImage: () => void;
  flipSelectedItemsHorizontally: () => void;
  resetView: () => void;
  fitCanvasToWindow: () => void;
  openCanvasSizeDialog: () => void;
  toggleCanvasLock: () => void;
  showSettings: () => void;
  clearTransientUi: () => void;
  exitDoodle: () => void;
  openGroupDialog: () => void;
  openTaskDialog: () => void;
  arrangeSelectedItems: (mode: LayoutMode) => void;
  autoArrange: () => void;
  toggleAutoArrangeOnImport: () => void;
  openConnectDialog: () => void;
  toggleDoodle: () => void;
  setDoodleMode: (mode: DoodleMode) => void;
  adjustDoodleSize: (delta: number) => void;
  toggleRuler: () => void;
  toggleBlur: () => void;
  toggleBlackAndWhite: () => void;
  zoomInCanvas: () => void;
  zoomOutCanvas: () => void;
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
  selectAllItems,
  undo,
  redo,
  cutSelectedItems,
  copySelectedItemsToClipboard,
  pasteClipboardItems,
  deleteSelectedItems,
  clearDoodles,
  cropSelectedImage,
  flipSelectedItemsHorizontally,
  resetView,
  fitCanvasToWindow,
  openCanvasSizeDialog,
  toggleCanvasLock,
  showSettings,
  clearTransientUi,
  exitDoodle,
  openGroupDialog,
  openTaskDialog,
  arrangeSelectedItems,
  autoArrange,
  toggleAutoArrangeOnImport,
  openConnectDialog,
  toggleDoodle,
  setDoodleMode,
  adjustDoodleSize,
  toggleRuler,
  toggleBlur,
  toggleBlackAndWhite,
  zoomInCanvas,
  zoomOutCanvas,
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
      "edit.selectAll": selectAllItems,
      "edit.undo": undo,
      "edit.redo": redo,
      "edit.cut": cutSelectedItems,
      "edit.copy": copySelectedItemsToClipboard,
      "edit.paste": pasteClipboardItems,
      "edit.delete": () => {
        if (activeTool === "doodle") {
          clearDoodles();
          return;
        }

        deleteSelectedItems();
      },
      "edit.crop": cropSelectedImage,
      "edit.flipHorizontal": flipSelectedItemsHorizontally,
      "canvas.resetView": resetView,
      "canvas.fitToWindow": fitCanvasToWindow,
      "canvas.changeSize": openCanvasSizeDialog,
      "canvas.toggleLock": toggleCanvasLock,
      "window.showSettings": showSettings,
      "canvas.clearTransientUi": () => {
        if (activeTool === "doodle") {
          exitDoodle();
          return;
        }

        clearTransientUi();
      },
      "canvas.zoomIn": zoomInCanvas,
      "canvas.zoomOut": zoomOutCanvas,
      "groups.create": openGroupDialog,
      "tasks.add": openTaskDialog,
      "arrange.auto": autoArrange,
      "arrange.horizontal": () => arrangeSelectedItems("horizontal"),
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
      "tools.doodleDecreaseSize": () => {
        if (activeTool !== "doodle") {
          return;
        }

        adjustDoodleSize(-2);
      },
      "tools.doodleIncreaseSize": () => {
        if (activeTool !== "doodle") {
          return;
        }

        adjustDoodleSize(2);
      },
      "tools.toggleRuler": toggleRuler,
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
      adjustDoodleSize,
      arrangeSelectedItems,
      autoArrange,
      clearDoodles,
      clearTransientUi,
      copySelectedItemsToClipboard,
      cropSelectedImage,
      cutSelectedItems,
      deleteSelectedItems,
      flipSelectedItemsHorizontally,
      fitCanvasToWindow,
      handleExportAllTasksHtml,
      handleExportCanvasImage,
      handleExportGroupImages,
      handleOpenProject,
      handleSaveProject,
      handleSaveProjectAs,
      openCanvasSizeDialog,
      openConnectDialog,
      exitDoodle,
      openGroupDialog,
      openTaskDialog,
      pasteClipboardItems,
      quitApplication,
      redo,
      resetView,
      selectAllItems,
      setDoodleMode,
      showSettings,
      toggleRuler,
      toggleAlwaysOnTop,
      toggleAutoArrangeOnImport,
      toggleBlackAndWhite,
      toggleBlur,
      toggleCanvasLock,
      toggleDoodle,
      undo,
      zoomInCanvas,
      zoomOutCanvas,
    ],
  );

  const shortcutHandlers = useMemo(() => {
    const handlers: Partial<Record<string, () => void>> = {};
    const shouldUseNativeMenuPath = isMacPlatform();

    Object.entries(shortcutBindings).forEach(([actionId, binding]) => {
      if (!binding) {
        return;
      }

      const nativeMenuBinding =
        NATIVE_MENU_DEFAULT_BINDINGS[
          actionId as keyof typeof NATIVE_MENU_DEFAULT_BINDINGS
        ];
      if (shouldUseNativeMenuPath && nativeMenuBinding === binding) {
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

  useShortcuts(shortcutHandlers, {
    allowRepeat: [
      shortcutBindings["tools.doodleDecreaseSize"],
      shortcutBindings["tools.doodleIncreaseSize"],
    ].filter(Boolean),
  });

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
