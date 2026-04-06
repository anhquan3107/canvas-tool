import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";

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
}: TopBarCanvasMenuProps) => (
  <>
    <button type="button" onClick={() => runMenuAction(onResetView)}>
      <MenuItemContent
        {...getMenuActionContentProps(shortcutBindings, "resetView")}
      />
    </button>
    <button
      type="button"
      onClick={() => runMenuAction(onFitCanvasToContent)}
    >
      <MenuItemContent
        {...getMenuActionContentProps(shortcutBindings, "fitCanvasToContent")}
      />
    </button>
    <button type="button" onClick={() => runMenuAction(onChangeCanvasSize)}>
      <MenuItemContent
        {...getMenuActionContentProps(shortcutBindings, "changeCanvasSize")}
      />
    </button>
    <button type="button" onClick={() => runMenuAction(onToggleSwatches)}>
      <MenuItemContent
        {...getMenuActionContentProps(shortcutBindings, "toggleSwatches")}
      />
    </button>

    <div className="topbar-settings-divider" />

    <button type="button" onClick={() => runMenuAction(onToggleCanvasLock)}>
      <MenuItemContent
        icon="lock"
        label={canvasLocked ? "Unlock Canvas" : "Lock Canvas"}
        shortcut={
          getMenuActionContentProps(shortcutBindings, "toggleCanvasLock").shortcut
        }
      />
    </button>
    <button
      type="button"
      onClick={() => runMenuAction(onShowBackgroundColor)}
    >
      <MenuItemContent
        {...getMenuActionContentProps(shortcutBindings, "changeBackgroundColor")}
      />
    </button>

    <div className="topbar-settings-divider" />

    <button type="button" onClick={() => runMenuAction(onAutoArrange)}>
      <MenuItemContent
        {...getMenuActionContentProps(shortcutBindings, "autoArrange")}
      />
    </button>
  </>
);
