import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
  DEFAULT_VIEW_ZOOM_BASELINE,
} from "@shared/project-defaults";
import type { TaskTransferTask, TasksImportResult } from "@shared/types/ipc";
import type { Project, ReferenceGroup, Task } from "@shared/types/project";
import { AppDialogs } from "@renderer/app/components/AppDialogs";
import { useAppShortcuts } from "@renderer/app/hooks/use-app-shortcuts";
import { useAppDeletion } from "@renderer/app/hooks/use-app-deletion";
import { useAppDerivedState } from "@renderer/app/hooks/use-app-derived-state";
import { useAppFeatureGuide } from "@renderer/app/hooks/use-app-feature-guide";
import { useShortcutSettings } from "@renderer/app/hooks/use-shortcut-settings";
import { useAppUiState } from "@renderer/app/hooks/use-app-ui-state";
import { useCanvasStage } from "@renderer/app/hooks/use-canvas-stage";
import { useExportActions } from "@renderer/app/hooks/use-export-actions";
import { useProjectFileActions } from "@renderer/app/hooks/use-project-file-actions";
import { useWindowControls } from "@renderer/app/hooks/use-window-controls";
import { useWindowFocusState } from "@renderer/app/hooks/use-window-focus-state";
import { useWindowRightDrag } from "@renderer/app/hooks/use-window-right-drag";
import { CanvasBoard } from "@renderer/pixi/CanvasBoard";
import { ProjectProvider } from "@renderer/state/project-store";
import { useProjectStore } from "@renderer/state/use-project-store";
import { CaptureWindowApp } from "@renderer/app/CaptureWindowApp";
import { useConnectFeature } from "@renderer/features/connect/hooks/use-connect-feature";
import type { CaptureSource } from "@renderer/features/connect/types";
import { CAPTURE_QUALITY_PROFILES } from "@renderer/features/connect/utils";
import { collectClipboardPayload, collectDropPayload } from "@renderer/features/import/image-import";
import { useImportQueueSession } from "@renderer/features/import/hooks/use-import-queue-session";
import { GroupOverlay } from "@renderer/features/groups/components/GroupOverlay";
import { useGroupFeature } from "@renderer/features/groups/hooks/use-group-feature";
import { TaskDetailPanel } from "@renderer/features/tasks/components/TaskDetailPanel";
import { TaskImportDialog } from "@renderer/features/tasks/components/TaskImportDialog";
import { TaskOverlay } from "@renderer/features/tasks/components/TaskOverlay";
import { useTaskFeature } from "@renderer/features/tasks/hooks/use-task-feature";
import { ColorWheel } from "@renderer/features/tools/components/ColorWheel";
import { FilterFooter } from "@renderer/features/tools/components/FilterFooter";
import { ZoomOverlay } from "@renderer/features/tools/components/ZoomOverlay";
import { useToolFeature } from "@renderer/features/tools/hooks/use-tool-feature";
import { useZoomOverlay } from "@renderer/features/tools/hooks/use-zoom-overlay";
import { useCanvasWorkspace } from "@renderer/features/workspace/hooks/use-canvas-workspace";
import { getFocusedGroupView } from "@renderer/features/workspace/utils/layout";
import { useToast } from "@renderer/hooks/use-toast";
import { AppMenu } from "@renderer/app/components/AppMenu";
import { TopBar } from "@renderer/app/components/TopBar";
import { AppInfoPanel } from "@renderer/app/components/AppInfoPanel";
import { StatusBar } from "@renderer/app/components/StatusBar";
import { hexToRgba } from "@renderer/pixi/utils/color";

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

const clampCanvasZoom = (value: number) => Math.min(20, Math.max(0.18, value));
const clampWindowOpacity = (value: number) => Math.min(1, Math.max(0.05, value));
const SHELL_RIGHT_CLICK_DRAG_THRESHOLD = 5;

type BackgroundColorPreviewState = {
  canvasColor: string;
  backgroundColor: string;
  windowOpacity: number;
};

type TaskImportMode = "merge" | "replace" | "skip-duplicates";
type TaskImportPreviewState = TasksImportResult & {
  duplicateCount: number;
  importableCount: number;
};

type ShellRightClickGesture = {
  active: boolean;
  moved: boolean;
  startX: number;
  startY: number;
};

const isTypingElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
};

const shouldIgnoreShellRightClickTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (isTypingElement(target)) {
    return true;
  }

  return Boolean(
    target.closest(
      ".app-topbar, .topbar-settings-shell, .group-overlay-shell, .task-overlay-shell, [data-window-no-drag='true']",
    ),
  );
};

const buildTaskDuplicateSignature = (
  task: Pick<
    TaskTransferTask,
    "title" | "startDate" | "endDate" | "linkedGroupName" | "todos"
  >,
) =>
  JSON.stringify({
    title: task.title.trim().toLowerCase(),
    startDate: task.startDate ?? "",
    endDate: task.endDate ?? "",
    linkedGroupName: task.linkedGroupName?.trim().toLowerCase() ?? "",
    todos: [...task.todos]
      .sort((left, right) => left.order - right.order)
      .map((todo) => ({
        text: todo.text.trim().toLowerCase(),
        completed: todo.completed,
      })),
  });

const buildExistingTaskDuplicateSet = (
  tasks: Task[],
  groups: ReferenceGroup[],
) => {
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  return new Set(
    tasks.map((task) =>
      buildTaskDuplicateSignature({
        ...task,
        linkedGroupName: task.linkedGroupId
          ? groupNameById.get(task.linkedGroupId)
          : undefined,
      }),
    ),
  );
};

const resolveImportedTaskGroupId = (
  task: TaskTransferTask,
  groups: ReferenceGroup[],
) => {
  if (task.linkedGroupId && groups.some((group) => group.id === task.linkedGroupId)) {
    return task.linkedGroupId;
  }

  if (!task.linkedGroupName) {
    return undefined;
  }

  const matchedGroup = groups.find(
    (group) => group.name.trim().toLowerCase() === task.linkedGroupName?.trim().toLowerCase(),
  );
  return matchedGroup?.id;
};

const cloneImportedTasksForProject = (
  tasks: TaskTransferTask[],
  groups: ReferenceGroup[],
  startingOrder: number,
) =>
  tasks.map<Task>((task, index) => ({
    id: crypto.randomUUID(),
    title: task.title,
    order: startingOrder + index,
    completed: task.completed,
    startDate: task.startDate,
    endDate: task.endDate,
    linkedGroupId: resolveImportedTaskGroupId(task, groups),
    todos: [...task.todos]
      .sort((left, right) => left.order - right.order)
      .map((todo, todoIndex) => ({
        id: crypto.randomUUID(),
        text: todo.text,
        completed: todo.completed,
        order: todoIndex,
      })),
  }));

