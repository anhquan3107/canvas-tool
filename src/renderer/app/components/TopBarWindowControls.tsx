import { Settings } from "lucide-react";
import type { ShortcutBindings } from "@shared/shortcuts";
import type {
  PendingTitleBarAction,
  TitleBarTooltipMeta,
} from "@renderer/app/components/topbar-tool-config";

interface TopBarWindowControlsProps {
  shortcutBindings: ShortcutBindings;
  windowAlwaysOnTop: boolean;
  windowMaximized: boolean;
  runTitleBarAction: (meta: TitleBarTooltipMeta, action: () => void) => void;
  onShowShortcuts: () => void;
  onToggleAlwaysOnTop: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
}

export const TopBarWindowControls = ({
  windowAlwaysOnTop,
  windowMaximized,
  runTitleBarAction,
  onShowShortcuts,
  onToggleAlwaysOnTop,
  onMinimize,
  onToggleMaximize,
  onCloseWindow,
}: TopBarWindowControlsProps) => (
  <div className="window-cluster">
    <span className="locale-indicator">ENG</span>
    <button
      type="button"
      className="chrome-chip"
      onClick={onShowShortcuts}
      aria-label="Keyboard shortcuts"
    >
      <Settings size={13} strokeWidth={1.9} />
    </button>
    <button
      type="button"
      className={`window-button ${windowAlwaysOnTop ? "active" : ""}`}
      onClick={onToggleAlwaysOnTop}
      aria-label="Toggle always on top"
    >
      ⇪
    </button>
    <button
      type="button"
      className="window-button"
      onClick={onMinimize}
    >
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
);
