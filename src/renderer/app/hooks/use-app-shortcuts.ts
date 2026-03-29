import { useEffect, useMemo } from "react";
import type { CanvasItem } from "@shared/types/project";
import { useShortcuts } from "@renderer/hooks/use-shortcuts";
import {
  collectClipboardPayload,
  type ImportPayload,
} from "@renderer/features/import/image-import";

interface UseAppShortcutsOptions {
  activeGroupId: string | null;
  selectedItemIds: string[];
  clipboardItems: CanvasItem[];
  handleOpenProject: () => Promise<unknown>;
  handleSaveProject: () => Promise<unknown>;
  handleSaveProjectAs: () => Promise<unknown>;
  undo: () => void;
  redo: () => void;
  cutSelectedItems: () => void;
  copySelectedItemsToClipboard: () => void;
  pasteClipboardItems: () => void;
  deleteSelectedItems: () => void;
  flipItems: (groupId: string, itemIds: string[]) => void;
  resetView: () => void;
  openGroupDialog: () => void;
  openTaskDialog: () => void;
  toggleBlur: () => void;
  toggleBlackAndWhite: () => void;
  autoArrange: () => void;
  importFromPayload: (payload: ImportPayload) => Promise<void>;
}

export const useAppShortcuts = ({
  activeGroupId,
  selectedItemIds,
  clipboardItems,
  handleOpenProject,
  handleSaveProject,
  handleSaveProjectAs,
  undo,
  redo,
  cutSelectedItems,
  copySelectedItemsToClipboard,
  pasteClipboardItems,
  deleteSelectedItems,
  flipItems,
  resetView,
  openGroupDialog,
  openTaskDialog,
  toggleBlur,
  toggleBlackAndWhite,
  autoArrange,
  importFromPayload,
}: UseAppShortcutsOptions) => {
  const shortcutHandlers = useMemo(
    () => ({
      "Ctrl+O": () => void handleOpenProject(),
      "Ctrl+S": () => void handleSaveProject(),
      "Ctrl+Shift+S": () => void handleSaveProjectAs(),
      "Ctrl+Z": undo,
      "Ctrl+Shift+Z": redo,
      "Ctrl+X": cutSelectedItems,
      "Ctrl+F": () => {
        if (!activeGroupId || selectedItemIds.length === 0) {
          return;
        }

        flipItems(activeGroupId, selectedItemIds);
      },
      "Ctrl+C": copySelectedItemsToClipboard,
      "Ctrl+0": resetView,
      "Ctrl+G": openGroupDialog,
      "Ctrl+T": openTaskDialog,
      "Ctrl+B": toggleBlur,
      "Ctrl+Y": toggleBlackAndWhite,
      "Ctrl+Shift+F": autoArrange,
      Delete: deleteSelectedItems,
    }),
    [
      activeGroupId,
      autoArrange,
      copySelectedItemsToClipboard,
      cutSelectedItems,
      deleteSelectedItems,
      flipItems,
      handleOpenProject,
      handleSaveProject,
      handleSaveProjectAs,
      openGroupDialog,
      openTaskDialog,
      redo,
      resetView,
      selectedItemIds,
      toggleBlackAndWhite,
      toggleBlur,
      undo,
    ],
  );

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
