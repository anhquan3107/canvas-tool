import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { Project } from "@shared/types/project";
import { CanvasBoard } from "@renderer/pixi/CanvasBoard";
import { ProjectProvider } from "@renderer/state/project-store";
import { useProjectStore } from "@renderer/state/use-project-store";
import { useShortcuts } from "@renderer/hooks/use-shortcuts";
import { collectClipboardPayload } from "@renderer/features/import/image-import";
import { useImportQueueSession } from "@renderer/features/import/hooks/use-import-queue-session";
import { GroupDialog } from "@renderer/features/groups/components/GroupDialog";
import { GroupOverlay } from "@renderer/features/groups/components/GroupOverlay";
import { useGroupFeature } from "@renderer/features/groups/hooks/use-group-feature";
import { TaskDialog } from "@renderer/features/tasks/components/TaskDialog";
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
import { StatusBar } from "@renderer/app/components/StatusBar";

export const App = () => {
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
  const [retryingEntryId, setRetryingEntryId] = useState<string | null>(null);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const hasInitializedViewRef = useRef(false);

  const {
    project,
    setProject,
    setActiveGroup,
    setGroupView,
    patchGroupItems,
    addGroupItems,
    removeGroupItems,
    addGroup,
    setGroupFilters,
    setGroupCanvasSize,
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

  const { toast, pushToast } = useToast();
  const { importQueue, setImportQueue } = useImportQueueSession(project);

  const {
    activeTask,
    activeTaskTodoCount,
    taskOverlayOpen,
    taskDialogOpen,
    draftTaskTitle,
    taskDates,
    taskDuration,
    setActiveTaskId,
    setTaskOverlayOpen,
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
    handleToolButton,
    toggleBlur,
    toggleBlackAndWhite,
  } = useToolFeature({
    activeGroup,
    setGroupFilters,
    pushToast,
  });

  const refreshRecents = useCallback(() => {
    window.desktopApi.project
      .getRecentFiles()
      .then(setRecentFiles)
      .catch(() => setRecentFiles([]));
  }, []);

  useEffect(() => {
    void Promise.all([
      window.desktopApi.app
        .getVersion()
        .then(setVersion)
        .catch(() => setVersion("unknown")),
      window.desktopApi.window
        .getControlsState()
        .then((state) => setWindowMaximized(state.isMaximized))
        .catch(() => setWindowMaximized(false)),
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

  const {
    importVisibilitySnapshot,
    saveProject,
    saveProjectAs,
    openProject,
    importFromPayload,
    retryImportEntry: retryImportEntryBase,
    copySelectedImagesToClipboard,
    deleteSelectedItems,
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

  useEffect(() => {
    if (!activeGroup || hasInitializedViewRef.current) {
      return;
    }

    hasInitializedViewRef.current = true;
    requestAnimationFrame(() => {
      resetView();
    });
  }, [activeGroup, resetView]);

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
      copySelectedImagesToClipboard,
      deleteSelectedItems,
      flipItems,
      openGroupDialog,
      openProject,
      openTaskDialog,
      resetView,
      saveProject,
      saveProjectAs,
      toggleBlackAndWhite,
      toggleBlur,
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

  useEffect(() => {
    if (!menuState && !taskDialogOpen && !groupDialogOpen) {
      return;
    }

    const handlePointer = () => setMenuState(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuState(null);
        setTaskDialogOpen(false);
        setGroupDialogOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [groupDialogOpen, menuState, taskDialogOpen]);

  useShortcuts(shortcutHandlers);

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

  const handleToggleMaximize = () => {
    void window.desktopApi.window
      .toggleMaximize()
      .then((state) => setWindowMaximized(state.isMaximized))
      .catch(() => null);
  };

  const handleCloseWindow = () => {
    void window.desktopApi.window.close();
  };

  const zoomLabel = activeGroup
    ? `${Math.round(activeGroup.zoom * 100)}%`
    : "0%";
  const canvasLabel = activeGroup
    ? `${activeGroup.canvasSize.width} x ${activeGroup.canvasSize.height}`
    : "0 x 0";
  const projectFileName =
    project.filePath?.split(/[\\/]/).at(-1) ?? "Untitled.canvas";

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
          windowMaximized={windowMaximized}
          onBrandClick={() => setAppInfoOpen((previous) => !previous)}
          onToolClick={handleToolButton}
          onResetView={resetView}
          onTaskClick={() => setTaskOverlayOpen((previous) => !previous)}
          onCreateGroup={openGroupDialog}
          onShowShortcuts={() =>
            pushToast(
              "info",
              "CanvasTool shortcuts: Ctrl+O, Ctrl+S, Ctrl+Shift+F, Ctrl+B, Ctrl+Y.",
            )
          }
          onMinimize={handleMinimizeWindow}
          onToggleMaximize={handleToggleMaximize}
          onCloseWindow={handleCloseWindow}
        />

        <div className="desktop-layout">
          <main className="workspace-panel">
            <div className="canvas-stage">
              {activeGroup ? (
                <CanvasBoard
                  group={activeGroup}
                  selectedItemIds={selectedItemIds}
                  onSelectionChange={setSelectedItemIds}
                  onViewChange={handleBoardViewChange}
                  onItemsPatch={handleBoardItemsPatch}
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

                {taskOverlayOpen && activeTask ? (
                  <TaskOverlay
                    tasks={project.tasks}
                    activeTask={activeTask}
                    activeTaskTodoCount={activeTaskTodoCount}
                    onClose={() => setTaskOverlayOpen(false)}
                    onSelectTask={setActiveTaskId}
                    onAddTodo={addTodo}
                    onToggleTodo={toggleTodo}
                    onRenameTodo={renameTodo}
                    onReorderTodo={reorderTodo}
                  />
                ) : null}
              </div>

              <div className="canvas-overlay-column bottom-left">
                <GroupOverlay
                  groups={project.groups}
                  activeGroupId={project.activeGroupId}
                  onSelectGroup={(groupId) => {
                    setActiveGroup(groupId);
                    setSelectedItemIds([]);
                  }}
                />
              </div>

              {showColorWheel ? (
                <div className="canvas-overlay-column top-right canvas-wheel-overlay">
                  <ColorWheel />
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
          onDelete={deleteSelectedItems}
          onAutoArrange={autoArrange}
        />
      </div>

      {menuState ? (
        <AppMenu
          x={menuState.x}
          y={menuState.y}
          onClose={() => setMenuState(null)}
          onOpen={() => {
            setMenuState(null);
            void openProject();
          }}
          onSave={() => {
            setMenuState(null);
            void saveProject();
          }}
          onSaveAs={() => {
            setMenuState(null);
            void saveProjectAs();
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
          onCopySelected={() => {
            setMenuState(null);
            void copySelectedImagesToClipboard();
          }}
          onDeleteSelected={() => {
            setMenuState(null);
            deleteSelectedItems();
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

      {toast ? (
        <div className={`app-toast app-toast-${toast.kind}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
};
