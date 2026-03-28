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
const CANVAS_EXPANSION_PADDING = 140;
const MIN_CANVAS_WIDTH = 360;
const MIN_CANVAS_HEIGHT = 240;

interface UseCanvasWorkspaceOptions {
  project: Project;
  activeGroup: ReferenceGroup | undefined;
  activeGroupId: string | null;
  viewportSize: { width: number; height: number };
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
  viewportSize,
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

      const viewportWidth = Math.max(420, viewportSize.width);
      const viewportHeight = Math.max(320, viewportSize.height);
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

      const scaledCanvasWidth = canvasSize.width * fitZoom;
      const scaledCanvasHeight = canvasSize.height * fitZoom;
      const panX =
        scaledCanvasWidth <= viewportWidth
          ? (viewportWidth - scaledCanvasWidth) * 0.5
          : Math.min(
              24,
              Math.max(viewportWidth - scaledCanvasWidth - 24, unclampedPanX),
            );
      const panY =
        scaledCanvasHeight <= viewportHeight
          ? (viewportHeight - scaledCanvasHeight) * 0.5
          : Math.min(
              24,
              Math.max(
                viewportHeight - scaledCanvasHeight - 24,
                unclampedPanY,
              ),
            );

      setGroupView(groupId, fitZoom, panX, panY);
    },
    [setGroupView, viewportSize.height, viewportSize.width],
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
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        visible?: boolean;
      }>,
      currentSize: { width: number; height: number },
      currentView?: { zoom: number; panX: number; panY: number },
    ) => {
      const visibleItems = items.filter((item) => item.visible !== false);
      if (visibleItems.length === 0) {
        return;
      }

      const expandLeft = Math.max(
        0,
        Math.ceil(
          Math.max(0, -Math.min(...visibleItems.map((item) => item.x))) +
            (Math.min(...visibleItems.map((item) => item.x)) < 0
              ? CANVAS_EXPANSION_PADDING
              : 0),
        ),
      );
      const expandTop = Math.max(
        0,
        Math.ceil(
          Math.max(0, -Math.min(...visibleItems.map((item) => item.y))) +
            (Math.min(...visibleItems.map((item) => item.y)) < 0
              ? CANVAS_EXPANSION_PADDING
              : 0),
        ),
      );

      const normalizedItems =
        expandLeft > 0 || expandTop > 0
          ? items.map((item) => ({
              ...item,
              x: item.x + expandLeft,
              y: item.y + expandTop,
            }))
          : items;
      const normalizedVisibleItems = normalizedItems.filter(
        (item) => item.visible !== false,
      );

      const requiredWidth = Math.max(
        currentSize.width + expandLeft,
        ...normalizedVisibleItems.map((item) =>
          Math.ceil(item.x + item.width + CANVAS_EXPANSION_PADDING),
        ),
      );
      const requiredHeight = Math.max(
        currentSize.height + expandTop,
        ...normalizedVisibleItems.map((item) =>
          Math.ceil(item.y + item.height + CANVAS_EXPANSION_PADDING),
        ),
      );

      if (expandLeft > 0 || expandTop > 0) {
        const shiftedUpdates = Object.fromEntries(
          normalizedItems.map((item) => [
            item.id,
            {
              x: Math.round(item.x),
              y: Math.round(item.y),
            },
          ]),
        ) as Record<string, ImagePatch>;

        patchGroupItems(groupId, shiftedUpdates);

        if (currentView) {
          setGroupView(
            groupId,
            currentView.zoom,
            currentView.panX - expandLeft * currentView.zoom,
            currentView.panY - expandTop * currentView.zoom,
          );
        }
      }

      if (
        requiredWidth > currentSize.width ||
        requiredHeight > currentSize.height ||
        expandLeft > 0 ||
        expandTop > 0
      ) {
        setGroupCanvasSize(groupId, requiredWidth, requiredHeight);
      }
    },
    [patchGroupItems, setGroupCanvasSize, setGroupView],
  );

  const fitCanvasToItems = useCallback(
    (group: ReferenceGroup) => {
      const visibleItems = group.items.filter((item) => item.visible !== false);
      if (visibleItems.length === 0) {
        return null;
      }

      const minX = Math.min(...visibleItems.map((item) => item.x));
      const minY = Math.min(...visibleItems.map((item) => item.y));
      const maxX = Math.max(...visibleItems.map((item) => item.x + item.width));
      const maxY = Math.max(...visibleItems.map((item) => item.y + item.height));
      const shiftX = Math.round(CANVAS_EXPANSION_PADDING - minX);
      const shiftY = Math.round(CANVAS_EXPANSION_PADDING - minY);
      const nextWidth = Math.max(
        MIN_CANVAS_WIDTH,
        Math.ceil(maxX - minX + CANVAS_EXPANSION_PADDING * 2),
      );
      const nextHeight = Math.max(
        MIN_CANVAS_HEIGHT,
        Math.ceil(maxY - minY + CANVAS_EXPANSION_PADDING * 2),
      );
      const updates = Object.fromEntries(
        group.items.map((item) => [
          item.id,
          {
            x: Math.round(item.x + shiftX),
            y: Math.round(item.y + shiftY),
          },
        ]),
      ) as Record<string, ImagePatch>;

      return {
        canvasSize: {
          width: nextWidth,
          height: nextHeight,
        },
        updates,
      };
    },
    [],
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

        const viewportWidth = Math.max(520, viewportSize.width);
        const viewportHeight = Math.max(380, viewportSize.height);
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
            const nextX =
              centerWorldX - item.width / 2 + (index % 4) * (item.width + 44);
            const nextY =
              centerWorldY -
              item.height / 2 +
              Math.floor(index / 4) * (item.height + 44);

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
          {
            zoom: activeGroup.zoom,
            panX: activeGroup.panX,
            panY: activeGroup.panY,
          },
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
      viewportSize.height,
      viewportSize.width,
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
        ensureCanvasFitsItems(activeGroupId, nextItems, activeGroup.canvasSize, {
          zoom: activeGroup.zoom,
          panX: activeGroup.panX,
          panY: activeGroup.panY,
        });
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

    const fittedCanvas = fitCanvasToItems(activeGroup);
    if (fittedCanvas) {
      patchGroupItems(activeGroup.id, fittedCanvas.updates);
      setGroupCanvasSize(
        activeGroup.id,
        fittedCanvas.canvasSize.width,
        fittedCanvas.canvasSize.height,
      );

      requestAnimationFrame(() => {
        focusGroupOnItems(
          activeGroup.id,
          [
            {
              x: 0,
              y: 0,
              width: fittedCanvas.canvasSize.width,
              height: fittedCanvas.canvasSize.height,
            },
          ],
          fittedCanvas.canvasSize,
        );
      });
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
  }, [activeGroup, fitCanvasToItems, focusGroupOnItems, patchGroupItems, setGroupCanvasSize]);

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
