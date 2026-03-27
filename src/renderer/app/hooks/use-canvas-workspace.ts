import { useCallback, useMemo, type Dispatch, type DragEvent, type SetStateAction } from "react";
import type { ImageItem, Project, ReferenceGroup } from "@shared/types/project";
import {
  buildImageItemsFromPayload,
  collectDropPayload,
  type ImportPayload,
} from "@renderer/features/import/image-import";
import {
  measureImageSize,
  normalizePreviewSize,
  stripBlockedSuffix,
  type ImportQueueEntry,
} from "@renderer/features/import/import-queue";

type ToastKind = "success" | "error" | "info";
type ImagePatch = Partial<Omit<ImageItem, "id" | "type">>;

interface UseCanvasWorkspaceOptions {
  project: Project;
  activeGroup: ReferenceGroup | undefined;
  activeGroupId: string | null;
  selectedItemIds: string[];
  lastImportedItemIds: string[];
  importQueue: ImportQueueEntry[];
  setProject: (project: Project) => void;
  setGroupView: (
    groupId: string,
    zoom: number,
    panX: number,
    panY: number,
  ) => void;
  patchGroupItems: (groupId: string, updates: Record<string, ImagePatch>) => void;
  addGroupItems: (groupId: string, items: ImageItem[]) => void;
  removeGroupItems: (groupId: string, itemIds: string[]) => void;
  setGroupCanvasSize: (groupId: string, width: number, height: number) => void;
  setImportQueue: Dispatch<SetStateAction<ImportQueueEntry[]>>;
  setSelectedItemIds: Dispatch<SetStateAction<string[]>>;
  setLastImportedItemIds: Dispatch<SetStateAction<string[]>>;
  pushToast: (kind: ToastKind, message: string) => void;
  refreshRecents: () => void;
}

