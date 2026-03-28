import {
  useCallback,
  useMemo,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import type {
  CanvasItem,
  ImageItem,
  LayoutMode,
  Project,
  ReferenceGroup,
} from "@shared/types/project";
import {
  buildImageItemsFromPayload,
  collectDropPayload,
  type ImportPayload,
} from "@renderer/features/import/image-import";
import { extractImageSwatches } from "@renderer/features/import/swatches";
import {
  measureImageSize,
  normalizePreviewSize,
  stripBlockedSuffix,
  type ImportQueueEntry,
} from "@renderer/features/import/import-queue";

type ToastKind = "success" | "error" | "info";
type ImagePatch = Partial<Omit<ImageItem, "id" | "type">>;
const CANVAS_EXPANSION_PADDING = 24;
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
  clipboardItems: CanvasItem[];
  setProject: (project: Project) => void;
  setGroupView: (
    groupId: string,
    zoom: number,
    panX: number,
    panY: number,
  ) => void;
  patchGroupItems: (groupId: string, updates: Record<string, ImagePatch>) => void;
  addGroupItems: (groupId: string, items: CanvasItem[]) => void;
  removeGroupItems: (groupId: string, itemIds: string[]) => void;
  setGroupCanvasSize: (groupId: string, width: number, height: number) => void;
  setImportQueue: Dispatch<SetStateAction<ImportQueueEntry[]>>;
  setClipboardItems: Dispatch<SetStateAction<CanvasItem[]>>;
  setSelectedItemIds: Dispatch<SetStateAction<string[]>>;
  setLastImportedItemIds: Dispatch<SetStateAction<string[]>>;
  pushToast: (kind: ToastKind, message: string) => void;
  refreshRecents: () => void;
  runHistoryBatch: (callback: () => void) => void;
}

