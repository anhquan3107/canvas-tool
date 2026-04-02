import { useEffect, useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { TopBarHoverTooltip } from "@renderer/app/components/TopBarHoverTooltip";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";

type TopBarMenuKey = "file" | "edit" | "view";

interface TopBarSettingsMenuProps {
  shortcutBindings: ShortcutBindings;
  settingsOpen: boolean;
  selectedCount: number;
  canCropSelected: boolean;
  canPaste: boolean;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  canvasLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
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
  onAutoArrange: () => void;
  onShowBackgroundColor: () => void;
  onResetView: () => void;
  onShowShortcuts: () => void;
  onPaste: () => void;
  onCropSelected: () => void;
  onFlipSelectedHorizontally: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExit: () => void;
}

const MENU_LABELS: Record<TopBarMenuKey, string> = {
  file: "File",
  edit: "Edit",
  view: "View",
};

const MENU_TOOLTIP_LABELS: Record<TopBarMenuKey, string> = {
  file: "Open file menu",
  edit: "Open edit menu",
  view: "Open view menu",
};

export const TopBarSettingsMenu = ({
  shortcutBindings,
  settingsOpen,
  selectedCount,
  canCropSelected,
  canPaste,
  canExportSelectedTask,
  canExportAnyTask,
  canvasLocked,
  canUndo,
  canRedo,
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
  onAutoArrange,
  onShowBackgroundColor,
  onResetView,
  onShowShortcuts,
  onPaste,
  onCropSelected,
  onFlipSelectedHorizontally,
  onUndo,
  onRedo,
  onExit,
}: TopBarSettingsMenuProps) => {
  const [activeMenu, setActiveMenu] = useState<TopBarMenuKey | null>(null);

  useEffect(() => {
    if (!settingsOpen) {
      setActiveMenu(null);
    }
  }, [settingsOpen]);

  const openMenu = (menu: TopBarMenuKey) => {
    if (!settingsOpen) {
      onToggleSettings();
    }
    setActiveMenu(menu);
  };

  const closeMenus = () => {
    if (settingsOpen) {
      onToggleSettings();
    }
    setActiveMenu(null);
  };

  const toggleMenu = (menu: TopBarMenuKey) => {
    if (settingsOpen && activeMenu === menu) {
      closeMenus();
      return;
    }

    openMenu(menu);
  };

  const runMenuAction = (action: () => void) => {
    closeMenus();
    action();
  };

  const renderMenuButton = (menu: TopBarMenuKey) => (
    <div
      key={menu}
      className="topbar-settings-shell"
      onPointerEnter={() => {
        if (settingsOpen) {
          setActiveMenu(menu);
        }
      }}
    >
      <TopBarHoverTooltip label={MENU_TOOLTIP_LABELS[menu]}>
        <button
          type="button"
          className={`toolbar-button ${
            settingsOpen && activeMenu === menu ? "active" : ""
          }`}
          onClick={() => toggleMenu(menu)}
        >
          {MENU_LABELS[menu]}
        </button>
      </TopBarHoverTooltip>

      {settingsOpen && activeMenu === menu ? (
        <div className="topbar-settings-menu">
          {menu === "file" ? (
            <>
              <button type="button" onClick={() => runMenuAction(onOpenProject)}>
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "open")}
                />
              </button>
              <button type="button" onClick={() => runMenuAction(onSaveProject)}>
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "saveCanvas")}
                />
              </button>
              <button type="button" onClick={() => runMenuAction(onSaveProjectAs)}>
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "saveCanvasAs")}
                />
              </button>

              <div className="topbar-settings-divider" />

              <button
                type="button"
                onClick={() => runMenuAction(onExportCanvasImage)}
              >
                <MenuItemContent
                  icon="export"
                  label="Export Canvas"
                  shortcut={
                    getMenuActionContentProps(shortcutBindings, "exportCanvasImage")
                      .shortcut
                  }
                />
              </button>
              <button
                type="button"
                onClick={() => runMenuAction(onExportGroupImages)}
              >
                <MenuItemContent
                  icon="export"
                  label="Export Groups"
                  shortcut={
                    getMenuActionContentProps(shortcutBindings, "exportGroupImages")
                      .shortcut
                  }
                />
              </button>
              <button
                type="button"
                onClick={() => runMenuAction(onExportAllTasksHtml)}
                disabled={!canExportAnyTask}
              >
                <MenuItemContent
                  icon="task"
                  label="Export Tasks"
                  shortcut={
                    getMenuActionContentProps(shortcutBindings, "exportAllTasksHtml")
                      .shortcut
                  }
                />
              </button>
              <button
                type="button"
                onClick={() => runMenuAction(onExportSelectedTaskHtml)}
                disabled={!canExportSelectedTask}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(
                    shortcutBindings,
                    "exportSelectedTaskHtml",
                  )}
                />
              </button>

              <div className="topbar-settings-divider" />

              <button type="button" onClick={() => runMenuAction(onExit)}>
                <MenuItemContent
                  icon="exit"
                  label="Quit"
                  shortcut={getMenuActionContentProps(shortcutBindings, "exit").shortcut}
                />
              </button>
            </>
          ) : null}

          {menu === "edit" ? (
            <>
              <button
                type="button"
                onClick={() => runMenuAction(onPaste)}
                disabled={!canPaste}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "paste")}
                />
              </button>
              <button
                type="button"
                onClick={() => runMenuAction(onCropSelected)}
                disabled={!canCropSelected}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "crop")}
                />
              </button>
              <button
                type="button"
                onClick={() => runMenuAction(onFlipSelectedHorizontally)}
                disabled={selectedCount === 0}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "flipHorizontal")}
                />
              </button>

              <div className="topbar-settings-divider" />

              <button
                type="button"
                onClick={() => runMenuAction(onUndo)}
                disabled={!canUndo}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "undo")}
                />
              </button>
              <button
                type="button"
                onClick={() => runMenuAction(onRedo)}
                disabled={!canRedo}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "redo")}
                />
              </button>

              <div className="topbar-settings-divider" />

              <button type="button" onClick={() => runMenuAction(onShowShortcuts)}>
                <MenuItemContent
                  icon="shortcuts"
                  label="Keyboard Shortcut"
                />
              </button>
            </>
          ) : null}

          {menu === "view" ? (
            <>
              <button type="button" onClick={() => runMenuAction(onResetView)}>
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "resetView")}
                />
              </button>
              <button type="button" onClick={() => runMenuAction(onChangeCanvasSize)}>
                <MenuItemContent
                  {...getMenuActionContentProps(
                    shortcutBindings,
                    "changeCanvasSize",
                  )}
                />
              </button>

              <div className="topbar-settings-divider" />

              <button type="button" onClick={() => runMenuAction(onToggleCanvasLock)}>
                <MenuItemContent
                  icon="lock"
                  label={canvasLocked ? "Unlock Canvas" : "Lock Canvas"}
                  shortcut={
                    getMenuActionContentProps(shortcutBindings, "toggleCanvasLock")
                      .shortcut
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
                  )}
                />
              </button>

              <div className="topbar-settings-divider" />

              <button type="button" onClick={() => runMenuAction(onAutoArrange)}>
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "autoArrange")}
                />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className="topbar-menu-bar"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {renderMenuButton("file")}
      {renderMenuButton("edit")}
      {renderMenuButton("view")}
    </div>
  );
};
