import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface ImportQueueEntry {
  id: string;
  source: ImportPayload["source"];
  groupId: string;
  importedCount: number;
  blockedItemIds: string[];
  createdAt: string;
}

const IMPORT_QUEUE_STORAGE_PREFIX = "canvastool.import-queue.v1";
const blockedSuffix = " (preview blocked)";

const toImportQueueStorageKey = (project: Project) => {
  const projectScope = project.filePath ?? project.id;
  return `${IMPORT_QUEUE_STORAGE_PREFIX}:${projectScope}`;
};

const isImportQueueEntry = (value: unknown): value is ImportQueueEntry => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    (record.source === "drop" || record.source === "clipboard") &&
    typeof record.groupId === "string" &&
    typeof record.importedCount === "number" &&
    Array.isArray(record.blockedItemIds) &&
    record.blockedItemIds.every((item) => typeof item === "string") &&
    typeof record.createdAt === "string"
  );
};

const loadImportQueueFromSession = (storageKey: string): ImportQueueEntry[] => {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isImportQueueEntry).slice(0, 12);
  } catch {
    return [];
  }
};

const normalizePreviewSize = (width: number, height: number) => {
  const max = 520;
  const min = 90;

  if (width <= max && height <= max) {
    return {
      width: Math.max(min, width),
      height: Math.max(min, height),
    };
  }

  const ratio = Math.min(max / width, max / height);
  return {
    width: Math.max(min, Math.round(width * ratio)),
    height: Math.max(min, Math.round(height * ratio)),
  };
};

const measureImageSize = (source: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || 320,
        height: image.naturalHeight || 240,
      });
    image.onerror = () => reject(new Error("Failed to decode image preview."));
    image.src = source;
  });

const stripBlockedSuffix = (value: string | undefined) => {
  if (!value) {
    return value;
  }

  return value.endsWith(blockedSuffix)
    ? value.slice(0, -blockedSuffix.length)
    : value;
};

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
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    kind: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [importQueue, setImportQueue] = useState<ImportQueueEntry[]>([]);
  const [retryingEntryId, setRetryingEntryId] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const importQueueLoadedKeyRef = useRef<string | null>(null);

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
    [project],
  );

  const activeTask = useMemo(() => {
    if (!project.tasks.length) {
      return null;
    }

    const selected = project.tasks.find((task) => task.id === activeTaskId);
    return selected ?? project.tasks[0];
  }, [project.tasks, activeTaskId]);

  const importQueueStorageKey = useMemo(
    () => toImportQueueStorageKey(project),
    [project],
  );

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

  const pushToast = useCallback(
    (kind: "success" | "error" | "info", message: string) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }

      setToast({ kind, message });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 2200);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const restoredQueue = loadImportQueueFromSession(importQueueStorageKey);
    setImportQueue(restoredQueue);
    importQueueLoadedKeyRef.current = importQueueStorageKey;
  }, [importQueueStorageKey]);

  useEffect(() => {
    if (importQueueLoadedKeyRef.current !== importQueueStorageKey) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        importQueueStorageKey,
        JSON.stringify(importQueue.slice(0, 12)),
      );
    } catch {
      return;
    }
  }, [importQueue, importQueueStorageKey]);

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
    [activeGroup, addGroupItems, pushToast],
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

  useShortcuts({
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
  });

  return (
    <div
      className="app-shell"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const payload = collectDropPayload(event.nativeEvent);
        void importFromPayload(payload);
      }}
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

        <div className="info-card import-queue-card">
          <span className="info-label">Import Queue</span>
          {importQueue.length === 0 ? (
            <p className="muted">No import actions yet.</p>
          ) : (
            <div className="import-queue-list">
              {importQueue.map((entry) => {
                const blockedCount = entry.blockedItemIds.length;

                return (
                  <div key={entry.id} className="import-queue-item">
                    <p className="import-queue-title">
                      {entry.source === "clipboard" ? "Clipboard" : "Drag/Drop"}{" "}
                      • {entry.importedCount} imported
                    </p>
                    <p className="import-queue-meta">
                      {blockedCount > 0
                        ? `${blockedCount} blocked previews`
                        : "All previews ready"}
                    </p>
                    {blockedCount > 0 ? (
                      <button
                        type="button"
                        className="import-queue-retry"
                        disabled={retryingEntryId === entry.id}
                        onClick={() => void retryImportEntry(entry.id)}
                      >
                        {retryingEntryId === entry.id
                          ? "Retrying..."
                          : "Retry blocked"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
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
            onViewChange={(zoom, panX, panY) =>
              setGroupView(activeGroup.id, zoom, panX, panY)
            }
            onItemsPatch={(updates) => patchGroupItems(activeGroup.id, updates)}
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
