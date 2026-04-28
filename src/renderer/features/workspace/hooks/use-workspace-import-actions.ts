import {
  useCallback,
  useMemo,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import type { ImageItem, Project, ReferenceGroup } from "@shared/types/project";
import {
  buildImageItemsFromPayload,
  collectDropPayload,
  getDataUrlByteLength,
  inferImageFormatLabel,
  type ImportPayload,
} from "@renderer/features/import/image-import";
import { extractImageSwatches } from "@renderer/features/import/swatches";
import {
  measureImageSize,
  normalizePreviewSize,
  stripBlockedSuffix,
  type ImportQueueEntry,
} from "@renderer/features/import/import-queue";
import type { ProgressToastController } from "@renderer/hooks/use-toast";
import type { ImagePatch, ToastKind } from "@renderer/features/workspace/types";
import {
  buildAutoArrangeUpdates,
  calculateImportVisibilitySnapshot,
} from "@renderer/features/workspace/utils/layout";
import { useI18n } from "@renderer/i18n";

interface UseWorkspaceImportActionsOptions {
  project: Project;
  activeGroup: ReferenceGroup | undefined;
  autoArrangeOnImport: boolean;
  viewportSize: { width: number; height: number };
  lastImportedItemIds: string[];
  importQueue: ImportQueueEntry[];
  addGroupItems: (groupId: string, items: ReferenceGroup["items"]) => void;
  patchGroupItems: (groupId: string, updates: Record<string, ImagePatch>) => void;
  setProject: (project: Project) => void;
  setImportQueue: Dispatch<SetStateAction<ImportQueueEntry[]>>;
  setSelectedItemIds: Dispatch<SetStateAction<string[]>>;
  setLastImportedItemIds: Dispatch<SetStateAction<string[]>>;
  pushToast: (kind: ToastKind, message: string) => void;
  beginProgressToast: (
    label: string,
    initialProgress?: number,
  ) => ProgressToastController;
  runHistoryBatch: (callback: () => void) => void;
  ensureCanvasFitsItems: (
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
    currentView?: { zoom: number; panX: number; panY: number },
  ) => void;
}

export const useWorkspaceImportActions = ({
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
}: UseWorkspaceImportActionsOptions) => {
  const { copy } = useI18n();
  const importVisibilitySnapshot = useMemo(() => {
    return calculateImportVisibilitySnapshot(activeGroup, lastImportedItemIds);
  }, [activeGroup, lastImportedItemIds]);

  const importFromPayload = useCallback(
    async (
      payload: ImportPayload,
      options?: {
        dropViewportPoint?: { x: number; y: number };
      },
    ) => {
      if (!activeGroup) {
        return;
      }

      if (activeGroup.locked) {
        pushToast("info", copy.toasts.canvasLocked);
        return;
      }

      if (payload.files.length === 0 && payload.urls.length === 0) {
        return;
      }

      const importProgress =
        payload.source === "drop"
          ? beginProgressToast(copy.toasts.importingImages, 12)
          : null;

      try {
        const importedItems = await buildImageItemsFromPayload({
          payload,
          group: activeGroup,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          resolveRemoteUrl: async (url) =>
            window.desktopApi.import.fetchRemoteImageDataUrl({ url }),
        });
        importProgress?.update(56, `${copy.toasts.importingImages} 56%`);

        if (importedItems.length === 0) {
          importProgress?.clear();
          pushToast("info", copy.toasts.noImportableImages);
          return;
        }

        runHistoryBatch(() => {
          addGroupItems(activeGroup.id, importedItems);
          setSelectedItemIds(importedItems.map((item) => item.id));

          const viewportWidth = Math.max(520, viewportSize.width);
          const viewportHeight = Math.max(380, viewportSize.height);
          const anchorViewportX =
            options?.dropViewportPoint?.x ?? viewportWidth * 0.5;
          const anchorViewportY =
            options?.dropViewportPoint?.y ?? viewportHeight * 0.5;
          const anchorWorldX =
            (anchorViewportX - activeGroup.panX) / activeGroup.zoom;
          const anchorWorldY =
            (anchorViewportY - activeGroup.panY) / activeGroup.zoom;

          const maxExistingZ = activeGroup.items.reduce(
            (acc, item) => Math.max(acc, item.zIndex),
            -1,
          );
          const importedWithRaisedZ = importedItems.map((item, index) => ({
            ...item,
            zIndex: maxExistingZ + index + 1,
          }));

          const importUpdates: Record<string, ImagePatch> = autoArrangeOnImport
            ? buildAutoArrangeUpdates(
                [...activeGroup.items, ...importedWithRaisedZ],
                activeGroup.canvasSize.width,
              )
            : (() => {
                const firstItem = importedWithRaisedZ[0];
                const shiftX = anchorWorldX - firstItem.x - firstItem.width * 0.5;
                const shiftY = anchorWorldY - firstItem.y - firstItem.height * 0.5;

                return Object.fromEntries(
                  importedWithRaisedZ.map((item, index) => [
                    item.id,
                    {
                      x: Math.round(item.x + shiftX),
                      y: Math.round(item.y + shiftY),
                      visible: true,
                      zIndex: maxExistingZ + index + 1,
                    },
                  ]),
                ) as Record<string, ImagePatch>;
              })();

          patchGroupItems(activeGroup.id, importUpdates);

          const nextItems = [
            ...activeGroup.items.map((item) => ({
              ...item,
              ...importUpdates[item.id],
            })),
            ...importedWithRaisedZ.map((item) => ({
              ...item,
              ...importUpdates[item.id],
            })),
          ];

          setLastImportedItemIds(importedItems.map((item) => item.id));

          ensureCanvasFitsItems(
            activeGroup.id,
            nextItems,
            activeGroup.canvasSize,
            {
              zoom: activeGroup.zoom,
              panX: activeGroup.panX,
              panY: activeGroup.panY,
            },
          );
        });
        importProgress?.update(86, `${copy.toasts.importingImages} 86%`);

        const blockedItemIds = importedItems
          .filter((item) => item.previewStatus === "blocked")
          .map((item) => item.id);
        const blockedCount = blockedItemIds.length;

        setImportQueue((previous) =>
          [
            {
              id: crypto.randomUUID(),
              source: payload.source,
              groupId: activeGroup.id,
              importedCount: importedItems.length,
              blockedItemIds,
              createdAt: new Date().toISOString(),
            },
            ...previous,
          ].slice(0, 12),
        );

        if (blockedCount > 0) {
          if (importProgress) {
            importProgress.complete(
              "info",
              copy.toasts.importedItemsWithBlockedPreviews(
                importedItems.length,
                blockedCount,
              ),
            );
          } else {
            pushToast(
              "info",
              copy.toasts.importedItemsWithBlockedPreviews(
                importedItems.length,
                blockedCount,
              ),
            );
          }
        } else {
          if (importProgress) {
            importProgress.complete(
              "success",
              copy.toasts.importedImageItems(importedItems.length),
            );
          } else {
            pushToast("success", copy.toasts.importedImageItems(importedItems.length));
          }
        }
      } catch (error) {
        console.error("Image import failed", error);
        if (importProgress) {
          importProgress.complete("error", copy.toasts.imageImportFailed);
        } else {
          pushToast("error", copy.toasts.imageImportFailed);
        }
      }
    },
    [
      activeGroup,
      addGroupItems,
      autoArrangeOnImport,
      beginProgressToast,
      copy.toasts,
      ensureCanvasFitsItems,
      patchGroupItems,
      pushToast,
      runHistoryBatch,
      setImportQueue,
      setLastImportedItemIds,
      setSelectedItemIds,
      viewportSize.height,
      viewportSize.width,
    ],
  );

  const retryImportEntry = useCallback(
    async (entryId: string) => {
      const entry = importQueue.find((candidate) => candidate.id === entryId);

      if (!entry || entry.blockedItemIds.length === 0) {
        pushToast("info", copy.toasts.noBlockedPreviewsToRetry);
        return;
      }

      const nextProject = structuredClone(project);
      const targetGroup = nextProject.groups.find(
        (group) => group.id === entry.groupId,
      );

      if (!targetGroup) {
        pushToast("error", copy.toasts.targetGroupNotFoundForRetry);
        return;
      }

      let recoveredCount = 0;

      for (const itemId of entry.blockedItemIds) {
        const targetItem = targetGroup.items.find(
          (item): item is ImageItem =>
            item.type === "image" && item.id === itemId,
        );

        if (!targetItem || targetItem.previewStatus !== "blocked") {
          continue;
        }

        if (!targetItem.assetPath || !/^https?:\/\//i.test(targetItem.assetPath)) {
          continue;
        }

        const dataUrl = await window.desktopApi.import.fetchRemoteImageDataUrl({
          url: targetItem.assetPath,
        });

        if (!dataUrl) {
          continue;
        }

        try {
          const measured = await measureImageSize(dataUrl);
          const size = normalizePreviewSize(measured.width, measured.height);
          const swatches = await extractImageSwatches(dataUrl);

          targetItem.assetPath = dataUrl;
          targetItem.previewStatus = "ready";
          targetItem.label = stripBlockedSuffix(targetItem.label);
          targetItem.originalWidth = measured.width;
          targetItem.originalHeight = measured.height;
          targetItem.fileSizeBytes = getDataUrlByteLength(dataUrl) ?? undefined;
          targetItem.format =
            targetItem.format ??
            inferImageFormatLabel(targetItem.assetPath) ??
            inferImageFormatLabel(dataUrl) ??
            undefined;
          targetItem.width = size.width;
          targetItem.height = size.height;
          targetItem.swatchHex = swatches[0]?.colorHex;
          targetItem.swatches = swatches;
          recoveredCount += 1;
        } catch {
          continue;
        }
      }

      if (recoveredCount > 0) {
        nextProject.updatedAt = new Date().toISOString();
        setProject(nextProject);
      }

      const refreshedGroup = nextProject.groups.find(
        (group) => group.id === entry.groupId,
      );

      const remainingBlockedIds =
        refreshedGroup?.items
          .filter(
            (item): item is ImageItem =>
              item.type === "image" &&
              entry.blockedItemIds.includes(item.id) &&
              item.previewStatus === "blocked",
          )
          .map((item) => item.id) ?? [];

      setImportQueue((previous) =>
        previous.map((candidate) =>
          candidate.id === entryId
            ? { ...candidate, blockedItemIds: remainingBlockedIds }
            : candidate,
        ),
      );

      if (recoveredCount > 0) {
        pushToast("success", copy.toasts.recoveredBlockedPreviews(recoveredCount));
      } else {
        pushToast("info", copy.toasts.retryCompleteNoRecovered);
      }
    },
    [copy.toasts, importQueue, project, pushToast, setImportQueue, setProject],
  );

  const handleShellDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
  }, []);

  const handleShellDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const payload = collectDropPayload(event.nativeEvent);
      void importFromPayload(payload);
    },
    [importFromPayload],
  );

  return {
    importVisibilitySnapshot,
    importFromPayload,
    retryImportEntry,
    handleShellDragOver,
    handleShellDrop,
  };
};
