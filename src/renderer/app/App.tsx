import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { CanvasItem, ImageItem, Project } from "@shared/types/project";
import { CanvasBoard } from "@renderer/pixi/CanvasBoard";
import { ProjectProvider } from "@renderer/state/project-store";
import { useProjectStore } from "@renderer/state/use-project-store";
import { useShortcuts } from "@renderer/hooks/use-shortcuts";
import { CaptureWindowApp } from "@renderer/app/CaptureWindowApp";
import { ConnectDialog } from "@renderer/features/connect/components/ConnectDialog";
import { useConnectFeature } from "@renderer/features/connect/hooks/use-connect-feature";
import type { CaptureSource } from "@renderer/features/connect/types";
import { CAPTURE_QUALITY_PROFILES } from "@renderer/features/connect/utils";
import { collectClipboardPayload } from "@renderer/features/import/image-import";
import { useImportQueueSession } from "@renderer/features/import/hooks/use-import-queue-session";
import { extractImageSwatches } from "@renderer/features/import/swatches";
import { GroupDialog } from "@renderer/features/groups/components/GroupDialog";
import { GroupOverlay } from "@renderer/features/groups/components/GroupOverlay";
import { useGroupFeature } from "@renderer/features/groups/hooks/use-group-feature";
import { TaskDialog } from "@renderer/features/tasks/components/TaskDialog";
import { TaskDetailPanel } from "@renderer/features/tasks/components/TaskDetailPanel";
import { TaskOverlay } from "@renderer/features/tasks/components/TaskOverlay";
import { useTaskFeature } from "@renderer/features/tasks/hooks/use-task-feature";
import { ColorWheel } from "@renderer/features/tools/components/ColorWheel";
import { FilterFooter } from "@renderer/features/tools/components/FilterFooter";
import { useToolFeature } from "@renderer/features/tools/hooks/use-tool-feature";
import { useCanvasWorkspace } from "@renderer/features/workspace/hooks/use-canvas-workspace";
import { useToast } from "@renderer/hooks/use-toast";
import type { MenuState } from "@renderer/app/types";
import { AppMenu } from "@renderer/app/components/AppMenu";
import { TopBar } from "@renderer/app/components/TopBar";
import { AppInfoPanel } from "@renderer/app/components/AppInfoPanel";
import { ConfirmCloseDialog } from "@renderer/app/components/ConfirmCloseDialog";
import { StatusBar } from "@renderer/app/components/StatusBar";

const getProjectDirtySignature = (project: Project) =>
  JSON.stringify({
    ...project,
    updatedAt: undefined,
  });