export const useCanvasWorkspace = ({
  project,
  activeGroup,
  activeGroupId,
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
  setGroupCanvasSize,
  setImportQueue,
  setClipboardItems,
  setSelectedItemIds,
  setLastImportedItemIds,
  pushToast,
  refreshRecents,
  runHistoryBatch,
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

    const nextProject = {
      ...project,
      filePath: response.filePath,
    };

    setProject(nextProject);
    refreshRecents();
    pushToast("success", "Canvas saved.");
    return nextProject;
  }, [project, pushToast, refreshRecents, setProject]);

  const saveProjectAs = useCallback(async () => {
    const response = await window.desktopApi.project.saveAs({
      project,
      filePath: project.filePath,
    });

    if (!response) {
      return;
    }

    const nextProject = {
      ...project,
      filePath: response.filePath,
    };

    setProject(nextProject);
    refreshRecents();
    pushToast("success", "Canvas saved to a new file.");
    return nextProject;
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
    return response.project;
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

        runHistoryBatch(() => {
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

          const itemsPerRow = 4;
          const rows = Array.from(
            { length: Math.ceil(importedItems.length / itemsPerRow) },
            (_, rowIndex) =>
              importedItems.slice(
                rowIndex * itemsPerRow,
                rowIndex * itemsPerRow + itemsPerRow,
              ),
          );
          const totalLayoutHeight = rows.reduce(
            (sum, row) => sum + Math.max(...row.map((item) => item.height)),
            0,
          );
          let cursorY = centerWorldY - totalLayoutHeight * 0.5;

          const rescueEntries = rows.flatMap((row, rowIndex) => {
            const rowWidth = row.reduce((sum, item) => sum + item.width, 0);
            const rowHeight = Math.max(...row.map((item) => item.height));
            let cursorX = centerWorldX - rowWidth * 0.5;

            const entries = row.map((item, columnIndex) => {
              const nextX = cursorX;
              const nextY = cursorY + (rowHeight - item.height) * 0.5;
              cursorX += item.width;

              return [
                item.id,
                {
                  x: Math.round(nextX),
                  y: Math.round(nextY),
                  visible: true,
                  zIndex: maxExistingZ + rowIndex * itemsPerRow + columnIndex + 1,
                },
              ] as const;
            });

            cursorY += rowHeight;
            return entries;
          });

          const rescueUpdates = Object.fromEntries(
            rescueEntries,
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
        });

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
      runHistoryBatch,
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
          const swatches = await extractImageSwatches(dataUrl);

          targetItem.assetPath = dataUrl;
          targetItem.previewStatus = "ready";
          targetItem.label = stripBlockedSuffix(targetItem.label);
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
        pushToast("success", `Recovered ${recoveredCount} blocked preview(s).`);
      } else {
        pushToast("info", "Retry complete. No additional previews recovered.");
      }
    },
    [importQueue, project, pushToast, setProject, setImportQueue],
  );

  const copySelectedItemsToClipboard = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected items to copy.");
      return;
    }

    const selectedItems = activeGroup.items
      .filter((item) => selectedItemIds.includes(item.id))
      .sort((left, right) => left.zIndex - right.zIndex);

    if (selectedItems.length === 0) {
      pushToast("info", "No selected items to copy.");
      return;
    }

    setClipboardItems(structuredClone(selectedItems));
    pushToast("success", `Copied ${selectedItems.length} item(s) to clipboard.`);
  }, [
    activeGroup,
    pushToast,
    selectedItemIds,
    setClipboardItems,
  ]);

  const cutSelectedItems = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected items to cut.");
      return;
    }

    const selectedItems = activeGroup.items
      .filter((item) => selectedItemIds.includes(item.id))
      .sort((left, right) => left.zIndex - right.zIndex);

    if (selectedItems.length === 0) {
      pushToast("info", "No selected items to cut.");
      return;
    }

    setClipboardItems(structuredClone(selectedItems));
    runHistoryBatch(() => {
      removeGroupItems(activeGroup.id, selectedItemIds);
      setSelectedItemIds([]);
    });
    pushToast("success", "Selected item(s) cut.");
  }, [
    activeGroup,
    pushToast,
    removeGroupItems,
    runHistoryBatch,
    selectedItemIds,
    setClipboardItems,
    setSelectedItemIds,
  ]);

  const pasteClipboardItems = useCallback(() => {
    if (!activeGroup || clipboardItems.length === 0) {
      pushToast("info", "Clipboard is empty.");
      return;
    }

    const maxExistingZ = activeGroup.items.reduce(
      (acc, item) => Math.max(acc, item.zIndex),
      -1,
    );

    const duplicates = clipboardItems.map((item, index) => ({
      ...structuredClone(item),
      id: crypto.randomUUID(),
      x: item.x + 24,
      y: item.y + 24,
      zIndex: maxExistingZ + index + 1,
    }));

    runHistoryBatch(() => {
      addGroupItems(activeGroup.id, duplicates);
      setSelectedItemIds(duplicates.map((item) => item.id));
      ensureCanvasFitsItems(
        activeGroup.id,
        [...activeGroup.items, ...duplicates],
        activeGroup.canvasSize,
        {
          zoom: activeGroup.zoom,
          panX: activeGroup.panX,
          panY: activeGroup.panY,
        },
      );
    });

    pushToast("success", `Pasted ${duplicates.length} item(s).`);
  }, [
    activeGroup,
    addGroupItems,
    clipboardItems,
    ensureCanvasFitsItems,
    pushToast,
    runHistoryBatch,
    setSelectedItemIds,
  ]);

  const deleteSelectedItems = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected images to delete.");
      return;
    }

    runHistoryBatch(() => {
      removeGroupItems(activeGroup.id, selectedItemIds);
      setSelectedItemIds([]);
    });
    pushToast("success", "Selected image(s) deleted.");
  }, [
    activeGroup,
    pushToast,
    removeGroupItems,
    runHistoryBatch,
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

      runHistoryBatch(() => {
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
      });
    },
    [activeGroup, activeGroupId, ensureCanvasFitsItems, patchGroupItems, runHistoryBatch],
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
      runHistoryBatch(() => {
        patchGroupItems(activeGroup.id, fittedCanvas.updates);
        setGroupCanvasSize(
          activeGroup.id,
          fittedCanvas.canvasSize.width,
          fittedCanvas.canvasSize.height,
        );
      });

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

  const arrangeSelectedItems = useCallback(
    (mode: LayoutMode) => {
      if (!activeGroup || selectedItemIds.length === 0) {
        pushToast("info", "No selected items to arrange.");
        return;
      }

      const selectedItems = activeGroup.items
        .filter((item) => selectedItemIds.includes(item.id))
        .sort((left, right) => left.zIndex - right.zIndex);

      if (selectedItems.length === 0) {
        pushToast("info", "No selected items to arrange.");
        return;
      }

      const anchorX = Math.min(...selectedItems.map((item) => item.x));
      const anchorY = Math.min(...selectedItems.map((item) => item.y));
      const gap = 2;
      const updates: Record<string, ImagePatch> = {};

      if (mode === "horizontal") {
        let cursorX = anchorX;
        selectedItems.forEach((item) => {
          updates[item.id] = {
            x: Math.round(cursorX),
            y: Math.round(anchorY),
          };
          cursorX += item.width + gap;
        });
      } else {
        const columnCount = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(selectedItems.length))));
        const columnWidth = Math.max(...selectedItems.map((item) => item.width)) + gap;
        const columnHeights = Array.from({ length: columnCount }, () => anchorY);

        selectedItems.forEach((item) => {
          let columnIndex = 0;
          for (let index = 1; index < columnHeights.length; index += 1) {
            if (columnHeights[index] < columnHeights[columnIndex]) {
              columnIndex = index;
            }
          }

          updates[item.id] = {
            x: Math.round(anchorX + columnIndex * columnWidth),
            y: Math.round(columnHeights[columnIndex]),
          };
          columnHeights[columnIndex] += item.height + gap;
        });
      }

      runHistoryBatch(() => {
        patchGroupItems(activeGroup.id, updates);

        const nextItems = activeGroup.items.map((item) => ({
          ...item,
          ...updates[item.id],
        }));
        ensureCanvasFitsItems(activeGroup.id, nextItems, activeGroup.canvasSize, {
          zoom: activeGroup.zoom,
          panX: activeGroup.panX,
          panY: activeGroup.panY,
        });
      });

      pushToast(
        "success",
        mode === "horizontal"
          ? "Selected items arranged horizontally."
          : "Selected items arranged in Pinterest layout.",
      );
    },
    [
      activeGroup,
      ensureCanvasFitsItems,
      patchGroupItems,
      pushToast,
      runHistoryBatch,
      selectedItemIds,
    ],
  );

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

    const padding = 0;
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

    pushToast("success", "Items arranged across the canvas.");
  }, [activeGroup, patchGroupItems, pushToast]);

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
    arrangeSelectedItems,
    handleBoardViewChange,
    handleBoardItemsPatch,
    handleShellDragOver,
    handleShellDrop,
    resetView,
    autoArrange,
  };
};
