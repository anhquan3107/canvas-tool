import { Lock, Settings } from "lucide-react";
import { useCallback, type PointerEventHandler } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { TopBarHoverTooltip } from "@renderer/app/components/TopBarHoverTooltip";
import { formatMenuShortcut } from "@renderer/app/components/MenuItemContent";
import { useI18n } from "@renderer/i18n";

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
}: TopBarWindowControlsProps) => {
  const { copy, locale, setLocale } = useI18n();
  const handlePointerReleaseBlur = useCallback<PointerEventHandler<HTMLButtonElement>>(
    (event) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") {
        return;
      }

      event.currentTarget.blur();
    },
    [],
  );

  return (
    <div className="window-cluster" data-window-no-drag="true">
      <TopBarHoverTooltip
        label={
          locale === "en"
            ? copy.language.switchToVietnamese
            : copy.language.switchToEnglish
        }
      >
        <button
          type="button"
          className="topbar-locale-button"
          onClick={() => void setLocale(locale === "en" ? "vi" : "en")}
          onPointerUp={handlePointerReleaseBlur}
          aria-label={copy.language.label}
        >
          {locale === "en" ? copy.language.english : copy.language.vietnamese}
        </button>
      </TopBarHoverTooltip>
      <TopBarHoverTooltip
        label={`${copy.windowControls.keyboardShortcuts} (${formatMenuShortcut(shortcutBindings, "window.showSettings")})`}
      >
        <button
          type="button"
          className="chrome-chip"
          onClick={onShowShortcuts}
          onPointerUp={handlePointerReleaseBlur}
          aria-label={copy.windowControls.keyboardShortcuts}
        >
          <Settings size={13} strokeWidth={1.9} />
        </button>
      </TopBarHoverTooltip>
      {canvasLocked ? (
        <TopBarHoverTooltip label={copy.windowControls.unlockCanvas}>
          <button
            type="button"
            className={`chrome-chip topbar-lock-indicator ${
              lockedCanvasInteractionPulse ? "blocked" : ""
            }`}
            onClick={onToggleCanvasLock}
            onPointerUp={handlePointerReleaseBlur}
            aria-label={copy.windowControls.unlockCanvas}
          >
            <Lock size={13} strokeWidth={1.9} />
          </button>
        </TopBarHoverTooltip>
      ) : null}
      <TopBarHoverTooltip
        label={`${copy.windowControls.alwaysOnTop} (${formatMenuShortcut(shortcutBindings, "window.toggleAlwaysOnTop")})`}
      >
        <button
          type="button"
          className={`window-button ${windowAlwaysOnTop ? "active" : ""}`}
          onClick={onToggleAlwaysOnTop}
          onPointerUp={handlePointerReleaseBlur}
          aria-label={copy.windowControls.toggleAlwaysOnTop}
        >
          ⇪
        </button>
      </TopBarHoverTooltip>
      <TopBarHoverTooltip label={copy.windowControls.minimize}>
        <button
          type="button"
          className="window-button"
          onClick={onMinimize}
          onPointerUp={handlePointerReleaseBlur}
        >
          -
        </button>
      </TopBarHoverTooltip>
      <TopBarHoverTooltip
        label={
          windowMaximized
            ? copy.windowControls.restore
            : copy.windowControls.maximize
        }
      >
        <button
          type="button"
          className="window-button"
          onClick={onToggleMaximize}
          onPointerUp={handlePointerReleaseBlur}
        >
          {windowMaximized ? "❐" : "□"}
        </button>
      </TopBarHoverTooltip>
      <TopBarHoverTooltip
        label={`${copy.windowControls.closeApp} (${formatMenuShortcut(shortcutBindings, "app.quit")})`}
      >
        <button
          type="button"
          className="window-button close"
          onClick={onCloseWindow}
          onPointerUp={handlePointerReleaseBlur}
        >
          ×
        </button>
      </TopBarHoverTooltip>
    </div>
  );
};
