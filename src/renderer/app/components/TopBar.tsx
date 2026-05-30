import {
  useCallback,
  useRef,
  useState,
  type MouseEventHandler,
  type PointerEventHandler,
  type RefObject,
  type TransitionEventHandler,
} from "react";
import type { ReferenceGroup } from "@shared/types/project";
import type { ShortcutBindings } from "@shared/shortcuts";
import { TopBarHoverTooltip } from "@renderer/app/components/TopBarHoverTooltip";
import type { ToolMode } from "@renderer/features/tools/types";
import { TitleBarTooltipConfirmDialog } from "@renderer/app/components/TitleBarTooltipConfirmDialog";
import { formatMenuShortcut } from "@renderer/app/components/menu-shortcuts";
import {
  type PendingTitleBarAction,
  type TitleBarTooltipMeta,
} from "@renderer/app/components/topbar-tool-config";
import { TopBarHelpMenu } from "@renderer/app/components/TopBarHelpMenu";
import { TopBarSettingsMenu } from "@renderer/app/components/TopBarSettingsMenu";
import { TopBarTools } from "@renderer/app/components/TopBarTools";
import { TopBarWindowControls } from "@renderer/app/components/TopBarWindowControls";
import { useI18n } from "@renderer/i18n";

const isMacPlatform = () =>
  /mac/i.test(
    (() => {
      if (typeof navigator === "undefined") {
        return "";
      }

      const navigatorWithUAData = navigator as Navigator & {
        userAgentData?: { platform?: string };
      };

      return navigatorWithUAData.userAgentData?.platform ?? navigator.platform ?? "";
    })(),
  );

const DOUBLE_CLICK_TOGGLE_SUPPRESS_MS = 250;

const isWindowDragTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest("[data-window-no-drag='true']")) {
    return false;
  }

  return Boolean(target.closest("[data-window-left-drag='true']"));
};

interface TopBarProps {
  activeGroup: ReferenceGroup | null | undefined;
  activeTool: ToolMode | null;
  shortcutBindings: ShortcutBindings;
  projectFileName: string | undefined;
  seenTitleBarTooltips: string[];
  settingsOpen: boolean;
  selectedCount: number;
  menuAvailability: {
    cropSelected: boolean;
    paste: boolean;
    exportSelectedTask: boolean;
    exportAnyTask: boolean;
    undo: boolean;
    redo: boolean;
  };
  canvasState: {
    locked: boolean;
    lockedInteractionPulse: boolean;
  };
  windowState: {
    maximized: boolean;
    alwaysOnTop: boolean;
  };
  onBrandClick: () => void;
  onToggleSettings: () => void;
  onShowHelp: () => void;
  onOpenProject: () => void;
  onImportTasks: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onExportCanvasImage: () => void;
  onExportGroupImages: () => void;
  onExportSelectedTaskHtml: () => void;
  onExportAllTasksHtml: () => void;
  onExportSelectedTaskTxt: () => void;
  onExportAllTasksTxt: () => void;
  onChangeCanvasSize: () => void;
  onToggleCanvasLock: () => void;
  onToggleSwatches: () => void;
  onToolClick: (tool: ToolMode) => void;
  onAutoArrange: () => void;
  onShowBackgroundColor: () => void;
  onResetView: () => void;
  onFitCanvasToContent: () => void;
  onTaskClick: () => void;
  onCreateGroup: () => void;
  onShowShortcuts: () => void;
  onPaste: () => void;
  onCropSelected: () => void;
  onFlipSelectedHorizontally: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExit: () => void;
  onMinimize: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
  onMarkTitleBarTooltipSeen: (tooltipId: string) => void;
  className?: string;
  rootRef?: RefObject<HTMLElement | null>;
  onPointerEnter?: PointerEventHandler<HTMLElement>;
  onPointerLeave?: PointerEventHandler<HTMLElement>;
  onTransitionEnd?: TransitionEventHandler<HTMLElement>;
}

