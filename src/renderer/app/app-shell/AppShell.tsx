import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import { DEFAULT_GROUP_BACKGROUND_COLOR } from "@shared/project-defaults";
import { AppDialogs } from "@renderer/app/components/AppDialogs";
import { AppInfoPanel } from "@renderer/app/components/AppInfoPanel";
import { AppMenu } from "@renderer/app/components/AppMenu";
import { StatusBar } from "@renderer/app/components/StatusBar";
import { TopBar } from "@renderer/app/components/TopBar";
import { useAppDeletion } from "@renderer/app/hooks/use-app-deletion";
import { useAppDerivedState } from "@renderer/app/hooks/use-app-derived-state";
import { useAppFeatureGuide } from "@renderer/app/hooks/use-app-feature-guide";
import { useAppShortcuts } from "@renderer/app/hooks/use-app-shortcuts";
import { useAppUiState } from "@renderer/app/hooks/use-app-ui-state";
import { useCanvasStage } from "@renderer/app/hooks/use-canvas-stage";
import { useExportActions } from "@renderer/app/hooks/use-export-actions";
import { useProjectFileActions } from "@renderer/app/hooks/use-project-file-actions";
import { useShortcutSettings } from "@renderer/app/hooks/use-shortcut-settings";
import { useWindowControls } from "@renderer/app/hooks/use-window-controls";
import { useWindowFocusState } from "@renderer/app/hooks/use-window-focus-state";
import { useWindowRightDrag } from "@renderer/app/hooks/use-window-right-drag";
import { useWindowResize } from "@renderer/app/hooks/use-window-resize";
import {
  type BackgroundColorPreviewState,
  useAppBackgroundActions,
} from "@renderer/app/app-shell/use-app-background-actions";
import { useAppCanvasActions } from "@renderer/app/app-shell/use-app-canvas-actions";
import { useAppDialogActions } from "@renderer/app/app-shell/use-app-dialog-actions";
import { useAppImportFlow } from "@renderer/app/app-shell/use-app-import-flow";
import { useAppMenuActions } from "@renderer/app/app-shell/use-app-menu-actions";
import { useAppSelectionActions } from "@renderer/app/app-shell/use-app-selection-actions";
import {
  type TaskImportPreviewState,
  useAppTaskActions,
} from "@renderer/app/app-shell/use-app-task-actions";
import { useConnectFeature } from "@renderer/features/connect/hooks/use-connect-feature";
import type { CaptureSource } from "@renderer/features/connect/types";
import { CAPTURE_QUALITY_PROFILES } from "@renderer/features/connect/utils";
import { useGroupFeature } from "@renderer/features/groups/hooks/use-group-feature";
import { GroupOverlay } from "@renderer/features/groups/components/GroupOverlay";
import { useImportQueueSession } from "@renderer/features/import/hooks/use-import-queue-session";
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
import { useToast } from "@renderer/hooks/use-toast";
import { useI18n } from "@renderer/i18n";
import { CanvasBoard } from "@renderer/pixi/CanvasBoard";
import { hexToRgba } from "@renderer/pixi/utils/color";
import { useProjectStore } from "@renderer/state/use-project-store";

type CropSession = {
  itemId: string;
  rect: { left: number; top: number; right: number; bottom: number };
} | null;

const clampWindowOpacity = (value: number) => Math.min(1, Math.max(0.05, value));
const TOPBAR_SLIDE_TRANSITION_MS = 180;
const TOPBAR_HIDE_DELAY_MS = 1500;
const APP_WINDOW_RESIZE_DIRECTIONS = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
] as const;

