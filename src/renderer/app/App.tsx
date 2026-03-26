import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import type { Project } from "@shared/types/project";
import { CanvasBoard } from "@renderer/pixi/CanvasBoard";
import {
  ProjectProvider,
  useProjectStore,
} from "@renderer/state/project-store";
import { TodoList } from "@renderer/components/TodoList";
import { useShortcuts } from "@renderer/hooks/use-shortcuts";
import {
  buildImageItemsFromPayload,
  collectClipboardPayload,
  collectDropPayload,
  type ImportPayload,
} from "@renderer/features/import/image-import";
import type { ImageItem } from "@shared/types/project";
import { useToast } from "@renderer/hooks/use-toast";
import { useImportQueueSession } from "@renderer/hooks/use-import-queue-session";
import {
  normalizePreviewSize,
  measureImageSize,
  stripBlockedSuffix,
} from "@renderer/features/import/import-queue";

export const App = () => {
  const [initialProject, setInitialProject] = useState<Project | null>(null);

  useEffect(() => {
    window.desktopApi.project
      .create()
      .then(setInitialProject)
      .catch(() => null);
  }, []);

  if (!initialProject) {
    return <div className="booting">Loading CanvasTool…</div>;
  }

  return (
    <ProjectProvider initialProject={initialProject}>
      <AppContent />
    </ProjectProvider>
  );
};

