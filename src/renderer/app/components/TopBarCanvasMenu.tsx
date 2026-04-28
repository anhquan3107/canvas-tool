import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";
import { useI18n } from "@renderer/i18n";

interface TopBarCanvasMenuProps {
  shortcutBindings: ShortcutBindings;
  canvasLocked: boolean;
  runMenuAction: (action: () => void) => void;
  onChangeCanvasSize: () => void;
  onToggleCanvasLock: () => void;
  onToggleSwatches: () => void;
  onAutoArrange: () => void;
  onShowBackgroundColor: () => void;
  onResetView: () => void;
  onFitCanvasToContent: () => void;
}

export const TopBarCanvasMenu = ({
  shortcutBindings,
  canvasLocked,
  runMenuAction,
  onChangeCanvasSize,
  onToggleCanvasLock,
  onToggleSwatches,
  onAutoArrange,
  onShowBackgroundColor,
  onResetView,
  onFitCanvasToContent,
}: TopBarCanvasMenuProps) => {
  const { copy } = useI18n();

  return (
    <>
    <button type="button" onClick={() => runMenuAction(onResetView)}>
      <MenuItemContent
        {...getMenuActionContentProps(
          shortcutBindings,
          "resetView",
          copy.menu.actions,
        )}
      />
    </button>
    <button
      type="button"
      onClick={() => runMenuAction(onFitCanvasToContent)}
    >
      <MenuItemContent
        {...getMenuActionContentProps(
          shortcutBindings,
          "fitCanvasToContent",
          copy.menu.actions,
        )}
      />
    </button>
    <button type="button" onClick={() => runMenuAction(onChangeCanvasSize)}>
      <MenuItemContent
        {...getMenuActionContentProps(
          shortcutBindings,
          "changeCanvasSize",
          copy.menu.actions,
        )}
      />
    </button>
    <button type="button" onClick={() => runMenuAction(onToggleSwatches)}>
      <MenuItemContent
        {...getMenuActionContentProps(
          shortcutBindings,
          "toggleSwatches",
          copy.menu.actions,
        )}
      />
    </button>

    <div className="topbar-settings-divider" />

    <button type="button" onClick={() => runMenuAction(onToggleCanvasLock)}>
      <MenuItemContent
        icon="lock"
        label={canvasLocked ? copy.menu.unlockCanvas : copy.menu.lockCanvas}
        shortcut={
          getMenuActionContentProps(
            shortcutBindings,
            "toggleCanvasLock",
            copy.menu.actions,
          ).shortcut
        }
      />
    </button>
    <button
      type="button"
      onClick={() => runMenuAction(onShowBackgroundColor)}
    >
      <MenuItemContent
        {...getMenuActionContentProps(
          shortcutBindings,
          "changeBackgroundColor",
          copy.menu.actions,
        )}
      />
    </button>

    <div className="topbar-settings-divider" />

    <button type="button" onClick={() => runMenuAction(onAutoArrange)}>
      <MenuItemContent
        {...getMenuActionContentProps(
          shortcutBindings,
          "autoArrange",
          copy.menu.actions,
        )}
      />
    </button>
  </>
  );
};