export const TopBar = ({
  activeGroup,
  activeTool,
  shortcutBindings,
  projectFileName,
  seenTitleBarTooltips,
  settingsOpen,
  selectedCount,
  menuAvailability,
  canvasState,
  windowState,
  onBrandClick,
  onToggleSettings,
  onShowHelp,
  onOpenProject,
  onImportTasks,
  onSaveProject,
  onSaveProjectAs,
  onExportCanvasImage,
  onExportGroupImages,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onExportSelectedTaskTxt,
  onExportAllTasksTxt,
  onChangeCanvasSize,
  onToggleCanvasLock,
  onToggleSwatches,
  onToolClick,
  onAutoArrange,
  onShowBackgroundColor,
  onResetView,
  onFitCanvasToContent,
  onTaskClick,
  onCreateGroup,
  onShowShortcuts,
  onPaste,
  onCropSelected,
  onFlipSelectedHorizontally,
  onUndo,
  onRedo,
  onExit,
  onMinimize,
  onToggleAlwaysOnTop,
  onToggleMaximize,
  onCloseWindow,
  onMarkTitleBarTooltipSeen,
  className,
  rootRef,
  onPointerEnter,
  onPointerLeave,
  onTransitionEnd,
}: TopBarProps) => {
  const { copy } = useI18n();
  const macPlatform = isMacPlatform();
  const lastPointerDoubleClickToggleRef = useRef(0);
  const [pendingTitleBarAction, setPendingTitleBarAction] =
    useState<PendingTitleBarAction | null>(null);

  const handleHeaderDoubleClick = useCallback<MouseEventHandler<HTMLElement>>(
    (event) => {
      if (
        performance.now() - lastPointerDoubleClickToggleRef.current <
        DOUBLE_CLICK_TOGGLE_SUPPRESS_MS
      ) {
        return;
      }

      if (!isWindowDragTarget(event.target)) {
        return;
      }

      onToggleMaximize();
    },
    [onToggleMaximize],
  );

  const handleHeaderPointerDown = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (event.button !== 0 || event.detail !== 2) {
        return;
      }

      if (!isWindowDragTarget(event.target)) {
        return;
      }

      event.preventDefault();
      lastPointerDoubleClickToggleRef.current = performance.now();
      onToggleMaximize();
    },
    [onToggleMaximize],
  );

  const runTitleBarAction = (meta: TitleBarTooltipMeta, action: () => void) => {
    if (seenTitleBarTooltips.includes(meta.id)) {
      action();
      return;
    }

    onMarkTitleBarTooltipSeen(meta.id);
    setPendingTitleBarAction({
      id: meta.id,
      label: meta.label,
      description: meta.description,
      shortcut: formatMenuShortcut(shortcutBindings, meta.shortcutActionId),
      action,
    });
  };

  return (
    <>
      <header
        ref={rootRef}
        className={`app-topbar${className ? ` ${className}` : ""}${
          macPlatform ? " macos-native-window-controls" : ""
        }`}
        data-window-left-drag="true"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={handleHeaderPointerDown}
        onTransitionEnd={onTransitionEnd}
        onDoubleClick={handleHeaderDoubleClick}
      >
        <div className="app-drag-region" data-window-left-drag="true">
          <button
            type="button"
            className="topbar-brand"
            onClick={() =>
              runTitleBarAction(
                {
                  id: "topbar.brand",
                  label: copy.topbar.brandGuideLabel,
                  description: copy.topbar.brandGuideDescription,
                },
                onBrandClick,
              )
            }
          >
            <TopBarHoverTooltip label={copy.topbar.brandTooltip}>
              <span>CanvasTool</span>
            </TopBarHoverTooltip>
          </button>

          <nav className="topbar-actions" data-window-no-drag="true">
            <TopBarSettingsMenu
              shortcutBindings={shortcutBindings}
              settingsOpen={settingsOpen}
              selectedCount={selectedCount}
              canvasLocked={canvasState.locked}
              availability={menuAvailability}
              onToggleSettings={onToggleSettings}
              onOpenProject={onOpenProject}
              onImportTasks={onImportTasks}
              onSaveProject={onSaveProject}
              onSaveProjectAs={onSaveProjectAs}
              onExportCanvasImage={onExportCanvasImage}
              onExportGroupImages={onExportGroupImages}
              onExportSelectedTaskHtml={onExportSelectedTaskHtml}
              onExportAllTasksHtml={onExportAllTasksHtml}
              onExportSelectedTaskTxt={onExportSelectedTaskTxt}
              onExportAllTasksTxt={onExportAllTasksTxt}
              onChangeCanvasSize={onChangeCanvasSize}
              onToggleCanvasLock={onToggleCanvasLock}
              onToggleSwatches={onToggleSwatches}
              onAutoArrange={onAutoArrange}
              onShowBackgroundColor={onShowBackgroundColor}
              onResetView={onResetView}
              onFitCanvasToContent={onFitCanvasToContent}
              onShowShortcuts={onShowShortcuts}
              onPaste={onPaste}
              onCropSelected={onCropSelected}
              onFlipSelectedHorizontally={onFlipSelectedHorizontally}
              onUndo={onUndo}
              onRedo={onRedo}
              onExit={onExit}
            />

            <TopBarTools
              activeGroup={activeGroup}
              activeTool={activeTool}
              shortcutBindings={shortcutBindings}
              runTitleBarAction={runTitleBarAction}
              onToolClick={onToolClick}
              onTaskClick={onTaskClick}
              onCreateGroup={onCreateGroup}
            />

            <TopBarHelpMenu
              onShowHelp={onShowHelp}
            />
          </nav>
        </div>

        <TopBarWindowControls
          isMacPlatform={macPlatform}
          projectFileName={projectFileName}
          shortcutBindings={shortcutBindings}
          canvasLocked={canvasState.locked}
          lockedCanvasInteractionPulse={canvasState.lockedInteractionPulse}
          windowAlwaysOnTop={windowState.alwaysOnTop}
          windowMaximized={windowState.maximized}
          onShowShortcuts={onShowShortcuts}
          onToggleCanvasLock={onToggleCanvasLock}
          onToggleAlwaysOnTop={onToggleAlwaysOnTop}
          onMinimize={onMinimize}
          onToggleMaximize={onToggleMaximize}
          onCloseWindow={onCloseWindow}
        />
      </header>

      <TitleBarTooltipConfirmDialog
        open={pendingTitleBarAction !== null}
        label={pendingTitleBarAction?.label ?? ""}
        description={pendingTitleBarAction?.description ?? ""}
        shortcut={pendingTitleBarAction?.shortcut}
        onClose={() => setPendingTitleBarAction(null)}
        onConfirm={() => {
          if (!pendingTitleBarAction) {
            return;
          }

          const nextAction = pendingTitleBarAction.action;
          setPendingTitleBarAction(null);
          nextAction();
        }}
      />
    </>
  );
};