const AppContent = () => {
  useWindowRightDrag();
  const windowFocused = useWindowFocusState();
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const shellRightClickGestureRef = useRef<ShellRightClickGesture>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
  });

  const {
    recentFiles,
    setRecentFiles,
    selectedItemIds,
    setSelectedItemIds,
    lastImportedItemIds,
    setLastImportedItemIds,
    clipboardItems,
    setClipboardItems,
    appInfoOpen,
    setAppInfoOpen,
    canvasSizePreview,
    setCanvasSizePreview,
    autoArrangeOnImport,
    setAutoArrangeOnImport,
    menuState,
    setMenuState,
    settingsOpen,
    setSettingsOpen,
    helpOpen,
    setHelpOpen,
    groupsOverlayOpen,
    setGroupsOverlayOpen,
    canvasSizeDialogOpen,
    setCanvasSizeDialogOpen,
    backgroundColorDialogOpen,
    setBackgroundColorDialogOpen,
    canvasWidthInput,
    setCanvasWidthInput,
    canvasHeightInput,
    setCanvasHeightInput,
    hasInitializedViewRef,
    centeredGroupIdsRef,
    previousActiveGroupIdRef,
    lastSavedSignatureRef,
  } = useAppUiState();

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
    flipItems,
    addGroup,
    renameGroup,
    removeGroup,
    setGroupFilters,
    setGroupCanvasSize,
    setGroupColors,
    setGroupLocked,
    setGroupAnnotations,
    addTask,
    duplicateTask,
    updateTask,
    completeTask,
    linkTaskToGroup,
    removeTask,
    addTodo,
    removeTodo,
    toggleTodo,
    renameTodo,
    reorderTodo,
  } = useProjectStore();

  const [cropSession, setCropSession] = useState<{
    itemId: string;
    rect: { left: number; top: number; right: number; bottom: number };
  } | null>(null);
  const [backgroundColorPreview, setBackgroundColorPreview] =
    useState<BackgroundColorPreviewState | null>(null);
  const [windowOpacity, setWindowOpacity] = useState<number | null>(null);
  const [swatchesHidden, setSwatchesHidden] = useState(false);
  const [taskImportPreview, setTaskImportPreview] =
    useState<TaskImportPreviewState | null>(null);

  const { toast, pushToast } = useToast();
  const { importQueue, setImportQueue } = useImportQueueSession(project);

  useEffect(() => {
    let cancelled = false;

    void window.desktopApi.window
      .getOpacity()
      .then((nextOpacity) => {
        if (!cancelled) {
          setWindowOpacity(clampWindowOpacity(nextOpacity));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWindowOpacity(1);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshRecents = useCallback(() => {
    window.desktopApi.project
      .getRecentFiles()
      .then(setRecentFiles)
      .catch(() => setRecentFiles([]));
  }, []);

  const handleConnectCapture = useCallback(
    async (
      source: CaptureSource,
      quality: keyof typeof CAPTURE_QUALITY_PROFILES,
    ) => {
      await window.desktopApi.capture.openWindow({
        sourceId: source.id,
        sourceName: source.name,
        sourceKind: source.kind,
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
    exportSelectedTask,
    selectedTaskId,
    orderedTasks,
    taskListExpanded,
    taskDetailOpen,
    taskDetailPinned,
    taskDialogOpen,
    taskDialogMode,
    editingTaskId,
    draftTaskTitle,
    taskDates,
    taskDuration,
    setTaskDetailOpen,
    setTaskDialogOpen,
    setDraftTaskTitle,
    setTaskDates,
    selectTask,
    toggleTaskListExpanded,
    toggleTaskDetailPinned,
    registerTaskOverlayInteraction,
    registerTaskDetailInteraction,
    setTaskOverlayHovering,
    setTaskOverlayFocusWithin,
    setTaskDetailHovering,
    setTaskDetailFocusWithin,
    openTaskDialog,
    openEditTaskDialog,
    openRenameTaskDialog,
    handleSubmitTask,
    handleDuplicateTask,
    handleDeleteTask,
    handleDeleteSelectedTask,
  } = useTaskFeature({
    tasks: project.tasks,
    addTask,
    duplicateTask,
    updateTask,
    removeTask,
    pushToast,
  });
  const {
    activeGroup,
    activeGroupId,
    appShellBackgroundColor,
    canDeleteActiveGroup,
    canvasLabel,
    dirtySignature,
    displayGroup,
    hasUnsavedChanges,
    linkedSelectedTaskGroupName,
    projectFileName,
    savedGroups,
    selectedStatusImage,
    zoomLabel,
    zoomOverlayFilter,
  } = useAppDerivedState({
    project,
    selectedItemIds,
    selectedTask,
    backgroundColorPreview,
    canvasSizePreview,
    lastSavedSignature: lastSavedSignatureRef.current,
  });
  const appBackgroundOpacity = clampWindowOpacity(
    backgroundColorPreview?.windowOpacity ?? windowOpacity ?? 1,
  );
  const appShellStyle = {
    backgroundColor: hexToRgba(appShellBackgroundColor, appBackgroundOpacity),
    "--bg-panel": `rgba(34, 34, 37, ${0.96 * appBackgroundOpacity})`,
    "--bg-panel-soft": `rgba(42, 42, 46, ${0.86 * appBackgroundOpacity})`,
    "--bg-menu": `rgba(38, 38, 42, ${0.98 * appBackgroundOpacity})`,
    "--bg-chrome": `rgba(31, 31, 33, ${0.94 * appBackgroundOpacity})`,
    "--bg-chrome-solid": `rgba(31, 31, 33, ${appBackgroundOpacity})`,
    "--topbar-bg": `rgba(45, 44, 49, ${appBackgroundOpacity})`,
    "--status-pill-bg": `rgba(18, 18, 20, ${0.54 * appBackgroundOpacity})`,
    "--status-pill-hover-bg": `rgba(18, 18, 20, ${0.68 * appBackgroundOpacity})`,
  } as CSSProperties;
  const activeGroupRef = useRef(activeGroup);
  const {
    handleConfirmDeletion,
    pendingDeletion,
    requestDeleteCurrentGroup,
    requestDeleteGroupById,
    requestDeleteSelectedTask,
    requestDeleteTaskById,
    setPendingDeletion,
  } = useAppDeletion({
    activeGroup,
    groups: project.groups,
    tasks: project.tasks,
    selectedTask,
    handleDeleteTask,
    removeGroup,
    pushToast,
    setSelectedItemIds,
    setGroupsOverlayOpen,
  });

  const selectTaskAndActivateLinkedGroup = useCallback(
    (taskId: string | null) => {
      selectTask(taskId);

      if (!taskId) {
        return;
      }

      const task = project.tasks.find((entry) => entry.id === taskId);
      if (!task?.linkedGroupId) {
        return;
      }

      const targetGroup = project.groups.find((group) => group.id === task.linkedGroupId);
      if (!targetGroup) {
        return;
      }

      setActiveGroup(targetGroup.id);
      setSelectedItemIds([]);
    },
    [project.groups, project.tasks, selectTask, setActiveGroup, setSelectedItemIds],
  );

  const {
    groupDialogOpen,
    draftGroupName,
    editingGroup,
    setGroupDialogOpen,
    setDraftGroupName,
    openGroupDialog,
    openRenameGroupDialog,
    handleCreateGroup,
    closeGroupDialog,
  } = useGroupFeature({
    groupCount: savedGroups.length,
    addGroup: (name) => {
      const canvasGroup = project.groups.find((group) => group.kind === "canvas");
      if (canvasGroup) {
        centeredGroupIdsRef.current.delete(canvasGroup.id);
      }

      addGroup(name);
    },
    renameGroup,
    onCreateGroupSuccess: () => {
      setGroupsOverlayOpen(true);
    },
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
    setActiveTool,
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

  const {
    zoomOverlayOpen,
    zoomOverlayItems,
    zoomOverlayItemId,
    rulerEnabled,
    rulerDialogOpen,
    rulerSettings,
    draftRulerSettings,
    slideshowPlaying,
    slideshowSeconds,
    openZoomOverlay,
    closeZoomOverlay,
    handleRulerTool,
    selectNextZoomImage,
    selectPreviousZoomImage,
    setDraftRulerSettings,
    applyRulerSettings,
    cancelRuler,
    setSlideshowPlaying,
    setSlideshowSeconds,
  } = useZoomOverlay({
    activeGroup,
    selectedItemIds,
    setActiveTool,
    pushToast,
  });
  const { canvasStageRef, exportCanvasImageRef, viewportSize } =
    useCanvasStage();
  const {
    shortcutBindings,
    shortcutDialogOpen,
    shortcutDraftBindings,
    shortcutConflicts,
    seenTitleBarTooltips,
    openShortcutDialog,
    closeShortcutDialog,
    updateShortcutDraftBinding,
    resetShortcutDraftBinding,
    resetAllShortcutDraftBindings,
    markTitleBarTooltipSeen,
    resetTitleBarTooltips,
    saveShortcutBindings,
  } = useShortcutSettings({
    pushToast,
  });
  const {
    featureGuide,
    maybeShowTodoGuide,
    setFeatureGuide,
  } = useAppFeatureGuide({
    seenTitleBarTooltips,
    markTitleBarTooltipSeen,
  });

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
    flipSelectedItemsHorizontally,
    applyCropToSelectedImage,
    arrangeSelectedItems,
    handleBoardViewChange,
    handleBoardItemsPatch,
    handleShellDragOver,
    changeCanvasSize,
    changeCanvasColors,
    toggleCanvasLock,
    resetView,
    autoArrange,
  } = useCanvasWorkspace({
    project,
    activeGroup,
    activeGroupId,
    autoArrangeOnImport,
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
    flipItems,
    setGroupCanvasSize,
    setGroupColors,
    setGroupLocked,
    setImportQueue,
    setClipboardItems,
    setSelectedItemIds,
    setLastImportedItemIds,
    pushToast,
    refreshRecents,
    runHistoryBatch,
  });

  const {
    version,
    retryingEntryId,
    retryImportEntry,
    handleOpenProject,
    handleSaveProject,
    handleSaveProjectAs,
  } = useProjectFileActions({
    project,
    refreshRecents,
    openProject,
    saveProject,
    saveProjectAs,
    retryImportEntryBase,
    lastSavedSignatureRef,
  });

  useEffect(() => {
    const detachNativeMenuListener = window.desktopApi.app.onNativeMenuAction(
      (action) => {
        switch (action) {
          case "open-project":
            void handleOpenProject();
            break;
          case "save-project":
            void handleSaveProject();
            break;
          case "save-project-as":
            void handleSaveProjectAs();
            break;
          default:
            break;
        }
      },
    );

    return detachNativeMenuListener;
  }, [handleOpenProject, handleSaveProject, handleSaveProjectAs]);

  const {
    confirmCloseOpen,
    setConfirmCloseOpen,
    windowMaximized,
    windowAlwaysOnTop,
    handleMinimizeWindow,
    handleToggleAlwaysOnTop,
    handleToggleMaximize,
    handleDiscardAndClose,
    handleSaveAndClose,
    handleCloseWindow,
  } = useWindowControls({
    hasUnsavedChanges,
    projectFilePath: project.filePath,
    handleSaveProject,
    handleSaveProjectAs,
  });

  const clearTransientUi = useCallback(() => {
    setMenuState(null);
    setTaskDialogOpen(false);
    setGroupDialogOpen(false);
    setSettingsOpen(false);
    setHelpOpen(false);
    setCanvasSizeDialogOpen(false);
    setBackgroundColorDialogOpen(false);
    setBackgroundColorPreview(null);
    setAppInfoOpen(false);
    setTaskDetailOpen(false);
    setConnectDialogOpen(false);
    setGroupsOverlayOpen(false);
    setCropSession(null);
    closeShortcutDialog();
    closeZoomOverlay();
  }, [
    closeShortcutDialog,
    closeZoomOverlay,
    setAppInfoOpen,
    setBackgroundColorDialogOpen,
    setBackgroundColorPreview,
    setCanvasSizeDialogOpen,
    setConnectDialogOpen,
    setGroupDialogOpen,
    setGroupsOverlayOpen,
    setMenuState,
    setSettingsOpen,
    setHelpOpen,
    setTaskDetailOpen,
    setTaskDialogOpen,
    setCropSession,
  ]);

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  useEffect(() => {
    const fileName = project.filePath?.split(/[\\/]/).at(-1);
    void window.desktopApi.window.setTitle({
      title: project.title,
      fileName,
    });
  }, [project.filePath, project.title]);

  useEffect(() => {
    if (!activeGroup || hasInitializedViewRef.current) {
      return;
    }

    if (!viewportSize || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    hasInitializedViewRef.current = true;
    requestAnimationFrame(() => {
      if (
        activeGroupRef.current?.id !== activeGroup.id ||
        (activeGroupRef.current?.items.length ?? 0) > 0
      ) {
        return;
      }

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
        if (
          activeGroupRef.current?.id !== activeGroup.id ||
          (activeGroupRef.current?.items.length ?? 0) > 0
        ) {
          return;
        }

        resetView();
      });
    });
  }, [activeGroup, resetView, viewportSize]);

  useEffect(() => {
    if (
      !menuState &&
      !taskDialogOpen &&
      !groupDialogOpen &&
      !settingsOpen &&
      !helpOpen &&
      !canvasSizeDialogOpen &&
      !backgroundColorDialogOpen
    ) {
      return;
    }

    const handlePointer = (event: PointerEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(".topbar-settings-shell")
      ) {
        return;
      }

      setMenuState(null);
      setSettingsOpen(false);
    };

    window.addEventListener("pointerdown", handlePointer);

    return () => {
      window.removeEventListener("pointerdown", handlePointer);
    };
  }, [
    canvasSizeDialogOpen,
    backgroundColorDialogOpen,
    groupDialogOpen,
    helpOpen,
    menuState,
    settingsOpen,
    taskDialogOpen,
  ]);

  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    if (previousActiveGroupIdRef.current !== activeGroupId) {
      previousActiveGroupIdRef.current = activeGroupId;
    }
  }, [activeGroupId]);

  useEffect(() => {
    const resetShellRightClickGesture = () => {
      shellRightClickGestureRef.current = {
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
      };
    };

    window.addEventListener("blur", resetShellRightClickGesture);
    return () => {
      window.removeEventListener("blur", resetShellRightClickGesture);
    };
  }, []);

  const handleShellPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 2) {
        return;
      }

      if (shouldIgnoreShellRightClickTarget(event.target)) {
        shellRightClickGestureRef.current = {
          active: false,
          moved: false,
          startX: 0,
          startY: 0,
        };
        return;
      }

      shellRightClickGestureRef.current = {
        active: true,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
      };
    },
    [],
  );

  const handleShellPointerMoveCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = shellRightClickGestureRef.current;
      if (!gesture.active || (event.buttons & 2) === 0 || gesture.moved) {
        return;
      }

      if (
        Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >=
        SHELL_RIGHT_CLICK_DRAG_THRESHOLD
      ) {
        gesture.moved = true;
      }
    },
    [],
  );

  const handleShellPointerUpCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 2) {
        return;
      }

      const gesture = shellRightClickGestureRef.current;
      const shouldOpenMenu =
        gesture.active &&
        !gesture.moved &&
        !event.defaultPrevented &&
        !shouldIgnoreShellRightClickTarget(event.target);

      shellRightClickGestureRef.current = {
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
      };

      if (!shouldOpenMenu) {
        return;
      }

      event.preventDefault();
      setMenuState({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [setMenuState],
  );

  const handleShellContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  };
  const handleCanvasSelectionChange = useCallback(
    (itemIds: string[]) => {
      if (itemIds.length > 0) {
        setAppInfoOpen(false);
      }

      setSelectedItemIds(itemIds);
    },
    [setAppInfoOpen, setSelectedItemIds],
  );
  const handleSelectAllItems = useCallback(() => {
    if (!activeGroup || zoomOverlayOpen) {
      return;
    }

    setAppInfoOpen(false);
    setSelectedItemIds(
      activeGroup.items
        .filter((item) => item.visible !== false)
        .map((item) => item.id),
    );
  }, [activeGroup, setAppInfoOpen, setSelectedItemIds, zoomOverlayOpen]);

  const handleShowShortcutsShortcut = useCallback(() => {
    const shouldOpenShortcutDialog = !shortcutDialogOpen;

    clearTransientUi();

    if (shouldOpenShortcutDialog) {
      openShortcutDialog();
    }
  }, [clearTransientUi, openShortcutDialog, shortcutDialogOpen]);

  const handleFitCanvasToWindow = useCallback(() => {
    if (
      !activeGroup ||
      zoomOverlayOpen ||
      !viewportSize ||
      viewportSize.width <= 0 ||
      viewportSize.height <= 0
    ) {
      return;
    }

    const nextView = getFocusedGroupView(
      [
        {
          x: 0,
          y: 0,
          width: activeGroup.canvasSize.width,
          height: activeGroup.canvasSize.height,
        },
      ],
      activeGroup.canvasSize,
      viewportSize,
    );

    if (!nextView) {
      return;
    }

    const sameAsStoredView =
      Math.abs(activeGroup.zoom - nextView.zoom) < 0.0001 &&
      Math.abs(activeGroup.panX - nextView.panX) < 0.01 &&
      Math.abs(activeGroup.panY - nextView.panY) < 0.01;

    if (sameAsStoredView) {
      setGroupView(
        activeGroup.id,
        nextView.zoom,
        nextView.panX + 0.01,
        nextView.panY + 0.01,
      );
      requestAnimationFrame(() => {
        setGroupView(activeGroup.id, nextView.zoom, nextView.panX, nextView.panY);
      });
      return;
    }

    setGroupView(activeGroup.id, nextView.zoom, nextView.panX, nextView.panY);
  }, [activeGroup, setGroupView, viewportSize, zoomOverlayOpen]);

  const handleZoomCanvas = useCallback(
    (direction: 1 | -1) => {
      if (
        !activeGroup ||
        zoomOverlayOpen ||
        !viewportSize ||
        viewportSize.width <= 0 ||
        viewportSize.height <= 0
      ) {
        return;
      }

      const viewportCenterX = viewportSize.width * 0.5;
      const viewportCenterY = viewportSize.height * 0.5;
      const currentZoom = Math.max(activeGroup.zoom, 0.0001);
      const worldX = (viewportCenterX - activeGroup.panX) / currentZoom;
      const worldY = (viewportCenterY - activeGroup.panY) / currentZoom;
      const zoomFactor = direction > 0 ? 1.15 : 1 / 1.15;
      const nextZoom = clampCanvasZoom(currentZoom * zoomFactor);

      if (Math.abs(nextZoom - activeGroup.zoom) < 0.0001) {
        return;
      }

      setGroupView(
        activeGroup.id,
        nextZoom,
        viewportCenterX - worldX * nextZoom,
        viewportCenterY - worldY * nextZoom,
      );
    },
    [activeGroup, setGroupView, viewportSize, zoomOverlayOpen],
  );

  const activeDoodleSize = doodleMode === "brush" ? brushSize : eraserSize;
  const {
    canExportSelectedSwatch,
    handleExportSelectedSwatch,
    handleExportCanvasImage,
    handleExportGroupImages,
    handleExportSelectedTaskHtml,
    handleExportAllTasksHtml,
    handleExportSelectedTaskTxt,
    handleExportAllTasksTxt,
  } = useExportActions({
    activeGroup,
    project,
    pushToast,
    selectedItemIds,
    selectedTask: exportSelectedTask ?? undefined,
    exportCanvasImageRef,
  });

  const handleImportTasks = useCallback(async () => {
    try {
      const result = await window.desktopApi.project.importTasks();
      if (!result) {
        return;
      }

      const existingTaskIds = new Set(project.tasks.map((task) => task.id));
      const existingTaskSignatures = buildExistingTaskDuplicateSet(
        project.tasks,
        project.groups,
      );
      const duplicateCount = result.tasks.filter(
        (task) =>
          existingTaskIds.has(task.id) ||
          existingTaskSignatures.has(buildTaskDuplicateSignature(task)),
      ).length;

      setTaskImportPreview({
        ...result,
        duplicateCount,
        importableCount: Math.max(0, result.tasks.length - duplicateCount),
      });
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : "Task import failed.",
      );
    }
  }, [project.groups, project.tasks, pushToast]);

  const handleApplyImportedTasks = useCallback(
    (mode: TaskImportMode) => {
      if (!taskImportPreview) {
        return;
      }

      const existingTaskIds = new Set(project.tasks.map((task) => task.id));
      const existingTaskSignatures = buildExistingTaskDuplicateSet(
        project.tasks,
        project.groups,
      );
      const importedTasks =
        mode === "skip-duplicates"
          ? taskImportPreview.tasks.filter(
              (task) =>
                !existingTaskIds.has(task.id) &&
                !existingTaskSignatures.has(buildTaskDuplicateSignature(task)),
            )
          : taskImportPreview.tasks;

      const nextTasks =
        mode === "replace"
          ? cloneImportedTasksForProject(importedTasks, project.groups, 0)
          : [
              ...project.tasks,
              ...cloneImportedTasksForProject(
                importedTasks,
                project.groups,
                project.tasks.length,
              ),
            ];

      if (importedTasks.length === 0) {
        setTaskImportPreview(null);
        pushToast("info", "No new tasks to import.");
        return;
      }

      setProject({
        ...project,
        tasks: nextTasks,
        updatedAt: new Date().toISOString(),
      });
      setTaskImportPreview(null);
      pushToast(
        "success",
        mode === "replace"
          ? `Replaced tasks with ${importedTasks.length} imported task${importedTasks.length === 1 ? "" : "s"}.`
          : `Imported ${importedTasks.length} task${importedTasks.length === 1 ? "" : "s"}.`,
      );
    },
    [project, pushToast, setProject, taskImportPreview],
  );

  const handleAppShellDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const payload = collectDropPayload(event.nativeEvent);
      const stageRect = canvasStageRef.current?.getBoundingClientRect();
      const dropViewportPoint = stageRect
        ? {
            x: event.clientX - stageRect.left,
            y: event.clientY - stageRect.top,
          }
        : undefined;

      void importFromPayload(payload, { dropViewportPoint });
    },
    [importFromPayload],
  );

  useEffect(() => {
    if (!cropSession) {
      return;
    }

    if (selectedStatusImage?.id !== cropSession.itemId) {
      setCropSession(null);
    }
  }, [cropSession, selectedStatusImage]);

  const toggleCropSelectedImage = useCallback(() => {
    if (!selectedStatusImage) {
      pushToast("info", "Select exactly one image to crop.");
      return;
    }

    if (cropSession?.itemId === selectedStatusImage.id) {
      applyCropToSelectedImage(cropSession.rect);
      setCropSession(null);
      return;
    }

    setCropSession({
      itemId: selectedStatusImage.id,
      rect: { left: 0, top: 0, right: 1, bottom: 1 },
    });
    pushToast(
      "info",
      "Crop mode active. Adjust handles, then press C again to apply.",
    );
  }, [applyCropToSelectedImage, cropSession, pushToast, selectedStatusImage]);

  const handleOpenCanvasSizeDialog = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    setMenuState(null);
    setCanvasWidthInput(String(activeGroup.canvasSize.width));
    setCanvasHeightInput(String(activeGroup.canvasSize.height));
    setCanvasSizeDialogOpen(true);
  }, [
    activeGroup,
    setCanvasHeightInput,
    setCanvasSizeDialogOpen,
    setCanvasWidthInput,
  ]);

  const handleConfirmCanvasSizeDialog = useCallback(() => {
    const nextWidth = Number(canvasWidthInput);
    const nextHeight = Number(canvasHeightInput);

    if (
      !Number.isFinite(nextWidth) ||
      !Number.isFinite(nextHeight) ||
      nextWidth <= 0 ||
      nextHeight <= 0
    ) {
      pushToast("error", "Enter valid canvas width and height.");
      return;
    }

    changeCanvasSize(nextWidth, nextHeight);
    setCanvasSizeDialogOpen(false);
  }, [
    canvasHeightInput,
    canvasWidthInput,
    changeCanvasSize,
    pushToast,
    setCanvasSizeDialogOpen,
  ]);

  const handleOpenBackgroundColorDialog = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    setMenuState(null);
    setSettingsOpen(false);
    setBackgroundColorPreview({
      canvasColor: activeGroup.canvasColor,
      backgroundColor: activeGroup.backgroundColor,
      windowOpacity: windowOpacity ?? 1,
    });
    setBackgroundColorDialogOpen(true);
  }, [activeGroup, setBackgroundColorDialogOpen, setSettingsOpen, windowOpacity]);

  const handleCloseBackgroundColorDialog = useCallback(() => {
    setBackgroundColorPreview(null);
    setBackgroundColorDialogOpen(false);
  }, [setBackgroundColorDialogOpen]);

  const handleConfirmBackgroundColorDialog = useCallback(
    (colors: BackgroundColorPreviewState) => {
      const nextWindowOpacity = clampWindowOpacity(colors.windowOpacity);

      setBackgroundColorPreview(null);
      setWindowOpacity(nextWindowOpacity);
      changeCanvasColors(colors.canvasColor, colors.backgroundColor);
      setBackgroundColorDialogOpen(false);
      void window.desktopApi.window
        .setOpacity({
          opacity: nextWindowOpacity,
          persist: true,
        })
        .catch(() => null);
    },
    [changeCanvasColors, setBackgroundColorDialogOpen],
  );

  const handleToggleSwatches = useCallback(() => {
    setSwatchesHidden((previous) => !previous);
  }, []);

  useEffect(() => {
    const detachNativeMenuListener = window.desktopApi.app.onNativeMenuAction(
      (action) => {
        switch (action) {
          case "show-shortcuts":
            handleShowShortcutsShortcut();
            break;
          case "toggle-canvas-lock":
            toggleCanvasLock();
            break;
          case "toggle-swatches":
            handleToggleSwatches();
            break;
          case "change-canvas-size":
            handleOpenCanvasSizeDialog();
            break;
          case "fit-canvas-to-content":
            resetView();
            break;
          case "fit-canvas-to-window":
            handleFitCanvasToWindow();
            break;
          case "canvas-zoom-in":
            handleZoomCanvas(1);
            break;
          case "canvas-zoom-out":
            handleZoomCanvas(-1);
            break;
          default:
            break;
        }
      },
    );

    return detachNativeMenuListener;
  }, [
    handleFitCanvasToWindow,
    handleOpenCanvasSizeDialog,
    handleShowShortcutsShortcut,
    handleToggleSwatches,
    handleZoomCanvas,
    resetView,
    toggleCanvasLock,
  ]);

  const handleToolbarToolClick = useCallback(
    (tool: "connect" | "doodle" | "blur" | "bw" | "ruler") => {
      if (tool === "ruler") {
        handleRulerTool();
        return;
      }

      handleToolButton(tool);
    },
    [handleRulerTool, handleToolButton],
  );

  const exitDoodle = useCallback(() => {
    setActiveTool((previous) => (previous === "doodle" ? null : previous));
  }, [setActiveTool]);

  const clearDoodles = useCallback(() => {
    if (!displayGroup) {
      return;
    }

    setGroupAnnotations(displayGroup.id, []);
  }, [displayGroup, setGroupAnnotations]);

  const adjustDoodleSize = useCallback(
    (delta: number) => {
      if (activeTool !== "doodle") {
        return;
      }

      const clampSize = (value: number) => Math.max(6, Math.min(48, value));

      if (doodleMode === "brush") {
        setBrushSize((previous) => clampSize(previous + delta));
        return;
      }

      setEraserSize((previous) => clampSize(previous + delta));
    },
    [activeTool, doodleMode, setBrushSize, setEraserSize],
  );

  useAppShortcuts({
    shortcutBindings,
    activeTool,
    selectedItemIds,
    clipboardItems,
    handleOpenProject,
    handleSaveProject,
    handleSaveProjectAs,
    handleExportCanvasImage,
    handleExportGroupImages,
    handleExportAllTasksHtml,
    selectAllItems: handleSelectAllItems,
    undo,
    redo,
    cutSelectedItems,
    copySelectedItemsToClipboard,
    pasteClipboardItems,
    deleteSelectedItems,
    clearDoodles,
    cropSelectedImage: toggleCropSelectedImage,
    flipSelectedItemsHorizontally,
    resetView,
    fitCanvasToWindow: handleFitCanvasToWindow,
    openCanvasSizeDialog: handleOpenCanvasSizeDialog,
    toggleCanvasLock,
    toggleSwatches: handleToggleSwatches,
    showSettings: handleShowShortcutsShortcut,
    clearTransientUi,
    exitDoodle,
    openGroupDialog,
    openTaskDialog,
    arrangeSelectedItems,
    autoArrange,
    toggleAutoArrangeOnImport: () =>
      setAutoArrangeOnImport((previous) => !previous),
    openConnectDialog,
    toggleDoodle: () => handleToolButton("doodle"),
    setDoodleMode,
    adjustDoodleSize,
    toggleRuler: handleRulerTool,
    toggleBlur,
    toggleBlackAndWhite,
    zoomInCanvas: () => handleZoomCanvas(1),
    zoomOutCanvas: () => handleZoomCanvas(-1),
    toggleAlwaysOnTop: handleToggleAlwaysOnTop,
    quitApplication: handleCloseWindow,
    importFromPayload,
  });

  return (
    <div
      ref={appShellRef}
      className="app-shell"
      style={appShellStyle}
      onDragOver={handleShellDragOver}
      onDrop={handleAppShellDrop}
      onPointerDownCapture={handleShellPointerDownCapture}
      onPointerMoveCapture={handleShellPointerMoveCapture}
      onPointerUpCapture={handleShellPointerUpCapture}
      onPointerCancelCapture={handleShellPointerUpCapture}
      onContextMenu={handleShellContextMenu}
    >
      <div className={`desktop-frame ${windowFocused ? "" : "window-unfocused"}`}>
        <TopBar
          activeGroup={activeGroup}
          activeTool={activeTool}
          shortcutBindings={shortcutBindings}
          seenTitleBarTooltips={seenTitleBarTooltips}
          settingsOpen={settingsOpen}
          selectedCount={selectedItemIds.length}
          canCropSelected={Boolean(selectedStatusImage)}
          canPaste={clipboardItems.length > 0}
          canExportSelectedTask={Boolean(exportSelectedTask)}
          canExportAnyTask={project.tasks.length > 0}
          canvasLocked={activeGroup?.locked ?? false}
          canUndo={canUndo}
          canRedo={canRedo}
          windowMaximized={windowMaximized}
          windowAlwaysOnTop={windowAlwaysOnTop}
          onBrandClick={() => setAppInfoOpen((previous) => !previous)}
          onToggleSettings={() => setSettingsOpen((previous) => !previous)}
          onShowHelp={() => {
            setSettingsOpen(false);
            setHelpOpen((previous) => !previous);
          }}
          onOpenProject={() => {
            setSettingsOpen(false);
            void handleOpenProject();
          }}
          onImportTasks={() => {
            setSettingsOpen(false);
            void handleImportTasks();
          }}
          onSaveProject={() => {
            setSettingsOpen(false);
            void handleSaveProject();
          }}
          onSaveProjectAs={() => {
            setSettingsOpen(false);
            void handleSaveProjectAs();
          }}
          onExportCanvasImage={() => {
            setSettingsOpen(false);
            void handleExportCanvasImage();
          }}
          onExportGroupImages={() => {
            setSettingsOpen(false);
            void handleExportGroupImages();
          }}
          onExportSelectedTaskHtml={() => {
            setSettingsOpen(false);
            void handleExportSelectedTaskHtml();
          }}
          onExportAllTasksHtml={() => {
            setSettingsOpen(false);
            void handleExportAllTasksHtml();
          }}
          onExportSelectedTaskTxt={() => {
            setSettingsOpen(false);
            void handleExportSelectedTaskTxt();
          }}
          onExportAllTasksTxt={() => {
            setSettingsOpen(false);
            void handleExportAllTasksTxt();
          }}
          onChangeCanvasSize={() => {
            setSettingsOpen(false);
            handleOpenCanvasSizeDialog();
          }}
          onToggleCanvasLock={() => {
            setSettingsOpen(false);
            toggleCanvasLock();
          }}
          onToggleSwatches={() => {
            setSettingsOpen(false);
            handleToggleSwatches();
          }}
          onToolClick={handleToolbarToolClick}
          onAutoArrange={() => {
            setSettingsOpen(false);
            autoArrange();
          }}
          onShowBackgroundColor={() => {
            handleOpenBackgroundColorDialog();
          }}
          onResetView={handleFitCanvasToWindow}
          onFitCanvasToContent={resetView}
          onTaskClick={openTaskDialog}
          onCreateGroup={openGroupDialog}
          onShowShortcuts={() => {
            setSettingsOpen(false);
            openShortcutDialog();
          }}
          onPaste={() => {
            setSettingsOpen(false);
            pasteClipboardItems();
          }}
          onCropSelected={() => {
            setSettingsOpen(false);
            toggleCropSelectedImage();
          }}
          onFlipSelectedHorizontally={() => {
            setSettingsOpen(false);
            flipSelectedItemsHorizontally();
          }}
          onUndo={() => {
            setSettingsOpen(false);
            undo();
          }}
          onRedo={() => {
            setSettingsOpen(false);
            redo();
          }}
          onExit={() => {
            setSettingsOpen(false);
            handleCloseWindow();
          }}
          onMinimize={handleMinimizeWindow}
          onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
          onToggleMaximize={handleToggleMaximize}
          onCloseWindow={handleCloseWindow}
          onMarkTitleBarTooltipSeen={markTitleBarTooltipSeen}
        />

        <div className="desktop-layout">
          <main className="workspace-panel">
            <div
              className="canvas-stage"
              ref={canvasStageRef}
              style={{
                backgroundColor: hexToRgba(
                  displayGroup?.backgroundColor ??
                    DEFAULT_GROUP_BACKGROUND_COLOR,
                  appBackgroundOpacity,
                ),
              }}
            >
              {displayGroup ? (
                <CanvasBoard
                  group={displayGroup}
                  surfaceOpacity={appBackgroundOpacity}
                  showSwatches={!swatchesHidden}
                  activeTool={activeTool}
                  doodleMode={doodleMode}
                  doodleColor={doodleColor}
                  doodleSize={activeDoodleSize}
                  selectedItemIds={selectedItemIds}
                  cropSession={cropSession}
                  onCropRectChange={(rect) =>
                    setCropSession((previous) =>
                      previous ? { ...previous, rect } : previous,
                    )
                  }
                  onSelectionChange={handleCanvasSelectionChange}
                  onViewChange={handleBoardViewChange}
                  onItemsPatch={handleBoardItemsPatch}
                  onAnnotationsChange={(annotations) =>
                    setGroupAnnotations(displayGroup.id, annotations)
                  }
                  onItemDoubleClick={(itemId) => {
                    openZoomOverlay(itemId);
                  }}
                  onCanvasSizePreviewChange={setCanvasSizePreview}
                  onExportReady={(exportCanvas) => {
                    exportCanvasImageRef.current = exportCanvas;
                  }}
                />
              ) : null}

              {!zoomOverlayOpen ? (
                <>
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
                        groups={project.groups}
                        primaryTask={primaryTask}
                        selectedTaskId={selectedTaskId}
                        expanded={taskListExpanded}
                        onToggleExpanded={toggleTaskListExpanded}
                        onSelectTask={(taskId) => {
                          selectTaskAndActivateLinkedGroup(taskId);
                          setTaskDetailOpen(true);
                        }}
                        onInteract={registerTaskOverlayInteraction}
                        onHoverChange={setTaskOverlayHovering}
                        onFocusWithinChange={setTaskOverlayFocusWithin}
                        onCreateTask={openTaskDialog}
                        onRenameTask={openRenameTaskDialog}
                        onDuplicateTask={handleDuplicateTask}
                        onDeleteTask={requestDeleteTaskById}
                        onChangeTaskDates={openEditTaskDialog}
                        onCompleteTask={completeTask}
                        onLinkTaskToGroup={linkTaskToGroup}
                      />
                    ) : null}
                  </div>

                  <div className="canvas-overlay-column bottom-left">
                    <GroupOverlay
                      groups={project.groups}
                      activeGroupId={project.activeGroupId}
                      open={groupsOverlayOpen}
                      onOpenChange={setGroupsOverlayOpen}
                      onSelectGroup={(groupId) => {
                        setActiveGroup(groupId);
                        setSelectedItemIds([]);
                      }}
                      onRenameGroup={(groupId) => {
                        const targetGroup = project.groups.find(
                          (group) => group.id === groupId,
                        );
                        if (!targetGroup || targetGroup.kind !== "group") {
                          return;
                        }

                        openRenameGroupDialog(targetGroup.id, targetGroup.name);
                      }}
                      onDeleteGroup={requestDeleteGroupById}
                    />
                  </div>

                  {selectedTask ? (
                    <div className="canvas-overlay-column right-center">
                      <TaskDetailPanel
                        task={selectedTask}
                        linkedGroupName={linkedSelectedTaskGroupName}
                        groups={project.groups}
                        open={taskDetailOpen}
                        pinned={taskDetailPinned}
                        onReveal={() => {
                          registerTaskDetailInteraction();
                          setTaskDetailOpen(true);
                        }}
                        onTogglePinned={toggleTaskDetailPinned}
                        onDeleteTask={requestDeleteSelectedTask}
                        onChangeTaskDates={() => openEditTaskDialog(selectedTask.id)}
                        onCompleteTask={completeTask}
                        onLinkTaskToGroup={linkTaskToGroup}
                        onInteract={registerTaskDetailInteraction}
                        onHoverChange={setTaskDetailHovering}
                        onFocusWithinChange={setTaskDetailFocusWithin}
                        onAddTodo={addTodo}
                        onRemoveTodo={removeTodo}
                        onToggleTodo={toggleTodo}
                        onRenameTodo={renameTodo}
                        onReorderTodo={reorderTodo}
                        onShowTodoGuide={maybeShowTodoGuide}
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
                </>
              ) : null}

              {zoomOverlayOpen && zoomOverlayItemId ? (
                <ZoomOverlay
                  items={zoomOverlayItems}
                  activeImageId={zoomOverlayItemId}
                  rulerEnabled={rulerEnabled}
                  rulerDialogOpen={rulerDialogOpen}
                  rulerSettings={rulerSettings}
                  draftRulerSettings={draftRulerSettings}
                  filterStyle={zoomOverlayFilter}
                  showBlurControl={activeTool === "blur"}
                  blurAmount={activeGroup?.filters.blur ?? 0}
                  slideshowPlaying={slideshowPlaying}
                  slideshowSeconds={slideshowSeconds}
                  onBlurChange={(blur) => {
                    if (!activeGroup) {
                      return;
                    }

                    setGroupFilters(activeGroup.id, { blur });
                  }}
                  onPrevious={selectPreviousZoomImage}
                  onNext={selectNextZoomImage}
                  onToggleSlideshow={() =>
                    setSlideshowPlaying((previous) => !previous)
                  }
                  onSlideshowSecondsChange={setSlideshowSeconds}
                  onDraftRulerSettingsChange={setDraftRulerSettings}
                  onApplyRulerSettings={applyRulerSettings}
                  onCancelRuler={cancelRuler}
                  onClose={closeZoomOverlay}
                />
              ) : null}
            </div>

            {activeTool === "blur" && activeGroup && !zoomOverlayOpen ? (
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

        {!zoomOverlayOpen ? (
          <StatusBar
            selectedCount={selectedItemIds.length}
            selectedImage={selectedStatusImage}
            zoomLabel={zoomLabel}
            canvasLabel={canvasLabel}
            autoArrangeEnabled={autoArrangeOnImport}
            onToggleAutoArrange={() =>
              setAutoArrangeOnImport((previous) => !previous)
            }
          />
        ) : null}
      </div>

      {menuState ? (
        <AppMenu
          x={menuState.x}
          y={menuState.y}
          shortcutBindings={shortcutBindings}
          selectedCount={selectedItemIds.length}
          canCropSelected={Boolean(selectedStatusImage)}
          canExportSwatch={canExportSelectedSwatch}
          canPaste={clipboardItems.length > 0}
          canExportSelectedTask={Boolean(exportSelectedTask)}
          canExportAnyTask={project.tasks.length > 0}
          canDeleteActiveGroup={canDeleteActiveGroup}
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
          onImportTasks={() => {
            setMenuState(null);
            void handleImportTasks();
          }}
          onSave={() => {
            setMenuState(null);
            void handleSaveProject();
          }}
          onSaveAs={() => {
            setMenuState(null);
            void handleSaveProjectAs();
          }}
          canvasLocked={activeGroup?.locked ?? false}
          onToggleBlur={() => {
            setMenuState(null);
            toggleBlur();
          }}
          onToggleBlackAndWhite={() => {
            setMenuState(null);
            toggleBlackAndWhite();
          }}
          onActivateDoodle={() => {
            setMenuState(null);
            handleToolButton("doodle");
          }}
          onShowBackgroundColor={() => {
            handleOpenBackgroundColorDialog();
          }}
          onChangeCanvasSize={handleOpenCanvasSizeDialog}
          onToggleCanvasLock={() => {
            setMenuState(null);
            toggleCanvasLock();
          }}
          onToggleSwatches={() => {
            setMenuState(null);
            handleToggleSwatches();
          }}
          onResetView={() => {
            setMenuState(null);
            handleFitCanvasToWindow();
          }}
          onFitCanvasToContent={() => {
            setMenuState(null);
            resetView();
          }}
          onCreateGroup={() => {
            setMenuState(null);
            openGroupDialog();
          }}
          onDeleteCurrentGroup={() => {
            setMenuState(null);
            requestDeleteCurrentGroup();
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
          onExportSelectedTaskTxt={() => {
            setMenuState(null);
            void handleExportSelectedTaskTxt();
          }}
          onExportAllTasksTxt={() => {
            setMenuState(null);
            void handleExportAllTasksTxt();
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
          onCropSelected={() => {
            setMenuState(null);
            toggleCropSelectedImage();
          }}
          onFlipSelectedHorizontally={() => {
            setMenuState(null);
            flipSelectedItemsHorizontally();
          }}
          onArrangeSelectedAuto={() => {
            setMenuState(null);
            arrangeSelectedItems("horizontal");
          }}
          onExportSwatch={() => {
            setMenuState(null);
            void handleExportSelectedSwatch();
          }}
          onExit={() => {
            setMenuState(null);
            handleCloseWindow();
          }}
        />
      ) : null}

      {taskImportPreview ? (
        <TaskImportDialog
          preview={taskImportPreview}
          onApply={handleApplyImportedTasks}
          onClose={() => setTaskImportPreview(null)}
        />
      ) : null}

      <AppDialogs
        activeGroup={activeGroup}
        backgroundColorDialogOpen={backgroundColorDialogOpen}
        backgroundColorPreview={backgroundColorPreview}
        canvasHeightInput={canvasHeightInput}
        canvasSizeDialogOpen={canvasSizeDialogOpen}
        canvasWidthInput={canvasWidthInput}
        captureQuality={captureQuality}
        captureSources={captureSources}
        closeGroupDialog={closeGroupDialog}
        closeShortcutDialog={closeShortcutDialog}
        confirmCloseOpen={confirmCloseOpen}
        connectDialogOpen={connectDialogOpen}
        draftGroupName={draftGroupName}
        draftTaskTitle={draftTaskTitle}
        editingGroup={editingGroup}
        editingTaskId={editingTaskId}
        taskDialogMode={taskDialogMode}
        featureGuide={featureGuide}
        groupDialogOpen={groupDialogOpen}
        handleConfirmCanvasSizeDialog={handleConfirmCanvasSizeDialog}
        handleConfirmConnect={handleConfirmConnect}
        handleConfirmDeletion={handleConfirmDeletion}
        handleCreateGroup={handleCreateGroup}
        handleDiscardAndClose={handleDiscardAndClose}
        handleSaveAndClose={handleSaveAndClose}
        handleSubmitTask={handleSubmitTask}
        helpOpen={helpOpen}
        loadingCaptureSources={loadingCaptureSources}
        pendingDeletion={pendingDeletion}
        projectFileName={projectFileName}
        resetAllShortcutDraftBindings={resetAllShortcutDraftBindings}
        resetShortcutDraftBinding={resetShortcutDraftBinding}
        resetTitleBarTooltips={resetTitleBarTooltips}
        saveShortcutBindings={saveShortcutBindings}
        selectedSourceId={selectedSourceId}
        setCanvasHeightInput={setCanvasHeightInput}
        setCanvasSizeDialogOpen={setCanvasSizeDialogOpen}
        setCanvasWidthInput={setCanvasWidthInput}
        setCaptureQuality={setCaptureQuality}
        setConnectDialogOpen={setConnectDialogOpen}
        setDraftGroupName={setDraftGroupName}
        setDraftTaskTitle={setDraftTaskTitle}
        setFeatureGuide={setFeatureGuide}
        setHelpOpen={setHelpOpen}
        setPendingDeletion={setPendingDeletion}
        setSelectedSourceId={setSelectedSourceId}
        setTaskDates={setTaskDates}
        setTaskDialogOpen={setTaskDialogOpen}
        shortcutConflicts={shortcutConflicts}
        shortcutDialogOpen={shortcutDialogOpen}
        shortcutBindings={shortcutBindings}
        shortcutDraftBindings={shortcutDraftBindings}
        taskDates={taskDates}
        taskDialogOpen={taskDialogOpen}
        taskDuration={taskDuration}
        toast={toast}
        updateShortcutDraftBinding={updateShortcutDraftBinding}
        onBackgroundColorDialogClose={handleCloseBackgroundColorDialog}
        onBackgroundColorPreviewChange={setBackgroundColorPreview}
        onBackgroundColorConfirm={handleConfirmBackgroundColorDialog}
        onConfirmCloseCancel={() => setConfirmCloseOpen(false)}
        windowOpacity={windowOpacity ?? 1}
      />
    </div>
  );
};
