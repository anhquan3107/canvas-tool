import { useState } from "react";
import type { ReferenceGroup } from "@shared/types/project";
import type { ShortcutBindings } from "@shared/shortcuts";
import { TOOL_LABELS, TOOL_ORDER } from "@renderer/features/tools/constants";
import type { ToolMode } from "@renderer/features/tools/types";
import {
  MenuItemContent,
  formatMenuShortcut,
} from "@renderer/app/components/MenuItemContent";

interface TopBarProps {
  activeGroup: ReferenceGroup | null | undefined;
  activeTool: ToolMode | null;
  shortcutBindings: ShortcutBindings;
  settingsOpen: boolean;
  helpOpen: boolean;
  selectedCount: number;
  canCropSelected: boolean;
  canPaste: boolean;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  canvasLocked: boolean;
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
  onToggleBlur: () => void;
  onToggleBlackAndWhite: () => void;
  onActivateDoodle: () => void;
  onShowBackgroundColor: () => void;
  onResetView: () => void;
  onTaskClick: () => void;
  onCreateGroup: () => void;
  onShowShortcuts: () => void;
  onPaste: () => void;
  onCropSelected: () => void;
  onFlipSelectedHorizontally: () => void;
  onExit: () => void;
  onMinimize: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
}

export const TopBar = ({
  activeGroup,
  activeTool,
  shortcutBindings,
  settingsOpen,
  helpOpen,
  selectedCount,
  canCropSelected,
  canPaste,
  canExportSelectedTask,
  canExportAnyTask,
  canvasLocked,
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
  onToggleBlur,
  onToggleBlackAndWhite,
  onActivateDoodle,
  onShowBackgroundColor,
  onResetView,
  onTaskClick,
  onCreateGroup,
  onShowShortcuts,
  onPaste,
  onCropSelected,
  onFlipSelectedHorizontally,
  onExit,
  onMinimize,
  onToggleAlwaysOnTop,
  onToggleMaximize,
  onCloseWindow,
}: TopBarProps) => {
  const [exportOpen, setExportOpen] = useState(false);
  const [taskExportOpen, setTaskExportOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <header className="app-topbar">
      <div className="app-drag-region">
        <button type="button" className="topbar-brand" onClick={onBrandClick}>
          CanvasTool
        </button>

        <nav className="topbar-actions">
          <div
            className="topbar-settings-shell"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={`toolbar-button ${settingsOpen ? "active" : ""}`}
              onClick={onToggleSettings}
            >
              Setting
            </button>

            {settingsOpen ? (
              <div className="topbar-settings-menu">
                <button type="button" onClick={onOpenProject}>
                  <MenuItemContent
                    icon="open"
                    label="Open"
                    shortcut={formatMenuShortcut(shortcutBindings, "file.open")}
                  />
                </button>
                <button type="button" onClick={onSaveProject}>
                  <MenuItemContent
                    icon="save"
                    label="Save Canvas"
                    shortcut={formatMenuShortcut(shortcutBindings, "file.save")}
                  />
                </button>
                <button type="button" onClick={onSaveProjectAs}>
                  <MenuItemContent
                    icon="saveAs"
                    label="Save Canvas As..."
                    shortcut={formatMenuShortcut(shortcutBindings, "file.saveAs")}
                  />
                </button>
                <div
                  className="topbar-settings-submenu"
                  onPointerEnter={() => setExportOpen(true)}
                  onPointerLeave={() => {
                    setExportOpen(false);
                    setTaskExportOpen(false);
                  }}
                >
                  <button
                    type="button"
                    className="topbar-settings-submenu-trigger"
                    onClick={() => setExportOpen((open) => !open)}
                  >
                    <MenuItemContent icon="export" label="Export" submenu />
                  </button>
                  {exportOpen ? (
                    <div className="topbar-settings-menu topbar-settings-submenu-panel">
                      <button type="button" onClick={onExportCanvasImage}>
                        <MenuItemContent
                          icon="export"
                          label="Export Canvas to Images"
                          shortcut={formatMenuShortcut(
                            shortcutBindings,
                            "export.canvasImage",
                          )}
                        />
                      </button>
                      <button type="button" onClick={onExportGroupImages}>
                        <MenuItemContent
                          icon="export"
                          label="Export Every Image to Folder"
                          shortcut={formatMenuShortcut(
                            shortcutBindings,
                            "export.groupImages",
                          )}
                        />
                      </button>
                      <div
                        className="topbar-settings-submenu"
                        onPointerEnter={() => setTaskExportOpen(true)}
                        onPointerLeave={() => setTaskExportOpen(false)}
                      >
                        <button
                          type="button"
                          className="topbar-settings-submenu-trigger"
                          onClick={() => setTaskExportOpen((open) => !open)}
                        >
                          <MenuItemContent
                            icon="task"
                            label="Export Tasks"
                            submenu
                          />
                        </button>
                        {taskExportOpen ? (
                          <div className="topbar-settings-menu topbar-settings-submenu-panel">
                            <button
                              type="button"
                              onClick={onExportSelectedTaskHtml}
                              disabled={!canExportSelectedTask}
                            >
                              <MenuItemContent
                                icon="task"
                                label="Export Selected Task to HTML"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={onExportAllTasksHtml}
                              disabled={!canExportAnyTask}
                            >
                              <MenuItemContent
                                icon="task"
                                label="Export All Tasks to HTML"
                                shortcut={formatMenuShortcut(
                                  shortcutBindings,
                                  "export.allTasks",
                                )}
                              />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onResetView}>
                  <MenuItemContent
                    icon="resetView"
                    label="Reset View"
                    shortcut={formatMenuShortcut(shortcutBindings, "canvas.resetView")}
                  />
                </button>
                <button type="button" onClick={onChangeCanvasSize}>
                  <MenuItemContent
                    icon="canvasSize"
                    label="Change Canvas Size..."
                    shortcut={formatMenuShortcut(shortcutBindings, "canvas.changeSize")}
                  />
                </button>
                <button type="button" onClick={onToggleCanvasLock}>
                  <MenuItemContent
                    icon="lock"
                    label={canvasLocked ? "Unlock Canvas" : "Lock Canvas"}
                    shortcut={formatMenuShortcut(shortcutBindings, "canvas.toggleLock")}
                  />
                </button>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onCreateGroup}>
                  <MenuItemContent
                    icon="group"
                    label="Create Group"
                    shortcut={formatMenuShortcut(shortcutBindings, "groups.create")}
                  />
                </button>
                <button type="button" onClick={onTaskClick}>
                  <MenuItemContent
                    icon="task"
                    label="Add Task"
                    shortcut={formatMenuShortcut(shortcutBindings, "tasks.add")}
                  />
                </button>

                <div className="topbar-settings-divider" />
                <div
                  className="topbar-settings-submenu"
                  onPointerEnter={() => setArrangeOpen(true)}
                  onPointerLeave={() => setArrangeOpen(false)}
                >
                  <button
                    type="button"
                    className="topbar-settings-submenu-trigger"
                    onClick={() => setArrangeOpen((open) => !open)}
                  >
                    <MenuItemContent icon="arrange" label="Arrange" submenu />
                  </button>
                  {arrangeOpen ? (
                    <div className="topbar-settings-menu topbar-settings-submenu-panel">
                      <button type="button" onClick={onAutoArrange}>
                        <MenuItemContent
                          icon="arrange"
                          label="Auto Arrange"
                          shortcut={formatMenuShortcut(shortcutBindings, "arrange.auto")}
                        />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onShowBackgroundColor}>
                  <MenuItemContent
                    icon="background"
                    label="Change Background Color"
                  />
                </button>
                <div
                  className="topbar-settings-submenu"
                  onPointerEnter={() => setFilterOpen(true)}
                  onPointerLeave={() => setFilterOpen(false)}
                >
                  <button
                    type="button"
                    className="topbar-settings-submenu-trigger"
                    onClick={() => setFilterOpen((open) => !open)}
                  >
                    <MenuItemContent icon="filter" label="Filter" submenu />
                  </button>
                  {filterOpen ? (
                    <div className="topbar-settings-menu topbar-settings-submenu-panel">
                      <button type="button" onClick={onToggleBlackAndWhite}>
                        <MenuItemContent
                          icon="filter"
                          label="B&W"
                          shortcut={formatMenuShortcut(
                            shortcutBindings,
                            "tools.toggleBlackAndWhite",
                          )}
                        />
                      </button>
                      <button type="button" onClick={onToggleBlur}>
                        <MenuItemContent
                          icon="filter"
                          label="Blur"
                          shortcut={formatMenuShortcut(shortcutBindings, "tools.toggleBlur")}
                        />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onActivateDoodle}>
                  <MenuItemContent
                    icon="doodle"
                    label="Doodle"
                    shortcut={formatMenuShortcut(shortcutBindings, "tools.toggleDoodle")}
                  />
                </button>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onShowShortcuts}>
                  <MenuItemContent
                    icon="shortcuts"
                    label="Keyboard Shortcut"
                  />
                </button>
                <button type="button" disabled={!canPaste} onClick={onPaste}>
                  <MenuItemContent
                    icon="paste"
                    label="Paste"
                    shortcut={formatMenuShortcut(shortcutBindings, "edit.paste")}
                  />
                </button>

                {selectedCount > 0 ? (
                  <>
                    <div className="topbar-settings-divider" />
                    <button
                      type="button"
                      onClick={onCropSelected}
                      disabled={!canCropSelected}
                    >
                      <MenuItemContent
                        icon="crop"
                        label="Crop"
                        shortcut={formatMenuShortcut(shortcutBindings, "edit.crop")}
                      />
                    </button>
                    <button type="button" onClick={onFlipSelectedHorizontally}>
                      <MenuItemContent
                        icon="flip"
                        label="Flip Horizontal"
                        shortcut={formatMenuShortcut(
                          shortcutBindings,
                          "edit.flipHorizontal",
                        )}
                      />
                    </button>
                  </>
                ) : null}

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onExit}>
                  <MenuItemContent
                    icon="exit"
                    label="Exit"
                    shortcut={formatMenuShortcut(shortcutBindings, "app.quit")}
                  />
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={`toolbar-button ${helpOpen ? "active" : ""}`}
            onClick={onShowHelp}
          >
            Help
          </button>

          {TOOL_ORDER.map((tool) => (
            <button
              key={tool}
              type="button"
              className={`toolbar-button ${
                activeTool === tool ||
                (tool === "blur" && (activeGroup?.filters.blur ?? 0) > 0) ||
                (tool === "bw" && (activeGroup?.filters.grayscale ?? 0) > 0)
                  ? "active"
                  : ""
              }`}
              onClick={() => onToolClick(tool)}
            >
              {TOOL_LABELS[tool]}
            </button>
          ))}

          <button type="button" className="toolbar-button" onClick={onResetView}>
            Reset View
          </button>
          <button type="button" className="toolbar-button" onClick={onTaskClick}>
            Task
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={onCreateGroup}
          >
            Create Group
          </button>
        </nav>
      </div>

      <div className="window-cluster">
        <span className="locale-indicator">ENG</span>
        <button type="button" className="chrome-chip" onClick={onShowShortcuts}>
          ?
        </button>
        <button
          type="button"
          className={`window-button ${windowAlwaysOnTop ? "active" : ""}`}
          onClick={onToggleAlwaysOnTop}
          title="Always on top"
          aria-label="Toggle always on top"
        >
          ⇪
        </button>
        <button type="button" className="window-button" onClick={onMinimize}>
          -
        </button>
        <button
          type="button"
          className="window-button"
          onClick={onToggleMaximize}
        >
          {windowMaximized ? "❐" : "□"}
        </button>
        <button
          type="button"
          className="window-button close"
          onClick={onCloseWindow}
        >
          ×
        </button>
      </div>
    </header>
  );
};