const AppContent = () => {
  const [version, setVersion] = useState("loading");
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [lastImportedItemIds, setLastImportedItemIds] = useState<string[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [retryingEntryId, setRetryingEntryId] = useState<string | null>(null);

  const {
    project,
    setProject,
    setActiveGroup,
    setGroupView,
    patchGroupItems,
    addGroupItems,
    flipItems,
    addTask,
    addTodo,
    toggleTodo,
    renameTodo,
    reorderTodo,
  } = useProjectStore();

  const activeGroup = useMemo(
    () =>
      project.groups.find((group) => group.id === project.activeGroupId) ??
      project.groups[0],
    [project.activeGroupId, project.groups],
  );

  const activeGroupId = activeGroup?.id ?? null;

  const activeTask = useMemo(() => {
    if (!project.tasks.length) {
      return null;
    }

    const selected = project.tasks.find((task) => task.id === activeTaskId);
    return selected ?? project.tasks[0];
  }, [project.tasks, activeTaskId]);

  const { toast, pushToast } = useToast();
  const { importQueue, setImportQueue } = useImportQueueSession(project);

  const refreshRecents = useCallback(() => {
    window.desktopApi.project
      .getRecentFiles()
      .then(setRecentFiles)
      .catch(() => setRecentFiles([]));
  }, []);

  useEffect(() => {
    window.desktopApi.app
      .getVersion()
      .then(setVersion)
      .catch(() => {
        setVersion("unknown");
      });
    refreshRecents();
  }, [refreshRecents]);

  useEffect(() => {
    const fileName = project.filePath?.split(/[\\/]/).at(-1);
    void window.desktopApi.window.setTitle({
      title: project.title,
      fileName,
    });
  }, [project.filePath, project.title]);

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

      const viewportWidth = Math.max(420, window.innerWidth - 380);
      const viewportHeight = Math.max(320, window.innerHeight - 180);
      const fitPadding = 64;
      const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
      const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);

      const fitZoom = Math.min(
        2.2,
        Math.max(
          0.35,
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
      ready: importedItems.filter((item) => item.previewStatus === "ready")
        .length,
      blocked: importedItems.filter((item) => item.previewStatus === "blocked")
        .length,
      offCanvas,
    };
  }, [activeGroup, lastImportedItemIds]);

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
  }, [project, setProject, refreshRecents]);

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
  }, [project, setProject, refreshRecents]);

  const openProject = useCallback(async () => {
    const response = await window.desktopApi.project.open();
    if (!response) {
      return;
    }

    setProject(response.project);
    setSelectedItemIds([]);
    refreshRecents();
  }, [setProject, refreshRecents]);

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
        );

        patchGroupItems(activeGroup.id, rescueUpdates);

        const rescuedItems = importedItems.map((item) => ({
          ...item,
          ...rescueUpdates[item.id],
        }));

        setLastImportedItemIds(importedItems.map((item) => item.id));

        requestAnimationFrame(() => {
          focusGroupOnItems(
            activeGroup.id,
            rescuedItems,
            activeGroup.canvasSize,
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
          pushToast(
            "success",
            `Imported ${importedItems.length} image item(s).`,
          );
        }
      } catch (error) {
        console.error("Image import failed", error);
        pushToast("error", "Image import failed.");
      }
    },
    [
      activeGroup,
      addGroupItems,
      focusGroupOnItems,
      patchGroupItems,
      pushToast,
      setImportQueue,
    ],
  );

  const retryImportEntry = useCallback(
    async (entryId: string) => {
      const entry = importQueue.find((candidate) => candidate.id === entryId);

      if (!entry || entry.blockedItemIds.length === 0) {
        pushToast("info", "No blocked previews to retry.");
        return;
      }

      setRetryingEntryId(entryId);

      try {
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

          if (
            !targetItem.assetPath ||
            !/^https?:\/\//i.test(targetItem.assetPath)
          ) {
            continue;
          }

          const dataUrl =
            await window.desktopApi.import.fetchRemoteImageDataUrl({
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
          pushToast(
            "success",
            `Recovered ${recoveredCount} blocked preview(s).`,
          );
        } else {
          pushToast(
            "info",
            "Retry complete. No additional previews recovered.",
          );
        }
      } finally {
        setRetryingEntryId(null);
      }
    },
    [importQueue, project, pushToast, setProject],
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
  }, [activeGroup, selectedItemIds, pushToast]);

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
    (updates: Record<string, Partial<Omit<ImageItem, "id" | "type">>>) => {
      if (!activeGroupId) {
        return;
      }

      patchGroupItems(activeGroupId, updates);
    },
    [activeGroupId, patchGroupItems],
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

  const shortcutHandlers = useMemo(
    () => ({
      "Ctrl+O": () => void openProject(),
      "Ctrl+S": () => void saveProject(),
      "Ctrl+Shift+S": () => void saveProjectAs(),
      "Ctrl+F": () => {
        if (!activeGroup || selectedItemIds.length === 0) {
          return;
        }

        flipItems(activeGroup.id, selectedItemIds);
      },
      "Ctrl+C": () => void copySelectedImagesToClipboard(),
      Delete: () => {
        if (!activeGroup || selectedItemIds.length === 0) {
          return;
        }

        const updates = Object.fromEntries(
          selectedItemIds.map((id) => [id, { visible: false }]),
        );
        patchGroupItems(activeGroup.id, updates);
        setSelectedItemIds([]);
      },
    }),
    [
      activeGroup,
      copySelectedImagesToClipboard,
      flipItems,
      openProject,
      patchGroupItems,
      saveProject,
      saveProjectAs,
      selectedItemIds,
    ],
  );

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

      const payload = collectClipboardPayload(event);
      if (payload.files.length === 0 && payload.urls.length === 0) {
        return;
      }

      event.preventDefault();
      void importFromPayload(payload);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [importFromPayload]);

  useShortcuts(shortcutHandlers);

  return (
    <div
      className="app-shell"
      onDragOver={handleShellDragOver}
      onDrop={handleShellDrop}
    >
      <aside className="left-panel">
        <div className="panel-block">
          <p className="eyebrow">CanvasTool</p>
          <h1>Artist Reference Workspace</h1>
          <p className="muted">
            Electron local backend + React panels + Pixi board.
          </p>
        </div>

        <div className="button-row">
          <button type="button" onClick={() => void openProject()}>
            Open
          </button>
          <button type="button" onClick={() => void saveProject()}>
            Save
          </button>
          <button type="button" onClick={() => void saveProjectAs()}>
            Save As
          </button>
        </div>

        <div className="info-card">
          <span className="info-label">Version</span>
          <strong>{version}</strong>
        </div>

        <div className="info-card">
          <span className="info-label">Current File</span>
          <strong>
            {project.filePath?.split(/[\\/]/).at(-1) ?? "Untitled.canvas"}
          </strong>
        </div>

        {importVisibilitySnapshot ? (
          <div className="info-card">
            <span className="info-label">Last Import State</span>
            <p className="metric-line">
              {importVisibilitySnapshot.visible}/
              {importVisibilitySnapshot.total} visible
            </p>
            <p className="metric-line">
              {importVisibilitySnapshot.ready} ready ·{" "}
              {importVisibilitySnapshot.blocked} blocked
            </p>
            <p className="metric-line">
              {importVisibilitySnapshot.offCanvas} outside canvas bounds
            </p>
          </div>
        ) : null}

        <div className="info-card">
          <span className="info-label">Recent Files</span>
          {recentFiles.length === 0 ? (
            <p className="muted">No recent files yet.</p>
          ) : null}
          {recentFiles.map((recentFile) => (
            <p key={recentFile} className="recent-file" title={recentFile}>
              {recentFile}
            </p>
          ))}
        </div>

        <div className="tasks-panel">
          <div className="task-panel-header">
            <h2>Tasks</h2>
            <button
              type="button"
              onClick={() => addTask(`Task ${project.tasks.length + 1}`)}
            >
              Add Task
            </button>
          </div>

          <div className="task-tabs">
            {project.tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className={
                  task.id === activeTask?.id ? "task-tab active" : "task-tab"
                }
                onClick={() => setActiveTaskId(task.id)}
              >
                {task.title}
              </button>
            ))}
          </div>

          {activeTask ? (
            <TodoList
              task={activeTask}
              onAddTodo={addTodo}
              onToggleTodo={toggleTodo}
              onRenameTodo={renameTodo}
              onReorderTodo={reorderTodo}
            />
          ) : null}
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Renderer</p>
            <h2>{activeGroup?.name ?? "Main Canvas"}</h2>
          </div>
          <div className="header-pill">{selectedItemIds.length} selected</div>
        </header>

        {activeGroup ? (
          <CanvasBoard
            group={activeGroup}
            selectedItemIds={selectedItemIds}
            onSelectionChange={setSelectedItemIds}
            onViewChange={handleBoardViewChange}
            onItemsPatch={handleBoardItemsPatch}
          />
        ) : null}

        <footer className="group-dock">
          <span className="info-label">Groups</span>
          {project.groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={
                group.id === project.activeGroupId
                  ? "group-pill active"
                  : "group-pill"
              }
              onClick={() => {
                setActiveGroup(group.id);
                setSelectedItemIds([]);
              }}
            >
              {group.name}
            </button>
          ))}
        </footer>
      </main>

      {toast ? (
        <div className={`app-toast app-toast-${toast.kind}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
};
