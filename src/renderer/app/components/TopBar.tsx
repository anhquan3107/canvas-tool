import { useState } from "react";
import type { ReferenceGroup } from "@shared/types/project";
import { TOOL_LABELS, TOOL_ORDER } from "@renderer/features/tools/constants";
import type { ToolMode } from "@renderer/features/tools/types";

interface TopBarProps {
  activeGroup: ReferenceGroup | null | undefined;
  activeTool: ToolMode | null;
  settingsOpen: boolean;
  canPaste: boolean;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  canvasLocked: boolean;
  windowMaximized: boolean;
  windowAlwaysOnTop: boolean;
  onBrandClick: () => void;
  onToggleSettings: () => void;
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
  onExit: () => void;
  onMinimize: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
}

export const TopBar = ({
  activeGroup,
  activeTool,
  settingsOpen,
  canPaste,
  canExportSelectedTask,
  canExportAnyTask,
  canvasLocked,
  windowMaximized,
  windowAlwaysOnTop,
  onBrandClick,
  onToggleSettings,
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
                  Open
                </button>
                <button type="button" onClick={onSaveProject}>
                  Save Canvas
                </button>
                <button type="button" onClick={onSaveProjectAs}>
                  Save Canvas As...
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
                    <span>Export</span>
                    <span className="topbar-settings-submenu-arrow">›</span>
                  </button>
                  {exportOpen ? (
                    <div className="topbar-settings-menu topbar-settings-submenu-panel">
                      <button type="button" onClick={onExportCanvasImage}>
                        Export Canvas to Images
                      </button>
                      <button type="button" onClick={onExportGroupImages}>
                        Export Every Image to Folder
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
                          <span>Export Tasks</span>
                          <span className="topbar-settings-submenu-arrow">›</span>
                        </button>
                        {taskExportOpen ? (
                          <div className="topbar-settings-menu topbar-settings-submenu-panel">
                            <button
                              type="button"
                              onClick={onExportSelectedTaskHtml}
                              disabled={!canExportSelectedTask}
                            >
                              Export Selected Task to HTML
                            </button>
                            <button
                              type="button"
                              onClick={onExportAllTasksHtml}
                              disabled={!canExportAnyTask}
                            >
                              Export All Tasks to HTML
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onResetView}>
                  Reset View
                </button>
                <button type="button" onClick={onChangeCanvasSize}>
                  Change Canvas Size...
                </button>
                <button type="button" onClick={onToggleCanvasLock}>
                  {canvasLocked ? "Unlock Canvas" : "Lock Canvas"}
                </button>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onCreateGroup}>
                  Create Group
                </button>
                <button type="button" onClick={onTaskClick}>
                  Add Task
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
                    <span>Arrange</span>
                    <span className="topbar-settings-submenu-arrow">›</span>
                  </button>
                  {arrangeOpen ? (
                    <div className="topbar-settings-menu topbar-settings-submenu-panel">
                      <button type="button" onClick={onAutoArrange}>
                        Auto Arrange
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onShowBackgroundColor}>
                  Change Background Color
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
                    <span>Filter</span>
                    <span className="topbar-settings-submenu-arrow">›</span>
                  </button>
                  {filterOpen ? (
                    <div className="topbar-settings-menu topbar-settings-submenu-panel">
                      <button type="button" onClick={onToggleBlackAndWhite}>
                        B&amp;W
                      </button>
                      <button type="button" onClick={onToggleBlur}>
                        Blur
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onActivateDoodle}>
                  Doodle
                </button>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onShowShortcuts}>
                  Keyboard Shortcut
                </button>
                <button type="button" disabled={!canPaste} onClick={onPaste}>
                  Paste
                </button>

                <div className="topbar-settings-divider" />
                <button type="button" onClick={onExit}>
                  Exit
                </button>
              </div>
            ) : null}
          </div>

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
