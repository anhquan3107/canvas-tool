import type { ReferenceGroup } from "@shared/types/project";
import type { ToolMode } from "@renderer/app/types";
import { TOOL_LABELS } from "@renderer/app/utils";

interface TopBarProps {
  activeGroup: ReferenceGroup | null | undefined;
  activeTool: ToolMode | null;
  windowMaximized: boolean;
  onBrandClick: () => void;
  onToolClick: (tool: ToolMode) => void;
  onResetView: () => void;
  onTaskClick: () => void;
  onCreateGroup: () => void;
  onShowShortcuts: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
}

const TOOL_ORDER: ToolMode[] = [
  "connect",
  "doodle",
  "blur",
  "bw",
  "ruler",
];

export const TopBar = ({
  activeGroup,
  activeTool,
  windowMaximized,
  onBrandClick,
  onToolClick,
  onResetView,
  onTaskClick,
  onCreateGroup,
  onShowShortcuts,
  onMinimize,
  onToggleMaximize,
  onCloseWindow,
}: TopBarProps) => (
  <header className="app-topbar">
    <div className="app-drag-region">
      <button type="button" className="topbar-brand" onClick={onBrandClick}>
        CanvasTool
      </button>

      <nav className="topbar-actions">
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