export const App = () => {
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "capture") {
    return <CaptureWindowApp />;
  }

  const [initialProject, setInitialProject] = useState<Project | null>(null);

  useEffect(() => {
    window.desktopApi.project
      .create()
      .then(setInitialProject)
      .catch(() => null);
  }, []);

  if (!initialProject) {
    return <div className="booting">Loading CanvasTool...</div>;
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
  const [clipboardItems, setClipboardItems] = useState<CanvasItem[]>([]);
  const [retryingEntryId, setRetryingEntryId] = useState<string | null>(null);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [canvasSizePreview, setCanvasSizePreview] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [windowAlwaysOnTop, setWindowAlwaysOnTop] = useState(false);
  const [groupsOverlayOpen, setGroupsOverlayOpen] = useState(false);
  const hasInitializedViewRef = useRef(false);
  const centeredGroupIdsRef = useRef(new Set<string>());
  const previousActiveGroupIdRef = useRef<string | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const exportCanvasImageRef = useRef<(() => string | null) | null>(null);
  const allowWindowCloseRef = useRef(false);
  const lastSavedSignatureRef = useRef<string>("");
  const [viewportSize, setViewportSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const {
    project,
    canUndo,
    canRedo,
    setProject,
    undo,
    redo,
    runHistoryBatch,
    setActiveGroup,
    setGroupView,
    patchGroupItems,
    addGroupItems,
    removeGroupItems,
    addGroup,
    setGroupFilters,
    setGroupCanvasSize,
    setGroupAnnotations,
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
  const dirtySignature = useMemo(() => getProjectDirtySignature(project), [project]);
  const hasUnsavedChanges =
    lastSavedSignatureRef.current !== "" &&
    dirtySignature !== lastSavedSignatureRef.current;

  const activeGroupId = activeGroup?.id ?? null;

  const { toast, pushToast } = useToast();
  const { importQueue, setImportQueue } = useImportQueueSession(project);

  const handleConnectCapture = useCallback(
    async (source: CaptureSource, quality: keyof typeof CAPTURE_QUALITY_PROFILES) => {
      await window.desktopApi.capture.openWindow({
        sourceId: source.id,
        sourceName: source.name,
        quality,
        sourceWidth: source.thumbnailWidth,
        sourceHeight: source.thumbnailHeight,
      });
    },
    [],
  );

  const {
    dialogOpen: connectDialogOpen,
    loadingSources: loadingCaptureSources,
    sources: captureSources,
    selectedSourceId,
    quality: captureQuality,
    setDialogOpen: setConnectDialogOpen,
    setSelectedSourceId,
    setQuality: setCaptureQuality,
    openDialog: openConnectDialog,
    handleConfirm: handleConfirmConnect,
  } = useConnectFeature({
    pushToast,
    onConnect: handleConnectCapture,
    qualityProfiles: CAPTURE_QUALITY_PROFILES,
  });

  const {
    primaryTask,
    selectedTask,
    selectedTaskId,
    orderedTasks,
    taskListExpanded,
    taskDetailOpen,
    taskDialogOpen,
    draftTaskTitle,
    taskDates,
    taskDuration,
    setSelectedTaskId,
    setTaskListExpanded,
    setTaskDetailOpen,
    setTaskDialogOpen,
    setDraftTaskTitle,
    setTaskDates,
    openTaskDialog,
    handleCreateTask,
  } = useTaskFeature({
    tasks: project.tasks,
    addTask,
    pushToast,
  });

  const {
    groupDialogOpen,
    draftGroupName,
    setGroupDialogOpen,
    setDraftGroupName,
    openGroupDialog,
    handleCreateGroup,
  } = useGroupFeature({
    groupCount: project.groups.length,
    addGroup,
    setSelectedItemIds,
    pushToast,
  });

  const {
    activeTool,
    showColorWheel,
    doodleMode,
    doodleColor,
    brushSize,
    eraserSize,
    handleToolButton,
    setDoodleMode,
    setDoodleColor,
    setBrushSize,
    setEraserSize,
    toggleBlur,
    toggleBlackAndWhite,
  } = useToolFeature({
    activeGroup,
    setGroupFilters,
    pushToast,
    onConnectRequested: openConnectDialog,
  });

  const refreshRecents = useCallback(() => {
    window.desktopApi.project
      .getRecentFiles()
      .then(setRecentFiles)
      .catch(() => setRecentFiles([]));
  }, []);

  useEffect(() => {
    if (!lastSavedSignatureRef.current) {
      lastSavedSignatureRef.current = getProjectDirtySignature(project);
    }
  }, [project]);

  useEffect(() => {
    void Promise.all([
      window.desktopApi.app
        .getVersion()
        .then(setVersion)
        .catch(() => setVersion("unknown")),
      window.desktopApi.window
        .getControlsState()
        .then((state) => {
          setWindowMaximized(state.isMaximized);
          setWindowAlwaysOnTop(state.isAlwaysOnTop);
        })
        .catch(() => {
          setWindowMaximized(false);
          setWindowAlwaysOnTop(false);
        }),
    ]);
    refreshRecents();
  }, [refreshRecents]);

  useEffect(() => {
    const fileName = project.filePath?.split(/[\\/]/).at(-1);
    void window.desktopApi.window.setTitle({
      title: project.title,
      fileName,
    });
  }, [project.filePath, project.title]);

  useEffect(() => {
    const node = canvasStageRef.current;
    if (!node) {
      return;
    }

    const updateViewportSize = () => {
      setViewportSize({
        width: Math.round(node.clientWidth),
        height: Math.round(node.clientHeight),
      });
    };

    updateViewportSize();

    const observer = new ResizeObserver(() => {
      updateViewportSize();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const {
    importVisibilitySnapshot,
    saveProject,
    saveProjectAs,
    openProject,
    importFromPayload,
    retryImportEntry: retryImportEntryBase,
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
  } = useCanvasWorkspace({
    project,
    activeGroup,
    activeGroupId,
    viewportSize: viewportSize ?? { width: 0, height: 0 },
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
  });

  const retryImportEntry = useCallback(
    async (entryId: string) => {
      setRetryingEntryId(entryId);

      try {
        await retryImportEntryBase(entryId);
      } finally {
        setRetryingEntryId(null);
      }
    },
    [retryImportEntryBase],
  );

  const handleOpenProject = useCallback(async () => {
    const nextProject = await openProject();
    if (nextProject) {
      lastSavedSignatureRef.current = getProjectDirtySignature(nextProject);
    }
  }, [openProject]);

  const handleSaveProject = useCallback(async () => {
    const nextProject = await saveProject();
    if (nextProject) {
      lastSavedSignatureRef.current = getProjectDirtySignature(nextProject);
    }

    return nextProject;
  }, [saveProject]);

  const handleSaveProjectAs = useCallback(async () => {
    const nextProject = await saveProjectAs();
    if (nextProject) {
      lastSavedSignatureRef.current = getProjectDirtySignature(nextProject);
    }

    return nextProject;
  }, [saveProjectAs]);

  useEffect(() => {
    if (!activeGroup || hasInitializedViewRef.current) {
      return;
    }

    if (!viewportSize || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    hasInitializedViewRef.current = true;
    requestAnimationFrame(() => {
      resetView();
    });
  }, [activeGroup, resetView, viewportSize]);

  useEffect(() => {
    if (!activeGroup) {
      return;
    }

    if (!viewportSize || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    if (activeGroup.items.length > 0) {
      return;
    }

    if (centeredGroupIdsRef.current.has(activeGroup.id)) {
      return;
    }

    centeredGroupIdsRef.current.add(activeGroup.id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resetView();
      });
    });
  }, [activeGroup, resetView, viewportSize]);

  const shortcutHandlers = useMemo(
    () => ({
      "Ctrl+O": () => void handleOpenProject(),
      "Ctrl+S": () => void handleSaveProject(),
      "Ctrl+Shift+S": () => void handleSaveProjectAs(),
      "Ctrl+Z": undo,
      "Ctrl+Shift+Z": redo,
      "Ctrl+X": cutSelectedItems,
      "Ctrl+F": () => {
        if (!activeGroup || selectedItemIds.length === 0) {
          return;
        }

        flipItems(activeGroup.id, selectedItemIds);
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
      toggleBlackAndWhite,
      toggleBlur,
      undo,
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

  useEffect(() => {
    if (!menuState && !taskDialogOpen && !groupDialogOpen && !settingsOpen) {
      return;
    }

    const handlePointer = () => {
      setMenuState(null);
      setSettingsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuState(null);
        setTaskDialogOpen(false);
        setGroupDialogOpen(false);
        setSettingsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [groupDialogOpen, menuState, settingsOpen, taskDialogOpen]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowWindowCloseRef.current || !hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = false;
      setConfirmCloseOpen(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useShortcuts(shortcutHandlers);

  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    if (previousActiveGroupIdRef.current !== activeGroupId) {
      setGroupsOverlayOpen(false);
      previousActiveGroupIdRef.current = activeGroupId;
    }
  }, [activeGroupId]);

  const handleShellContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setMenuState({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleMinimizeWindow = () => {
    void window.desktopApi.window.minimize();
  };

  const handleDiscardAndClose = useCallback(() => {
    setConfirmCloseOpen(false);
    allowWindowCloseRef.current = true;
    void window.desktopApi.app.quit();
  }, []);

  const handleSaveAndClose = useCallback(async () => {
    const nextProject = project.filePath
      ? await handleSaveProject()
      : await handleSaveProjectAs();

    if (!nextProject) {
      return;
    }

    setConfirmCloseOpen(false);
    allowWindowCloseRef.current = true;
    void window.desktopApi.app.quit();
  }, [handleSaveProject, handleSaveProjectAs, project.filePath]);

  const handleToggleAlwaysOnTop = () => {
    void window.desktopApi.window
      .toggleAlwaysOnTop()
      .then((state) => {
        setWindowMaximized(state.isMaximized);
        setWindowAlwaysOnTop(state.isAlwaysOnTop);
      })
      .catch(() => null);
  };

  const handleToggleMaximize = () => {
    void window.desktopApi.window
      .toggleMaximize()
      .then((state) => {
        setWindowMaximized(state.isMaximized);
        setWindowAlwaysOnTop(state.isAlwaysOnTop);
      })
      .catch(() => null);
  };

  const handleCloseWindow = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmCloseOpen(true);
      return;
    }

    allowWindowCloseRef.current = true;
    void window.desktopApi.app.quit();
  }, [hasUnsavedChanges]);

  const zoomLabel = activeGroup
    ? `${Math.round(activeGroup.zoom * 100)}%`
    : "0%";
  const canvasLabel = canvasSizePreview
    ? `${canvasSizePreview.width} x ${canvasSizePreview.height}`
    : activeGroup
      ? `${activeGroup.canvasSize.width} x ${activeGroup.canvasSize.height}`
      : "0 x 0";
  const projectFileName =
    project.filePath?.split(/[\\/]/).at(-1) ?? "Untitled.canvas";
  const activeDoodleSize =
    doodleMode === "brush" ? brushSize : eraserSize;
  const selectedImageForSwatchExport =
    selectedItemIds.length === 1 && activeGroup
      ? activeGroup.items.find(
          (item): item is ImageItem =>
            item.id === selectedItemIds[0] && item.type === "image",
        )
      : undefined;
  const canExportSelectedSwatch = Boolean(selectedImageForSwatchExport);

  const handleExportSelectedSwatch = useCallback(async () => {
    if (!selectedImageForSwatchExport || selectedImageForSwatchExport.type !== "image") {
      pushToast("info", "Select one image to export swatches.");
      return;
    }

    let swatches =
      selectedImageForSwatchExport.swatches?.length
        ? selectedImageForSwatchExport.swatches.map((swatch) => ({
            colorHex: swatch.colorHex,
            name: swatch.label,
          }))
        : selectedImageForSwatchExport.swatchHex
          ? [
              {
                colorHex: selectedImageForSwatchExport.swatchHex,
                name: selectedImageForSwatchExport.label ?? "Swatch 1",
              },
            ]
          : [];

    if (swatches.length === 0 && selectedImageForSwatchExport.assetPath) {
      let source = selectedImageForSwatchExport.assetPath;
      if (/^https?:\/\//i.test(source)) {
        source =
          (await window.desktopApi.import.fetchRemoteImageDataUrl({
            url: source,
          })) ?? source;
      }

      const extracted = await extractImageSwatches(source);
      swatches = extracted.map((swatch) => ({
        colorHex: swatch.colorHex,
        name: swatch.label,
      }));
    }

    if (swatches.length === 0) {
      pushToast("error", "No swatches available to export for this image.");
      return;
    }

    if (typeof window.desktopApi.project.exportSwatchAco !== "function") {
      pushToast("error", "Swatch export needs an app restart to load the new desktop API.");
      return;
    }

    try {
      const result = await window.desktopApi.project.exportSwatchAco({
        swatches,
        name: selectedImageForSwatchExport.label ?? "Swatch",
      });

      if (!result) {
        return;
      }

      pushToast("success", "Swatches exported as .aco.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Swatch export failed.",
      );
    }
  }, [pushToast, selectedImageForSwatchExport]);

  const handleExportCanvasImage = useCallback(async () => {
    const dataUrl = exportCanvasImageRef.current?.() ?? null;
    if (!dataUrl) {
      pushToast("error", "Canvas export is not ready yet.");
      return;
    }

    try {
      const result = await window.desktopApi.project.exportCanvasImage({
        dataUrl,
        name: activeGroup?.name ?? project.title,
      });

      if (!result) {
        return;
      }

      pushToast("success", "Canvas exported as image.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Canvas export failed.",
      );
    }
  }, [activeGroup?.name, project.title, pushToast]);

  const handleExportGroupImages = useCallback(async () => {
    if (!activeGroup) {
      pushToast("info", "No active canvas to export.");
      return;
    }

    const images = activeGroup.items.flatMap((item) =>
      item.type === "image" && item.assetPath
        ? [{ assetPath: item.assetPath, label: item.label }]
        : [],
    );

    if (images.length === 0) {
      pushToast("info", "No images in this canvas to export.");
      return;
    }

    try {
      const result = await window.desktopApi.project.exportGroupImages({
        images,
        groupName: activeGroup.name,
      });

      if (!result) {
        return;
      }

      pushToast("success", "Canvas images exported to folder.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Image export failed.",
      );
    }
  }, [activeGroup, pushToast]);

  const handleExportSelectedTaskHtml = useCallback(async () => {
    if (!selectedTask) {
      pushToast("info", "Select a task to export.");
      return;
    }

    try {
      const result = await window.desktopApi.project.exportTasksHtml({
        projectTitle: project.title,
        tasks: [selectedTask],
        name: `${selectedTask.title} Task`,
      });

      if (!result) {
        return;
      }

      pushToast("success", "Task exported to HTML.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Task export failed.",
      );
    }
  }, [project.title, pushToast, selectedTask]);

  const handleExportAllTasksHtml = useCallback(async () => {
    if (project.tasks.length === 0) {
      pushToast("info", "No tasks available to export.");
      return;
    }

    try {
      const result = await window.desktopApi.project.exportTasksHtml({
        projectTitle: project.title,
        tasks: project.tasks,
        name: `${project.title} Tasks`,
      });

      if (!result) {
        return;
      }

      pushToast("success", "All tasks exported to HTML.");
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Task export failed.",
      );
    }
  }, [project.tasks, project.title, pushToast]);

  return (
    <div
      className="app-shell"
      onDragOver={handleShellDragOver}
      onDrop={handleShellDrop}
      onContextMenu={handleShellContextMenu}
    >
      <div className="desktop-frame">
        <TopBar
          activeGroup={activeGroup}
          activeTool={activeTool}
          settingsOpen={settingsOpen}
          windowMaximized={windowMaximized}
          windowAlwaysOnTop={windowAlwaysOnTop}
          onBrandClick={() => setAppInfoOpen((previous) => !previous)}
          onToggleSettings={() => setSettingsOpen((previous) => !previous)}
          onOpenProject={() => {
            setSettingsOpen(false);
            void handleOpenProject();
          }}
          onSaveProject={() => {
            setSettingsOpen(false);
            void handleSaveProject();
          }}
          onSaveProjectAs={() => {
            setSettingsOpen(false);
            void handleSaveProjectAs();
          }}
          onToolClick={handleToolButton}
          onResetView={resetView}
          onTaskClick={openTaskDialog}
          onCreateGroup={openGroupDialog}
          onShowShortcuts={() =>
            pushToast(
              "info",
              "CanvasTool shortcuts: Ctrl+O, Ctrl+S, Ctrl+Shift+F, Ctrl+B, Ctrl+Y.",
            )
          }
          onMinimize={handleMinimizeWindow}
          onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
          onToggleMaximize={handleToggleMaximize}
          onCloseWindow={handleCloseWindow}
        />

        <div className="desktop-layout">
          <main className="workspace-panel">
            <div className="canvas-stage" ref={canvasStageRef}>
              {activeGroup ? (
                <CanvasBoard
                  group={activeGroup}
                  activeTool={activeTool}
                  snapEnabled={snapEnabled}
                  doodleMode={doodleMode}
                  doodleColor={doodleColor}
                  doodleSize={activeDoodleSize}
                  selectedItemIds={selectedItemIds}
                  onSelectionChange={setSelectedItemIds}
                  onViewChange={handleBoardViewChange}
                  onItemsPatch={handleBoardItemsPatch}
                  onAnnotationsChange={(annotations) =>
                    setGroupAnnotations(activeGroup.id, annotations)
                  }
                  onCanvasSizePreviewChange={setCanvasSizePreview}
                  onExportReady={(exportCanvas) => {
                    exportCanvasImageRef.current = exportCanvas;
                  }}
                />
              ) : null}

              <div className="canvas-overlay-column top-left">
                {appInfoOpen ? (
                  <AppInfoPanel
                    projectFileName={projectFileName}
                    version={version}
                    importVisibilitySnapshot={importVisibilitySnapshot}
                    recentFiles={recentFiles}
                    importQueue={importQueue}
                    retryingEntryId={retryingEntryId}
                    onClose={() => setAppInfoOpen(false)}
                    onRetryImport={(entryId) => void retryImportEntry(entryId)}
                  />
                ) : null}

                {primaryTask ? (
                  <TaskOverlay
                    tasks={orderedTasks}
                    primaryTask={primaryTask}
                    selectedTaskId={selectedTaskId}
                    expanded={taskListExpanded}
                    onToggleExpanded={() =>
                      setTaskListExpanded((previous) => !previous)
                    }
                    onSelectTask={(taskId) => {
                      setSelectedTaskId(taskId);
                      setTaskDetailOpen(true);
                      setTaskListExpanded(false);
                    }}
                  />
                ) : null}
              </div>

              <div className="canvas-overlay-column bottom-left">
                <GroupOverlay
                  groups={project.groups}
                  activeGroupId={project.activeGroupId}
                  open={groupsOverlayOpen}
                  onToggle={() => setGroupsOverlayOpen((previous) => !previous)}
                  onSelectGroup={(groupId) => {
                    setActiveGroup(groupId);
                    setSelectedItemIds([]);
                  }}
                />
              </div>

              {selectedTask ? (
                <div className="canvas-overlay-column right-center">
                  <TaskDetailPanel
                    task={selectedTask}
                    open={taskDetailOpen}
                    onToggleOpen={() =>
                      setTaskDetailOpen((previous) => !previous)
                    }
                    onAddTodo={addTodo}
                    onToggleTodo={toggleTodo}
                    onRenameTodo={renameTodo}
                    onReorderTodo={reorderTodo}
                  />
                </div>
              ) : null}

              {showColorWheel ? (
                <div className="canvas-overlay-column top-right canvas-wheel-overlay">
                  <ColorWheel
                    doodleMode={doodleMode}
                    doodleColor={doodleColor}
                    brushSize={brushSize}
                    eraserSize={eraserSize}
                    onDoodleModeChange={setDoodleMode}
                    onDoodleColorChange={setDoodleColor}
                    onBrushSizeChange={setBrushSize}
                    onEraserSizeChange={setEraserSize}
                  />
                </div>
              ) : null}
            </div>

            {activeTool === "blur" && activeGroup ? (
              <FilterFooter
                label="Blur"
                htmlFor="blur-range"
                min={0}
                max={32}
                value={activeGroup.filters.blur}
                onChange={(blur) => setGroupFilters(activeGroup.id, { blur })}
              />
            ) : null}
          </main>
        </div>

        <StatusBar
          selectedCount={selectedItemIds.length}
          groupName={activeGroup?.name ?? "Main Canvas"}
          zoomLabel={zoomLabel}
          canvasLabel={canvasLabel}
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled((previous) => !previous)}
          onAutoArrange={autoArrange}
        />
      </div>

      {menuState ? (
        <AppMenu
          x={menuState.x}
          y={menuState.y}
          selectedCount={selectedItemIds.length}
          canExportSwatch={canExportSelectedSwatch}
          canPaste={clipboardItems.length > 0}
          canExportSelectedTask={Boolean(selectedTask)}
          canExportAnyTask={project.tasks.length > 0}
          canUndo={canUndo}
          canRedo={canRedo}
          onClose={() => setMenuState(null)}
          onUndo={() => {
            setMenuState(null);
            undo();
          }}
          onRedo={() => {
            setMenuState(null);
            redo();
          }}
          onOpen={() => {
            setMenuState(null);
            void handleOpenProject();
          }}
          onSave={() => {
            setMenuState(null);
            void handleSaveProject();
          }}
          onSaveAs={() => {
            setMenuState(null);
            void handleSaveProjectAs();
          }}
          onResetView={() => {
            setMenuState(null);
            resetView();
          }}
          onCreateGroup={() => {
            setMenuState(null);
            openGroupDialog();
          }}
          onCreateTask={() => {
            setMenuState(null);
            openTaskDialog();
          }}
          onAutoArrange={() => {
            setMenuState(null);
            autoArrange();
          }}
          onExportCanvasImage={() => {
            setMenuState(null);
            void handleExportCanvasImage();
          }}
          onExportGroupImages={() => {
            setMenuState(null);
            void handleExportGroupImages();
          }}
          onExportSelectedTaskHtml={() => {
            setMenuState(null);
            void handleExportSelectedTaskHtml();
          }}
          onExportAllTasksHtml={() => {
            setMenuState(null);
            void handleExportAllTasksHtml();
          }}
          onCopySelected={() => {
            setMenuState(null);
            copySelectedItemsToClipboard();
          }}
          onCutSelected={() => {
            setMenuState(null);
            cutSelectedItems();
          }}
          onPaste={() => {
            setMenuState(null);
            pasteClipboardItems();
          }}
          onDeleteSelected={() => {
            setMenuState(null);
            deleteSelectedItems();
          }}
          onArrangePinterest={() => {
            setMenuState(null);
            arrangeSelectedItems("pinterest-dynamic");
          }}
          onArrangeHorizontal={() => {
            setMenuState(null);
            arrangeSelectedItems("horizontal");
          }}
          onExportSwatch={() => {
            setMenuState(null);
            void handleExportSelectedSwatch();
          }}
        />
      ) : null}

      <TaskDialog
        open={taskDialogOpen}
        draftTaskTitle={draftTaskTitle}
        taskDates={taskDates}
        taskDuration={taskDuration}
        onClose={() => setTaskDialogOpen(false)}
        onCreateTask={handleCreateTask}
        onDraftTaskTitleChange={setDraftTaskTitle}
        onTaskDatesChange={setTaskDates}
      />

      <GroupDialog
        open={groupDialogOpen}
        draftGroupName={draftGroupName}
        onClose={() => setGroupDialogOpen(false)}
        onCreateGroup={handleCreateGroup}
        onDraftGroupNameChange={setDraftGroupName}
      />

      <ConnectDialog
        open={connectDialogOpen}
        loading={loadingCaptureSources}
        sources={captureSources}
        selectedSourceId={selectedSourceId}
        quality={captureQuality}
        onClose={() => setConnectDialogOpen(false)}
        onSelectSource={setSelectedSourceId}
        onQualityChange={setCaptureQuality}
        onConfirm={handleConfirmConnect}
      />

      <ConfirmCloseDialog
        open={confirmCloseOpen}
        fileName={projectFileName}
        onSave={() => void handleSaveAndClose()}
        onDiscard={handleDiscardAndClose}
        onCancel={() => setConfirmCloseOpen(false)}
      />

      {toast ? (
        <div className={`app-toast app-toast-${toast.kind}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
};