export const AppShell = () => {
  useWindowRightDrag();
  const { copy } = useI18n();
  const windowFocused = useWindowFocusState();
  const customResizeSupported =
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Windows");
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const topbarRef = useRef<HTMLElement | null>(null);
  const topbarRevealZoneRef = useRef<HTMLDivElement | null>(null);
  const topbarQueuedVisibilityRef = useRef<boolean | null>(null);
  const topbarTransitionTimerRef = useRef<number | null>(null);
  const topbarHideDelayTimerRef = useRef<number | null>(null);
  const lockedCanvasIndicatorTimerRef = useRef<number | null>(null);
  const [topbarRevealZoneHovered, setTopbarRevealZoneHovered] = useState(false);
  const [topbarHovered, setTopbarHovered] = useState(false);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const [topbarAnimating, setTopbarAnimating] = useState(false);
  const [lockedCanvasInteractionPulse, setLockedCanvasInteractionPulse] =
    useState(false);
  const topbarVisibleRef = useRef(true);
  const topbarAnimatingRef = useRef(false);

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

  useEffect(() => {
    topbarVisibleRef.current = topbarVisible;
  }, [topbarVisible]);

  useEffect(() => {
    topbarAnimatingRef.current = topbarAnimating;
  }, [topbarAnimating]);

  const clearTopbarTransitionTimer = useCallback(() => {
    if (topbarTransitionTimerRef.current === null) {
      return;
    }

    window.clearTimeout(topbarTransitionTimerRef.current);
    topbarTransitionTimerRef.current = null;
  }, []);

  const clearTopbarHideDelayTimer = useCallback(() => {
    if (topbarHideDelayTimerRef.current === null) {
      return;
    }

    window.clearTimeout(topbarHideDelayTimerRef.current);
    topbarHideDelayTimerRef.current = null;
  }, []);

  const requestTopbarVisibility = useCallback(
    (nextVisible: boolean) => {
      clearTopbarTransitionTimer();

      if (windowFocused) {
        topbarQueuedVisibilityRef.current = null;
        if (!topbarVisibleRef.current) {
          setTopbarVisible(true);
        }
        if (topbarAnimatingRef.current) {
          setTopbarAnimating(false);
        }
        return;
      }

      if (topbarAnimatingRef.current) {
        topbarQueuedVisibilityRef.current = nextVisible;
        return;
      }

      if (topbarVisibleRef.current === nextVisible) {
        topbarQueuedVisibilityRef.current = null;
        return;
      }

      topbarQueuedVisibilityRef.current = null;
      setTopbarAnimating(true);
      setTopbarVisible(nextVisible);
      topbarTransitionTimerRef.current = window.setTimeout(() => {
        topbarTransitionTimerRef.current = null;
        if (!topbarAnimatingRef.current) {
          return;
        }

        setTopbarAnimating(false);
      }, TOPBAR_SLIDE_TRANSITION_MS + 80);
    },
    [clearTopbarTransitionTimer, windowFocused],
  );

  const handleTopbarTransitionEnd = useCallback(
    (event: ReactTransitionEvent<HTMLElement>) => {
      if (
        event.target !== event.currentTarget ||
        event.propertyName !== "transform" ||
        !topbarAnimatingRef.current
      ) {
        return;
      }

      clearTopbarTransitionTimer();
      setTopbarAnimating(false);

      const queuedVisibility = topbarQueuedVisibilityRef.current;
      topbarQueuedVisibilityRef.current = null;
      if (
        typeof queuedVisibility === "boolean" &&
        queuedVisibility !== topbarVisibleRef.current
      ) {
        window.requestAnimationFrame(() => {
          requestTopbarVisibility(queuedVisibility);
        });
      }
    },
    [clearTopbarTransitionTimer, requestTopbarVisibility],
  );

  useEffect(() => {
    if (windowFocused) {
      clearTopbarHideDelayTimer();
      setTopbarRevealZoneHovered(false);
      setTopbarHovered(false);
      requestTopbarVisibility(true);
      return;
    }

    if (topbarRevealZoneHovered || topbarHovered) {
      clearTopbarHideDelayTimer();
      requestTopbarVisibility(true);
      return;
    }

    clearTopbarHideDelayTimer();
    topbarHideDelayTimerRef.current = window.setTimeout(() => {
      topbarHideDelayTimerRef.current = null;
      requestTopbarVisibility(false);
    }, TOPBAR_HIDE_DELAY_MS);
  }, [
    clearTopbarHideDelayTimer,
    requestTopbarVisibility,
    topbarHovered,
    topbarRevealZoneHovered,
    windowFocused,
  ]);

  useEffect(() => {
    return () => {
      clearTopbarHideDelayTimer();
      clearTopbarTransitionTimer();
    };
  }, [clearTopbarHideDelayTimer, clearTopbarTransitionTimer]);

  const handleTopbarRevealZonePointerEnter = useCallback(() => {
    if (windowFocused) {
      return;
    }

    setTopbarRevealZoneHovered(true);
  }, [windowFocused]);

  const handleTopbarRevealZonePointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (topbarRef.current?.contains(event.relatedTarget as Node | null)) {
        return;
      }

      setTopbarRevealZoneHovered(false);
    },
    [],
  );

  const handleTopbarPointerEnter = useCallback(() => {
    if (windowFocused) {
      return;
    }

    setTopbarHovered(true);
  }, [windowFocused]);

  const handleTopbarPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (
        topbarRevealZoneRef.current?.contains(event.relatedTarget as Node | null)
      ) {
        return;
      }

      setTopbarHovered(false);
    },
    [],
  );

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

  const [cropSession, setCropSession] = useState<CropSession>(null);
  const [backgroundColorPreview, setBackgroundColorPreview] =
    useState<BackgroundColorPreviewState | null>(null);
  const [windowOpacity, setWindowOpacity] = useState<number | null>(null);
  const [swatchesHidden, setSwatchesHidden] = useState(false);
  const [taskImportPreview, setTaskImportPreview] =
    useState<TaskImportPreviewState | null>(null);

  const { toast, pushToast, beginProgressToast } = useToast();
  const progressToastControllerRef = useRef<ReturnType<typeof beginProgressToast> | null>(
    null,
  );
  const { importQueue, setImportQueue } = useImportQueueSession(project);

  useEffect(() => {
    if (!toast || typeof toast.progress !== "number") {
      progressToastControllerRef.current = null;
    }
  }, [toast]);

  useEffect(() => {
    const detachProgressListener = window.desktopApi.project.onOperationProgress(
      (progress) => {
        const label = progress.message.replace(/\s+\d+%$/, "");
        if (!progressToastControllerRef.current) {
          progressToastControllerRef.current = beginProgressToast(
            label,
            progress.progress,
          );
          return;
        }

        progressToastControllerRef.current.update(
          progress.progress,
          progress.message,
        );
      },
    );

    return detachProgressListener;
  }, [beginProgressToast]);

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
  }, [setRecentFiles]);

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
  const windowSurfaceColor = hexToRgba(
    appShellBackgroundColor,
    appBackgroundOpacity,
  );

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById("root");
    const previousRootBackground = root.style.backgroundColor;
    const previousBodyBackground = body.style.backgroundColor;
    const previousAppRootBackground = appRoot?.style.backgroundColor ?? "";

    root.style.backgroundColor = windowSurfaceColor;
    body.style.backgroundColor = windowSurfaceColor;
    if (appRoot) {
      appRoot.style.backgroundColor = windowSurfaceColor;
    }

    return () => {
      root.style.backgroundColor = previousRootBackground;
      body.style.backgroundColor = previousBodyBackground;
      if (appRoot) {
        appRoot.style.backgroundColor = previousAppRootBackground;
      }
    };
  }, [windowSurfaceColor]);

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
    setGroupAnnotations,
    setImportQueue,
    setClipboardItems,
    setSelectedItemIds,
    setLastImportedItemIds,
    pushToast,
    beginProgressToast,
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
  useWindowResize(customResizeSupported && !windowMaximized);

  const {
    clearTransientUi,
    handleShellPointerDownCapture,
    handleShellPointerMoveCapture,
    handleShellPointerUpCapture,
    handleShellContextMenu,
  } = useAppMenuActions({
    backgroundColorDialogOpen,
    canvasSizeDialogOpen,
    closeShortcutDialog,
    closeZoomOverlay,
    groupDialogOpen,
    helpOpen,
    menuState,
    settingsOpen,
    taskDialogOpen,
    setAppInfoOpen,
    setBackgroundColorDialogOpen,
    setBackgroundColorPreview,
    setCanvasSizeDialogOpen,
    setConnectDialogOpen,
    setCropSession,
    setGroupDialogOpen,
    setGroupsOverlayOpen,
    setHelpOpen,
    setMenuState,
    setSettingsOpen,
    setTaskDetailOpen,
    setTaskDialogOpen,
  });

  const {
    handleBrandClick,
    handleToggleSettings,
    handleShowHelp,
    handleShowShortcutsShortcut,
  } = useAppDialogActions({
    clearTransientUi,
    openShortcutDialog,
    shortcutDialogOpen,
    setAppInfoOpen,
    setHelpOpen,
    setSettingsOpen,
  });

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  useEffect(
    () => () => {
      if (lockedCanvasIndicatorTimerRef.current !== null) {
        window.clearTimeout(lockedCanvasIndicatorTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!activeGroup?.locked || !cropSession) {
      return;
    }

    setCropSession(null);
  }, [activeGroup?.locked, cropSession]);

  useEffect(() => {
    if (!activeGroup?.locked || selectedItemIds.length === 0) {
      return;
    }

    setSelectedItemIds([]);
  }, [activeGroup?.locked, selectedItemIds.length, setSelectedItemIds]);

  const handleToggleCanvasLock = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    if (!activeGroup.locked) {
      if (cropSession) {
        setCropSession(null);
      }
      if (selectedItemIds.length > 0) {
        setSelectedItemIds([]);
      }
    }

    toggleCanvasLock();
  }, [
    activeGroup,
    cropSession,
    selectedItemIds.length,
    setCropSession,
    setSelectedItemIds,
    toggleCanvasLock,
  ]);

  const handleLockedCanvasInteraction = useCallback(() => {
    if (!activeGroup?.locked) {
      return;
    }

    setLockedCanvasInteractionPulse(true);
    if (lockedCanvasIndicatorTimerRef.current !== null) {
      window.clearTimeout(lockedCanvasIndicatorTimerRef.current);
    }
    lockedCanvasIndicatorTimerRef.current = window.setTimeout(() => {
      setLockedCanvasInteractionPulse(false);
      lockedCanvasIndicatorTimerRef.current = null;
    }, 420);
  }, [activeGroup?.locked]);

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

    const frameId = window.requestAnimationFrame(() => {
      if (
        activeGroupRef.current?.id !== activeGroup.id ||
        (activeGroupRef.current?.items.length ?? 0) > 0
      ) {
        return;
      }

      hasInitializedViewRef.current = true;
      resetView();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeGroup, hasInitializedViewRef, resetView, viewportSize]);

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

    let secondFrameId: number | null = null;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        if (
          activeGroupRef.current?.id !== activeGroup.id ||
          (activeGroupRef.current?.items.length ?? 0) > 0
        ) {
          return;
        }

        centeredGroupIdsRef.current.add(activeGroup.id);
        resetView();
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }
    };
  }, [activeGroup, centeredGroupIdsRef, resetView, viewportSize]);

  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    if (previousActiveGroupIdRef.current !== activeGroupId) {
      previousActiveGroupIdRef.current = activeGroupId;
    }
  }, [activeGroupId, previousActiveGroupIdRef]);

  const {
    selectTaskAndActivateLinkedGroup,
    handleCanvasSelectionChange,
    handleSelectAllItems,
  } = useAppSelectionActions({
    activeGroup,
    projectGroups: project.groups,
    projectTasks: project.tasks,
    zoomOverlayOpen,
    selectTask,
    setActiveGroup,
    setAppInfoOpen,
    setSelectedItemIds,
  });

  const {
    handleOpenCanvasSizeDialog,
    handleConfirmCanvasSizeDialog,
    handleOpenBackgroundColorDialog,
    handleCloseBackgroundColorDialog,
    handleConfirmBackgroundColorDialog,
    handleToggleSwatches,
  } = useAppBackgroundActions({
    activeGroup,
    canvasHeightInput,
    canvasWidthInput,
    changeCanvasColors,
    changeCanvasSize,
    pushToast,
    setBackgroundColorDialogOpen,
    setBackgroundColorPreview,
    setCanvasHeightInput,
    setCanvasSizeDialogOpen,
    setCanvasWidthInput,
    setMenuState,
    setSettingsOpen,
    setSwatchesHidden,
    setWindowOpacity,
    windowOpacity,
  });

  useEffect(() => {
    if (!cropSession) {
      return;
    }

    if (selectedStatusImage?.id !== cropSession.itemId) {
      setCropSession(null);
    }
  }, [cropSession, selectedStatusImage]);

  const {
    activeDoodleSize,
    toggleCropSelectedImage,
    handleFitCanvasToWindow,
    handleZoomCanvas,
    exitDoodle,
    clearDoodles,
    adjustDoodleSize,
  } = useAppCanvasActions({
    activeGroup,
    activeTool,
    applyCropToSelectedImage,
    brushSize,
    displayGroup,
    doodleMode,
    eraserSize,
    cropSession,
    pushToast,
    resetView,
    selectedStatusImage,
    setActiveTool,
    setBrushSize,
    setCropSession,
    setEraserSize,
    setGroupAnnotations,
    setGroupView,
    viewportSize,
    zoomOverlayOpen,
  });

  const {
    handleImportTasks,
    handleApplyImportedTasks,
  } = useAppTaskActions({
    project,
    pushToast,
    setProject,
    taskImportPreview,
    setTaskImportPreview,
  });

  const { handleAppShellDrop } = useAppImportFlow({
    canvasStageRef,
    importFromPayload,
  });

  useEffect(() => {
    const detachNativeMenuListener = window.desktopApi.app.onNativeMenuAction(
      (action) => {
        switch (action) {
          case "show-shortcuts":
            handleShowShortcutsShortcut();
            break;
          case "toggle-canvas-lock":
            handleToggleCanvasLock();
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
    handleToggleCanvasLock,
    handleToggleSwatches,
    handleZoomCanvas,
    resetView,
  ]);

  const handleToolbarToolClick = useCallback(
    (tool: "connect" | "doodle" | "blur" | "bw" | "ruler") => {
      if (tool === "ruler") {
        handleRulerTool();
        return;
      }

      if (tool === "blur") {
        toggleBlur();
        return;
      }

      handleToolButton(tool);
    },
    [handleRulerTool, handleToolButton, toggleBlur],
  );

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
    toggleCanvasLock: handleToggleCanvasLock,
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
      {customResizeSupported && !windowMaximized
        ? APP_WINDOW_RESIZE_DIRECTIONS.map((direction) => (
            <div
              key={direction}
              className={`app-window-resize-handle app-window-resize-${direction}`}
              data-window-resize={direction}
              data-window-no-drag="true"
              aria-hidden="true"
            />
          ))
        : null}
      <div
        className={`desktop-frame ${windowFocused ? "" : "window-unfocused"} ${
          topbarVisible ? "topbar-revealed" : ""
        } ${topbarAnimating ? "topbar-animating" : ""}`}
      >
        <div
          ref={topbarRevealZoneRef}
          className="topbar-reveal-zone"
          aria-hidden="true"
          onPointerEnter={handleTopbarRevealZonePointerEnter}
          onPointerLeave={handleTopbarRevealZonePointerLeave}
        />
        <TopBar
          className={topbarVisible ? "is-revealed" : "is-hidden"}
          rootRef={topbarRef}
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
          lockedCanvasInteractionPulse={lockedCanvasInteractionPulse}
          canUndo={canUndo}
          canRedo={canRedo}
          windowMaximized={windowMaximized}
          windowAlwaysOnTop={windowAlwaysOnTop}
          onBrandClick={handleBrandClick}
          onToggleSettings={handleToggleSettings}
          onShowHelp={handleShowHelp}
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
            handleToggleCanvasLock();
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
          onShowBackgroundColor={handleOpenBackgroundColorDialog}
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
          onPointerEnter={handleTopbarPointerEnter}
          onPointerLeave={handleTopbarPointerLeave}
          onTransitionEnd={handleTopbarTransitionEnd}
        />

        <div className="desktop-layout">
          <main className="workspace-panel">
            <div
              className={`canvas-stage ${zoomOverlayOpen ? "zoom-overlay-active" : ""}`}
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
                  onLockedInteraction={handleLockedCanvasInteraction}
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
                label={copy.tools.labels.blur}
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
          onShowBackgroundColor={handleOpenBackgroundColorDialog}
          onChangeCanvasSize={handleOpenCanvasSizeDialog}
          onToggleCanvasLock={() => {
            setMenuState(null);
            handleToggleCanvasLock();
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
