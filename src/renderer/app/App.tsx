import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
  DEFAULT_VIEW_ZOOM_BASELINE,
} from "@shared/project-defaults";
import type { Project } from "@shared/types/project";
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
import { TaskOverlay } from "@renderer/features/tasks/components/TaskOverlay";
import { useTaskFeature } from "@renderer/features/tasks/hooks/use-task-feature";
import { ColorWheel } from "@renderer/features/tools/components/ColorWheel";
import { FilterFooter } from "@renderer/features/tools/components/FilterFooter";
import { ZoomOverlay } from "@renderer/features/tools/components/ZoomOverlay";
import { useToolFeature } from "@renderer/features/tools/hooks/use-tool-feature";
import { useZoomOverlay } from "@renderer/features/tools/hooks/use-zoom-overlay";
import { useCanvasWorkspace } from "@renderer/features/workspace/hooks/use-canvas-workspace";
import { useToast } from "@renderer/hooks/use-toast";
import { AppMenu } from "@renderer/app/components/AppMenu";
import { TopBar } from "@renderer/app/components/TopBar";
import { AppInfoPanel } from "@renderer/app/components/AppInfoPanel";
import { StatusBar } from "@renderer/app/components/StatusBar";

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
  const [backgroundColorPreview, setBackgroundColorPreview] = useState<{
    canvasColor: string;
    backgroundColor: string;
  } | null>(null);

  const { toast, pushToast } = useToast();
  const { importQueue, setImportQueue } = useImportQueueSession(project);

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

    const handlePointer = () => {
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
  const handleShellContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setMenuState({
      x: event.clientX,
      y: event.clientY,
    });
  };
  const activeDoodleSize = doodleMode === "brush" ? brushSize : eraserSize;
  const {
    canExportSelectedSwatch,
    handleExportSelectedSwatch,
    handleExportCanvasImage,
    handleExportGroupImages,
    handleExportSelectedTaskHtml,
    handleExportAllTasksHtml,
  } = useExportActions({
    activeGroup,
    project,
    pushToast,
    selectedItemIds,
    selectedTask: selectedTask ?? undefined,
    exportCanvasImageRef,
  });

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
    });
    setBackgroundColorDialogOpen(true);
  }, [activeGroup, setBackgroundColorDialogOpen, setSettingsOpen]);

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
    openCanvasSizeDialog: handleOpenCanvasSizeDialog,
    toggleCanvasLock,
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
    toggleAlwaysOnTop: handleToggleAlwaysOnTop,
    quitApplication: handleCloseWindow,
    importFromPayload,
  });

  return (
    <div
      className="app-shell"
      style={{
        backgroundColor: appShellBackgroundColor,
      }}
      onDragOver={handleShellDragOver}
      onDrop={handleAppShellDrop}
      onContextMenu={handleShellContextMenu}
    >
      <div className="desktop-frame">
        <TopBar
          activeGroup={activeGroup}
          activeTool={activeTool}
          shortcutBindings={shortcutBindings}
          seenTitleBarTooltips={seenTitleBarTooltips}
          settingsOpen={settingsOpen}
          helpOpen={helpOpen}
          selectedCount={selectedItemIds.length}
          canCropSelected={Boolean(selectedStatusImage)}
          canPaste={clipboardItems.length > 0}
          canExportSelectedTask={Boolean(selectedTask)}
          canExportAnyTask={project.tasks.length > 0}
          canDeleteActiveGroup={canDeleteActiveGroup}
          canvasLocked={activeGroup?.locked ?? false}
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
          onChangeCanvasSize={() => {
            setSettingsOpen(false);
            handleOpenCanvasSizeDialog();
          }}
          onToggleCanvasLock={() => {
            setSettingsOpen(false);
            toggleCanvasLock();
          }}
          onToolClick={handleToolbarToolClick}
          onAutoArrange={() => {
            setSettingsOpen(false);
            autoArrange();
          }}
          onToggleBlur={() => {
            setSettingsOpen(false);
            toggleBlur();
          }}
          onToggleBlackAndWhite={() => {
            setSettingsOpen(false);
            toggleBlackAndWhite();
          }}
          onActivateDoodle={() => {
            setSettingsOpen(false);
            handleToolButton("doodle");
          }}
          onShowBackgroundColor={() => {
            handleOpenBackgroundColorDialog();
          }}
          onResetView={resetView}
          onTaskClick={openTaskDialog}
          onCreateGroup={openGroupDialog}
          onDeleteCurrentGroup={() => {
            setSettingsOpen(false);
            requestDeleteCurrentGroup();
          }}
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
                backgroundColor:
                  displayGroup?.backgroundColor ??
                  DEFAULT_GROUP_BACKGROUND_COLOR,
              }}
            >
              {displayGroup ? (
                <CanvasBoard
                  group={displayGroup}
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
                  onSelectionChange={setSelectedItemIds}
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
          canExportSelectedTask={Boolean(selectedTask)}
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
          onResetView={() => {
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
          onExit={() => {
            setMenuState(null);
            handleCloseWindow();
          }}
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
        setBackgroundColorDialogOpen={setBackgroundColorDialogOpen}
        setBackgroundColorPreview={setBackgroundColorPreview}
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
        shortcutDraftBindings={shortcutDraftBindings}
        taskDates={taskDates}
        taskDialogOpen={taskDialogOpen}
        taskDuration={taskDuration}
        toast={toast}
        updateShortcutDraftBinding={updateShortcutDraftBinding}
        changeCanvasColors={changeCanvasColors}
        onConfirmCloseCancel={() => setConfirmCloseOpen(false)}
      />
    </div>
  );
};