export const useCanvasWorkspace = ({
  project,
  activeGroup,
  activeGroupId,
  selectedItemIds,
  lastImportedItemIds,
  importQueue,
  setProject,
  setGroupView,
  patchGroupItems,
  addGroupItems,
  removeGroupItems,
  setGroupCanvasSize,
  setImportQueue,
  setSelectedItemIds,
  setLastImportedItemIds,
  pushToast,
  refreshRecents,
}: UseCanvasWorkspaceOptions) => {
  const focusGroupOnItems = useCallback(
    (
      groupId: string,
      items: Array<{ x: number; y: number; width: number; height: number }>,
      canvasSize: { width: number; height: number },
    ) => {
      if (items.length === 0) {
        return;
      }

      const bounds = items.reduce(
        (acc, item) => ({
          minX: Math.min(acc.minX, item.x),
          minY: Math.min(acc.minY, item.y),
          maxX: Math.max(acc.maxX, item.x + item.width),
          maxY: Math.max(acc.maxY, item.y + item.height),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        },
      );

      const viewportWidth = Math.max(420, window.innerWidth - 420);
      const viewportHeight = Math.max(320, window.innerHeight - 180);
      const fitPadding = 64;
      const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
      const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);

      const fitZoom = Math.min(
        2.2,
        Math.max(
          0.18,
          Math.min(
            viewportWidth / (boundsWidth + fitPadding * 2),
            viewportHeight / (boundsHeight + fitPadding * 2),
            1.45,
          ),
        ),
      );

      const centerX = (bounds.minX + bounds.maxX) * 0.5;
      const centerY = (bounds.minY + bounds.maxY) * 0.5;

      const unclampedPanX = viewportWidth * 0.5 - centerX * fitZoom;
      const unclampedPanY = viewportHeight * 0.5 - centerY * fitZoom;

      const minPanX = viewportWidth - canvasSize.width * fitZoom - 24;
      const maxPanX = 24;
      const minPanY = viewportHeight - canvasSize.height * fitZoom - 24;
      const maxPanY = 24;

      const panX = Math.min(maxPanX, Math.max(minPanX, unclampedPanX));
      const panY = Math.min(maxPanY, Math.max(minPanY, unclampedPanY));

      setGroupView(groupId, fitZoom, panX, panY);
    },
    [setGroupView],
  );

  const importVisibilitySnapshot = useMemo(() => {
    if (!activeGroup || lastImportedItemIds.length === 0) {
      return null;
    }

    const importedSet = new Set(lastImportedItemIds);
    const importedItems = activeGroup.items.filter(
      (item): item is ImageItem =>
        item.type === "image" && importedSet.has(item.id),
    );

    if (importedItems.length === 0) {
      return {
        total: 0,
        visible: 0,
        ready: 0,
        blocked: 0,
        offCanvas: 0,
      };
    }

    const offCanvas = importedItems.filter((item) => {
      const right = item.x + item.width;
      const bottom = item.y + item.height;
      return (
        right < 0 ||
        bottom < 0 ||
        item.x > activeGroup.canvasSize.width ||
        item.y > activeGroup.canvasSize.height
      );
    }).length;

    return {
      total: importedItems.length,
      visible: importedItems.filter((item) => item.visible).length,
      ready: importedItems.filter((item) => item.previewStatus === "ready").length,
      blocked: importedItems.filter((item) => item.previewStatus === "blocked")
        .length,
      offCanvas,
    };
  }, [activeGroup, lastImportedItemIds]);

  const ensureCanvasFitsItems = useCallback(
    (
      groupId: string,
      items: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        visible?: boolean;
      }>,
      currentSize: { width: number; height: number },
    ) => {
      const visibleItems = items.filter((item) => item.visible !== false);
      if (visibleItems.length === 0) {
        return;
      }

      const padding = 180;
      const requiredWidth = Math.max(
        currentSize.width,
        ...visibleItems.map((item) => Math.ceil(item.x + item.width + padding)),
      );
      const requiredHeight = Math.max(
        currentSize.height,
        ...visibleItems.map((item) => Math.ceil(item.y + item.height + padding)),
      );

      if (
        requiredWidth > currentSize.width ||
        requiredHeight > currentSize.height
      ) {
        setGroupCanvasSize(groupId, requiredWidth, requiredHeight);
      }
    },
    [setGroupCanvasSize],
  );

  const saveProject = useCallback(async () => {
    const response = await window.desktopApi.project.save({
      project,
      filePath: project.filePath,
    });

    setProject({
      ...project,
      filePath: response.filePath,
    });
    refreshRecents();
    pushToast("success", "Canvas saved.");
  }, [project, pushToast, refreshRecents, setProject]);

  const saveProjectAs = useCallback(async () => {
    const response = await window.desktopApi.project.saveAs({
      project,
      filePath: project.filePath,
    });

    if (!response) {
      return;
    }

    setProject({
      ...project,
      filePath: response.filePath,
    });
    refreshRecents();
    pushToast("success", "Canvas saved to a new file.");
  }, [project, pushToast, refreshRecents, setProject]);

  const openProject = useCallback(async () => {
    const response = await window.desktopApi.project.open();
    if (!response) {
      return;
    }

    setProject(response.project);
    setSelectedItemIds([]);
    refreshRecents();
    pushToast("success", "Canvas opened.");
  }, [pushToast, refreshRecents, setProject, setSelectedItemIds]);

  const importFromPayload = useCallback(
    async (payload: ImportPayload) => {
      if (!activeGroup) {
        return;
      }

      if (payload.files.length === 0 && payload.urls.length === 0) {
        return;
      }

      try {
        const importedItems = await buildImageItemsFromPayload({
          payload,
          group: activeGroup,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          resolveRemoteUrl: async (url) =>
            window.desktopApi.import.fetchRemoteImageDataUrl({ url }),
        });

        if (importedItems.length === 0) {
          pushToast("info", "No importable images found.");
          return;
        }

        addGroupItems(activeGroup.id, importedItems);
        setSelectedItemIds(importedItems.map((item) => item.id));

        const viewportWidth = Math.max(520, window.innerWidth - 360);
        const viewportHeight = Math.max(380, window.innerHeight - 160);
        const centerWorldX =
          (viewportWidth * 0.5 - activeGroup.panX) / activeGroup.zoom;
        const centerWorldY =
          (viewportHeight * 0.5 - activeGroup.panY) / activeGroup.zoom;

        const maxExistingZ = activeGroup.items.reduce(
          (acc, item) => Math.max(acc, item.zIndex),
          -1,
        );

        const rescueUpdates = Object.fromEntries(
          importedItems.map((item, index) => {
            const nextX = Math.min(
              Math.max(20, centerWorldX - item.width / 2 + (index % 4) * 44),
              Math.max(20, activeGroup.canvasSize.width - item.width - 20),
            );
            const nextY = Math.min(
              Math.max(
                20,
                centerWorldY - item.height / 2 + Math.floor(index / 4) * 44,
              ),
              Math.max(20, activeGroup.canvasSize.height - item.height - 20),
            );

            return [
              item.id,
              {
                x: Math.round(nextX),
                y: Math.round(nextY),
                visible: true,
                zIndex: maxExistingZ + index + 1,
              },
            ];
          }),
        ) as Record<string, ImagePatch>;

        patchGroupItems(activeGroup.id, rescueUpdates);

        const rescuedItems = importedItems.map((item) => ({
          ...item,
          ...rescueUpdates[item.id],
        }));

        setLastImportedItemIds(importedItems.map((item) => item.id));

        ensureCanvasFitsItems(
          activeGroup.id,
          [...activeGroup.items, ...rescuedItems],
          activeGroup.canvasSize,
        );

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
          pushToast(
            "info",
            `Imported ${importedItems.length} item(s); ${blockedCount} remote preview(s) blocked.`,
          );
        } else {
          pushToast("success", `Imported ${importedItems.length} image item(s).`);
        }
      } catch (error) {
        console.error("Image import failed", error);
        pushToast("error", "Image import failed.");
      }
    },
    [
      activeGroup,
      addGroupItems,
      ensureCanvasFitsItems,
      patchGroupItems,
      pushToast,
      setImportQueue,
      setLastImportedItemIds,
      setSelectedItemIds,
    ],
  );

  const retryImportEntry = useCallback(
    async (entryId: string) => {
      const entry = importQueue.find((candidate) => candidate.id === entryId);

      if (!entry || entry.blockedItemIds.length === 0) {
        pushToast("info", "No blocked previews to retry.");
        return;
      }

      const nextProject = structuredClone(project);
      const targetGroup = nextProject.groups.find(
        (group) => group.id === entry.groupId,
      );

      if (!targetGroup) {
        pushToast("error", "Target group not found for retry.");
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

          targetItem.assetPath = dataUrl;
          targetItem.previewStatus = "ready";
          targetItem.label = stripBlockedSuffix(targetItem.label);
          targetItem.width = size.width;
          targetItem.height = size.height;
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
        pushToast("success", `Recovered ${recoveredCount} blocked preview(s).`);
      } else {
        pushToast("info", "Retry complete. No additional previews recovered.");
      }
    },
    [importQueue, project, pushToast, setProject, setImportQueue],
  );

  const copySelectedImagesToClipboard = useCallback(async () => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected image to copy.");
      return;
    }

    const selectedImages = activeGroup.items.filter(
      (item): item is ImageItem =>
        item.type === "image" && selectedItemIds.includes(item.id),
    );

    for (const imageItem of selectedImages) {
      let dataUrl: string | null = null;
      const assetPath = imageItem.assetPath;

      if (
        typeof assetPath === "string" &&
        assetPath.startsWith("data:image/")
      ) {
        dataUrl = assetPath;
      } else if (
        typeof assetPath === "string" &&
        /^https?:\/\//i.test(assetPath)
      ) {
        dataUrl = await window.desktopApi.import.fetchRemoteImageDataUrl({
          url: assetPath,
        });
      }

      if (!dataUrl) {
        continue;
      }

      const copied = await window.desktopApi.clipboard.writeImageFromDataUrl({
        dataUrl,
      });

      if (copied) {
        pushToast("success", "Copied image to system clipboard.");
        return;
      }
    }

    pushToast("error", "Unable to copy selected images.");
  }, [activeGroup, pushToast, selectedItemIds]);

  const deleteSelectedItems = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected images to delete.");
      return;
    }

    removeGroupItems(activeGroup.id, selectedItemIds);
    setSelectedItemIds([]);
    pushToast("success", "Selected image(s) deleted.");
  }, [
    activeGroup,
    pushToast,
    removeGroupItems,
    selectedItemIds,
    setSelectedItemIds,
  ]);

  const handleBoardViewChange = useCallback(
    (zoom: number, panX: number, panY: number) => {
      if (!activeGroupId) {
        return;
      }

      setGroupView(activeGroupId, zoom, panX, panY);
    },
    [activeGroupId, setGroupView],
  );

  const handleBoardItemsPatch = useCallback(
    (updates: Record<string, ImagePatch>) => {
      if (!activeGroupId) {
        return;
      }

      patchGroupItems(activeGroupId, updates);

      if (activeGroup) {
        const nextItems = activeGroup.items.map((item) => ({
          ...item,
          ...updates[item.id],
        }));
        ensureCanvasFitsItems(activeGroupId, nextItems, activeGroup.canvasSize);
      }
    },
    [activeGroup, activeGroupId, ensureCanvasFitsItems, patchGroupItems],
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

  const resetView = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    focusGroupOnItems(
      activeGroup.id,
      [
        {
          x: 0,
          y: 0,
          width: activeGroup.canvasSize.width,
          height: activeGroup.canvasSize.height,
        },
      ],
      activeGroup.canvasSize,
    );
  }, [activeGroup, focusGroupOnItems]);

  const autoArrange = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    const visibleItems = activeGroup.items
      .filter((item) => item.visible)
      .sort((left, right) => left.zIndex - right.zIndex);

    if (visibleItems.length === 0) {
      pushToast("info", "Nothing to arrange.");
      return;
    }

    const padding = 42;
    const updates: Record<string, ImagePatch> = {};
    let cursorX = padding;
    let cursorY = padding;
    let rowHeight = 0;

    visibleItems.forEach((item) => {
      if (cursorX + item.width > activeGroup.canvasSize.width - padding) {
        cursorX = padding;
        cursorY += rowHeight + padding;
        rowHeight = 0;
      }

      updates[item.id] = {
        x: cursorX,
        y: cursorY,
      };

      cursorX += item.width + padding;
      rowHeight = Math.max(rowHeight, item.height);
    });

    patchGroupItems(activeGroup.id, updates);

    requestAnimationFrame(() => {
      focusGroupOnItems(
        activeGroup.id,
        visibleItems.map((item) => ({
          ...item,
          ...updates[item.id],
          width: item.width,
          height: item.height,
        })),
        activeGroup.canvasSize,
      );
    });

    pushToast("success", "Items arranged across the canvas.");
  }, [activeGroup, focusGroupOnItems, patchGroupItems, pushToast]);

  return {
    importVisibilitySnapshot,
    saveProject,
    saveProjectAs,
    openProject,
    importFromPayload,
    retryImportEntry,
    copySelectedImagesToClipboard,
    deleteSelectedItems,
    handleBoardViewChange,
    handleBoardItemsPatch,
    handleShellDragOver,
    handleShellDrop,
    resetView,
    autoArrange,
  };
};
