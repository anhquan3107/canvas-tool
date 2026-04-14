import { useCallback } from "react";
import type { CanvasBoardViewState } from "@renderer/pixi/types";
import type { UseCanvasWorkspaceOptions } from "@renderer/features/workspace/types";
import {
  getCanvasExpansionPlan,
  getFocusedGroupView,
} from "@renderer/features/workspace/utils/layout";
import { useWorkspaceFileActions } from "@renderer/features/workspace/hooks/use-workspace-file-actions";
import { useWorkspaceImportActions } from "@renderer/features/workspace/hooks/use-workspace-import-actions";
import { useWorkspaceClipboardActions } from "@renderer/features/workspace/hooks/use-workspace-clipboard-actions";
import { useWorkspaceViewActions } from "@renderer/features/workspace/hooks/use-workspace-view-actions";
import { useWorkspaceLayoutActions } from "@renderer/features/workspace/hooks/use-workspace-layout-actions";

export const useCanvasWorkspace = ({
  project,
  activeGroup,
  activeGroupId,
  autoArrangeOnImport,
  viewportSize,
  selectedItemIds,
  lastImportedItemIds,
  importQueue,
  clipboardItems,
  setProject,
  setGroupView,
  patchGroupItems,
  addGroupItems,
  removeGroupItems,
  flipItems,
  setGroupCanvasSize,
  setGroupColors,
  setGroupLocked,
  setGroupAnnotations,
  setImportQueue,
  setClipboardItems,
  setSelectedItemIds,
  setLastImportedItemIds,
  pushToast,
  beginProgressToast,
  refreshRecents,
  runHistoryBatch,
}: UseCanvasWorkspaceOptions) => {
  const focusGroupOnItems = useCallback(
    (
      groupId: string,
      items: Array<{ x: number; y: number; width: number; height: number }>,
      canvasSize: { width: number; height: number },
    ) => {
      const nextView = getFocusedGroupView(items, canvasSize, viewportSize);
      if (!nextView) {
        return;
      }
      setGroupView(groupId, nextView.zoom, nextView.panX, nextView.panY);
    },
    [setGroupView, viewportSize],
  );

  const ensureCanvasFitsItems = useCallback(
    (
      groupId: string,
      items: Array<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        scaleX?: number;
        scaleY?: number;
        visible?: boolean;
      }>,
      currentSize: { width: number; height: number },
      currentView?: CanvasBoardViewState,
    ) => {
      const expansionPlan = getCanvasExpansionPlan(items, currentSize);
      if (!expansionPlan) {
        return;
      }

      if (
        expansionPlan.requiredWidth > currentSize.width ||
        expansionPlan.requiredHeight > currentSize.height ||
        expansionPlan.expandLeft > 0 ||
        expansionPlan.expandTop > 0
      ) {
        setGroupCanvasSize(
          groupId,
          expansionPlan.requiredWidth,
          expansionPlan.requiredHeight,
        );
      }

      if (expansionPlan.shiftedUpdates) {
        patchGroupItems(groupId, expansionPlan.shiftedUpdates);

        if (currentView) {
          const previewShiftLeft =
            currentView.previewInsets?.left ?? expansionPlan.expandLeft;
          const previewShiftTop =
            currentView.previewInsets?.top ?? expansionPlan.expandTop;
          setGroupView(
            groupId,
            currentView.zoom,
            currentView.panX - previewShiftLeft * currentView.zoom,
            currentView.panY - previewShiftTop * currentView.zoom,
          );
        }
      }
    },
    [patchGroupItems, setGroupCanvasSize, setGroupView],
  );
  const { saveProject, saveProjectAs, openProject } = useWorkspaceFileActions({
    project,
    setProject,
    refreshRecents,
    pushToast,
    setSelectedItemIds,
  });

  const {
    importVisibilitySnapshot,
    importFromPayload,
    retryImportEntry,
    handleShellDragOver,
    handleShellDrop,
  } = useWorkspaceImportActions({
    project,
    activeGroup,
    autoArrangeOnImport,
    viewportSize,
    lastImportedItemIds,
    importQueue,
    addGroupItems,
    patchGroupItems,
    setProject,
    setImportQueue,
    setSelectedItemIds,
    setLastImportedItemIds,
    pushToast,
    beginProgressToast,
    runHistoryBatch,
    ensureCanvasFitsItems,
  });

  const {
    copySelectedItemsToClipboard,
    cutSelectedItems,
    pasteClipboardItems,
    deleteSelectedItems,
    flipSelectedItemsHorizontally,
    applyCropToSelectedImage,
  } = useWorkspaceClipboardActions({
    activeGroup,
    clipboardItems,
    selectedItemIds,
    addGroupItems,
    removeGroupItems,
    patchGroupItems,
    flipItems,
    setClipboardItems,
    setSelectedItemIds,
    pushToast,
    runHistoryBatch,
    ensureCanvasFitsItems,
  });

  const {
    handleBoardViewChange,
    handleBoardItemsPatch,
    resetView,
    changeCanvasSize,
    toggleCanvasLock,
    changeCanvasColors,
    resetCanvasColors,
  } = useWorkspaceViewActions({
    activeGroup,
    activeGroupId,
    setGroupView,
    patchGroupItems,
    setGroupCanvasSize,
    setGroupColors,
    setGroupLocked,
    setGroupAnnotations,
    pushToast,
    runHistoryBatch,
    focusGroupOnItems,
    ensureCanvasFitsItems,
  });

  const { arrangeSelectedItems, autoArrange } = useWorkspaceLayoutActions({
    activeGroup,
    selectedItemIds,
    patchGroupItems,
    pushToast,
    runHistoryBatch,
    ensureCanvasFitsItems,
  });

  return {
    importVisibilitySnapshot,
    saveProject,
    saveProjectAs,
    openProject,
    importFromPayload,
    retryImportEntry,
    copySelectedItemsToClipboard,
    cutSelectedItems,
    pasteClipboardItems,
    deleteSelectedItems,
    flipSelectedItemsHorizontally,
    applyCropToSelectedImage,
    arrangeSelectedItems,
    handleBoardViewChange,
    handleBoardItemsPatch,
    handleShellDragOver,
    handleShellDrop,
    changeCanvasSize,
    changeCanvasColors,
    resetCanvasColors,
    toggleCanvasLock,
    resetView,
    autoArrange,
  };
};
