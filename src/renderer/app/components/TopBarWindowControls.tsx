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
      onClick={() =>
        runTitleBarAction(
          {
            id: "topbar.shortcuts",
            label: "Open Keyboard Shortcuts",
            description:
              "Open shortcut settings to view, customize, and reset the app's keyboard bindings.",
          },
          onShowShortcuts,
        )
      }
      aria-label="Keyboard shortcuts"
    >
      <Settings size={13} strokeWidth={1.9} />
    </button>
    <button
      type="button"
      className={`window-button ${windowAlwaysOnTop ? "active" : ""}`}
      onClick={() =>
        runTitleBarAction(
          {
            id: "topbar.alwaysOnTop",
            label: "Always on Top",
            description:
              "Keep the app floating above other windows so your reference board stays visible while you work.",
            shortcutActionId: "window.toggleAlwaysOnTop",
          },
          onToggleAlwaysOnTop,
        )
      }
      aria-label="Toggle always on top"
    >
      ⇪
    </button>
    <button
      type="button"
      className="window-button"
      onClick={() =>
        runTitleBarAction(
          {
            id: "topbar.minimize",
            label: "Minimize Window",
            description:
              "Send the app to the dock or taskbar without closing your current project.",
          },
          onMinimize,
        )
      }
    >
      -
    </button>
    <button
      type="button"
      className="window-button"
      onClick={() =>
        runTitleBarAction(
          {
            id: "topbar.maximize",
            label: windowMaximized ? "Restore Window" : "Maximize Window",
            description: windowMaximized
              ? "Return the app window to its previous size."
              : "Expand the app window to take up more screen space.",
          },
          onToggleMaximize,
        )
      }
    >
      {windowMaximized ? "❐" : "□"}
    </button>
    <button
      type="button"
      className="window-button close"
      onClick={() =>
        runTitleBarAction(
          {
            id: "topbar.close",
            label: "Close Window",
            description:
              "Close the current app window and trigger the normal save-check flow if there are unsaved changes.",
          },
          onCloseWindow,
        )
      }
    >
      ×
    </button>
  </div>
);
