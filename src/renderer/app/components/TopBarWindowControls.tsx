import { Lock, Settings } from "lucide-react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { TopBarHoverTooltip } from "@renderer/app/components/TopBarHoverTooltip";
import { formatMenuShortcut } from "@renderer/app/components/MenuItemContent";

interface TopBarWindowControlsProps {
  shortcutBindings: ShortcutBindings;
  canvasLocked: boolean;
  lockedCanvasInteractionPulse: boolean;
  windowAlwaysOnTop: boolean;
  windowMaximized: boolean;
  onShowShortcuts: () => void;
  onToggleCanvasLock: () => void;
  onToggleAlwaysOnTop: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
}

export const TopBarWindowControls = ({
  shortcutBindings,
  canvasLocked,
  lockedCanvasInteractionPulse,
  windowAlwaysOnTop,
  windowMaximized,
  onShowShortcuts,
  onToggleCanvasLock,
  onToggleAlwaysOnTop,
  onMinimize,
  onToggleMaximize,
  onCloseWindow,
}: TopBarWindowControlsProps) => (
  <div className="window-cluster" data-window-no-drag="true">
    <span className="locale-indicator">ENG</span>
    <TopBarHoverTooltip
      label={`Open keyboard shortcuts (${formatMenuShortcut(shortcutBindings, "window.showSettings")})`}
    >
      <button
        type="button"
        className="chrome-chip"
        onClick={onShowShortcuts}
        aria-label="Keyboard shortcuts"
      >
        <Settings size={13} strokeWidth={1.9} />
      </button>
    </TopBarHoverTooltip>
    {canvasLocked ? (
      <TopBarHoverTooltip label="Unlock canvas">
        <button
          type="button"
          className={`chrome-chip topbar-lock-indicator ${
            lockedCanvasInteractionPulse ? "blocked" : ""
          }`}
          onClick={onToggleCanvasLock}
          aria-label="Unlock canvas"
        >
          <Lock size={13} strokeWidth={1.9} />
        </button>
      </TopBarHoverTooltip>
    ) : null}
    <TopBarHoverTooltip
      label={`Keep window on top (${formatMenuShortcut(shortcutBindings, "window.toggleAlwaysOnTop")})`}
    >
      <button
        type="button"
        className={`window-button ${windowAlwaysOnTop ? "active" : ""}`}
        onClick={onToggleAlwaysOnTop}
        aria-label="Toggle always on top"
      >
        ⇪
      </button>
    </TopBarHoverTooltip>
    <TopBarHoverTooltip label="Minimize window">
      <button
        type="button"
        className="window-button"
        onClick={onMinimize}
      >
        -
      </button>
    </TopBarHoverTooltip>
    <TopBarHoverTooltip label={windowMaximized ? "Restore window" : "Maximize window"}>
      <button
        type="button"
        className="window-button"
        onClick={onToggleMaximize}
      >
        {windowMaximized ? "❐" : "□"}
      </button>
    </TopBarHoverTooltip>
    <TopBarHoverTooltip
      label={`Close app (${formatMenuShortcut(shortcutBindings, "app.quit")})`}
    >
      <button
        type="button"
        className="window-button close"
        onClick={onCloseWindow}
      >
        ×
      </button>
    </TopBarHoverTooltip>
  </div>
);
