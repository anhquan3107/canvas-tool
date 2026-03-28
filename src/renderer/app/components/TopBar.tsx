import type { ReferenceGroup } from "@shared/types/project";
import { TOOL_LABELS, TOOL_ORDER } from "@renderer/features/tools/constants";
import type { ToolMode } from "@renderer/features/tools/types";

interface TopBarProps {
  activeGroup: ReferenceGroup | null | undefined;
  activeTool: ToolMode | null;
  settingsOpen: boolean;
  windowMaximized: boolean;
  windowAlwaysOnTop: boolean;
  onBrandClick: () => void;
  onToggleSettings: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onToolClick: (tool: ToolMode) => void;
  onResetView: () => void;
  onTaskClick: () => void;
  onCreateGroup: () => void;
  onShowShortcuts: () => void;
  onMinimize: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
}

export const TopBar = ({
  activeGroup,
  activeTool,
  settingsOpen,
  windowMaximized,
  windowAlwaysOnTop,
  onBrandClick,
  onToggleSettings,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onToolClick,
  onResetView,
  onTaskClick,
  onCreateGroup,
  onShowShortcuts,
  onMinimize,
  onToggleAlwaysOnTop,
  onToggleMaximize,
  onCloseWindow,
}: TopBarProps) => (
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
                Save
              </button>
              <button type="button" onClick={onSaveProjectAs}>
                Save As
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
        <button type="button" className="toolbar-button" onClick={onCreateGroup}>
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
      <button type="button" className="window-button" onClick={onToggleMaximize}>
        {windowMaximized ? "❐" : "□"}
      </button>
      <button type="button" className="window-button close" onClick={onCloseWindow}>
        ×
      </button>
    </div>
  </header>
);
