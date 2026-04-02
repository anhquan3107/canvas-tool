import { useState } from "react";
import type { ReferenceGroup } from "@shared/types/project";
import type { ShortcutBindings } from "@shared/shortcuts";
import { TopBarHoverTooltip } from "@renderer/app/components/TopBarHoverTooltip";
import type { ToolMode } from "@renderer/features/tools/types";
import { TitleBarTooltipConfirmDialog } from "@renderer/app/components/TitleBarTooltipConfirmDialog";
import { formatMenuShortcut } from "@renderer/app/components/MenuItemContent";
import {
  type PendingTitleBarAction,
  type TitleBarTooltipMeta,
} from "@renderer/app/components/topbar-tool-config";
import { TopBarHelpMenu } from "@renderer/app/components/TopBarHelpMenu";
import { TopBarSettingsMenu } from "@renderer/app/components/TopBarSettingsMenu";
import { TopBarTools } from "@renderer/app/components/TopBarTools";
import { TopBarWindowControls } from "@renderer/app/components/TopBarWindowControls";

interface TopBarProps {
  activeGroup: ReferenceGroup | null | undefined;
  activeTool: ToolMode | null;
  shortcutBindings: ShortcutBindings;
  seenTitleBarTooltips: string[];
  settingsOpen: boolean;
  selectedCount: number;
  canCropSelected: boolean;
  canPaste: boolean;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  canvasLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  windowMaximized: boolean;
  windowAlwaysOnTop: boolean;
  onBrandClick: () => void;
  onToggleSettings: () => void;
  onShowHelp: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onExportCanvasImage: () => void;
  onExportGroupImages: () => void;
  onExportSelectedTaskHtml: () => void;
  onExportAllTasksHtml: () => void;
  onChangeCanvasSize: () => void;
  onToggleCanvasLock: () => void;
  onToolClick: (tool: ToolMode) => void;
  onAutoArrange: () => void;
  onShowBackgroundColor: () => void;
  onResetView: () => void;
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
}

export const TopBar = ({
  activeGroup,
  activeTool,
  shortcutBindings,
  seenTitleBarTooltips,
  settingsOpen,
  selectedCount,
  canCropSelected,
  canPaste,
  canExportSelectedTask,
  canExportAnyTask,
  canvasLocked,
  canUndo,
  canRedo,
  windowMaximized,
  windowAlwaysOnTop,
  onBrandClick,
  onToggleSettings,
  onShowHelp,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onExportCanvasImage,
  onExportGroupImages,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onChangeCanvasSize,
  onToggleCanvasLock,
  onToolClick,
  onAutoArrange,
  onShowBackgroundColor,
  onResetView,
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
}: TopBarProps) => {
  const [pendingTitleBarAction, setPendingTitleBarAction] =
    useState<PendingTitleBarAction | null>(null);

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
      <header className="app-topbar">
        <div className="app-drag-region">
          <button
            type="button"
            className="topbar-brand"
            onClick={() =>
              runTitleBarAction(
                {
                  id: "topbar.brand",
                  label: "CanvasTool Info",
                  description:
                    "Open app information and project details from the title bar brand area.",
                },
                onBrandClick,
              )
            }
          >
            <TopBarHoverTooltip label="Open app info">
              <span>CanvasTool</span>
            </TopBarHoverTooltip>
          </button>

          <nav className="topbar-actions">
            <TopBarSettingsMenu
              shortcutBindings={shortcutBindings}
              settingsOpen={settingsOpen}
              selectedCount={selectedCount}
              canCropSelected={canCropSelected}
              canPaste={canPaste}
              canExportSelectedTask={canExportSelectedTask}
              canExportAnyTask={canExportAnyTask}
              canvasLocked={canvasLocked}
              canUndo={canUndo}
              canRedo={canRedo}
              onToggleSettings={onToggleSettings}
              onOpenProject={onOpenProject}
              onSaveProject={onSaveProject}
              onSaveProjectAs={onSaveProjectAs}
              onExportCanvasImage={onExportCanvasImage}
              onExportGroupImages={onExportGroupImages}
              onExportSelectedTaskHtml={onExportSelectedTaskHtml}
              onExportAllTasksHtml={onExportAllTasksHtml}
              onChangeCanvasSize={onChangeCanvasSize}
              onToggleCanvasLock={onToggleCanvasLock}
              onAutoArrange={onAutoArrange}
              onShowBackgroundColor={onShowBackgroundColor}
              onResetView={onResetView}
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
              onResetView={onResetView}
              onTaskClick={onTaskClick}
              onCreateGroup={onCreateGroup}
            />

            <TopBarHelpMenu
              onShowHelp={onShowHelp}
              onShowAbout={onBrandClick}
              onCloseOtherMenus={() => {
                if (settingsOpen) {
                  onToggleSettings();
                }
              }}
            />
          </nav>
        </div>

        <TopBarWindowControls
          shortcutBindings={shortcutBindings}
          windowAlwaysOnTop={windowAlwaysOnTop}
          windowMaximized={windowMaximized}
          onShowShortcuts={onShowShortcuts}
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
