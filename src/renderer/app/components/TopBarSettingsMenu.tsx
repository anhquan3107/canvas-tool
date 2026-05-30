import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { TopBarCanvasMenu } from "@renderer/app/components/TopBarCanvasMenu";
import { TopBarFileMenu } from "@renderer/app/components/TopBarFileMenu";
import { TopBarHoverTooltip } from "@renderer/app/components/TopBarHoverTooltip";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";
import { useI18n } from "@renderer/i18n";

type TopBarMenuKey = "file" | "edit" | "view";

interface TopBarMenuAvailability {
  cropSelected: boolean;
  paste: boolean;
  exportSelectedTask: boolean;
  exportAnyTask: boolean;
  undo: boolean;
  redo: boolean;
}

interface TopBarSettingsMenuProps {
  shortcutBindings: ShortcutBindings;
  settingsOpen: boolean;
  selectedCount: number;
  canvasLocked: boolean;
  availability: TopBarMenuAvailability;
  onToggleSettings: () => void;
  onOpenProject: () => void;
  onImportTasks: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onExportCanvasImage: () => void;
  onExportGroupImages: () => void;
  onExportSelectedTaskHtml: () => void;
  onExportAllTasksHtml: () => void;
  onExportSelectedTaskTxt: () => void;
  onExportAllTasksTxt: () => void;
  onChangeCanvasSize: () => void;
  onToggleCanvasLock: () => void;
  onToggleSwatches: () => void;
  onAutoArrange: () => void;
  onShowBackgroundColor: () => void;
  onResetView: () => void;
  onFitCanvasToContent: () => void;
  onShowShortcuts: () => void;
  onPaste: () => void;
  onCropSelected: () => void;
  onFlipSelectedHorizontally: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExit: () => void;
}

interface TopBarMenuButtonProps extends TopBarSettingsMenuProps {
  menu: TopBarMenuKey;
  activeMenu: TopBarMenuKey | null;
  runMenuAction: (action: () => void) => void;
  toggleMenu: (menu: TopBarMenuKey) => void;
  onHoverMenu: (menu: TopBarMenuKey) => void;
}

const TopBarMenuButton = ({
  menu,
  shortcutBindings,
  settingsOpen,
  selectedCount,
  canvasLocked,
  availability,
  activeMenu,
  runMenuAction,
  toggleMenu,
  onHoverMenu,
  onOpenProject,
  onImportTasks,
  onSaveProject,
  onSaveProjectAs,
  onExportCanvasImage,
  onExportGroupImages,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onExportSelectedTaskTxt,
  onExportAllTasksTxt,
  onChangeCanvasSize,
  onToggleCanvasLock,
  onToggleSwatches,
  onAutoArrange,
  onShowBackgroundColor,
  onResetView,
  onFitCanvasToContent,
  onShowShortcuts,
  onPaste,
  onCropSelected,
  onFlipSelectedHorizontally,
  onUndo,
  onRedo,
  onExit,
}: TopBarMenuButtonProps) => {
  const { copy } = useI18n();
  const visibleActiveMenu = settingsOpen ? activeMenu : null;

  return (
    <div
      className="topbar-settings-shell"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={() => {
        if (settingsOpen) {
          onHoverMenu(menu);
        }
      }}
    >
      <TopBarHoverTooltip label={copy.topbar.menuTooltips[menu]}>
        <button
          type="button"
          className={`toolbar-button ${
            visibleActiveMenu === menu ? "active" : ""
          }`}
          onClick={() => toggleMenu(menu)}
        >
          {copy.topbar.menus[menu]}
        </button>
      </TopBarHoverTooltip>

      {visibleActiveMenu === menu ? (
        <div className="topbar-settings-menu">
          {menu === "file" ? (
            <TopBarFileMenu
              shortcutBindings={shortcutBindings}
              canExportSelectedTask={availability.exportSelectedTask}
              canExportAnyTask={availability.exportAnyTask}
              runMenuAction={runMenuAction}
              onOpenProject={onOpenProject}
              onImportTasks={onImportTasks}
              onSaveProject={onSaveProject}
              onSaveProjectAs={onSaveProjectAs}
              onExportCanvasImage={onExportCanvasImage}
              onExportGroupImages={onExportGroupImages}
              onExportSelectedTaskHtml={onExportSelectedTaskHtml}
              onExportAllTasksHtml={onExportAllTasksHtml}
              onExportSelectedTaskTxt={onExportSelectedTaskTxt}
              onExportAllTasksTxt={onExportAllTasksTxt}
              onExit={onExit}
            />
          ) : null}

          {menu === "edit" ? (
            <>
              <button
                type="button"
                onClick={() => runMenuAction(onPaste)}
                disabled={!availability.paste}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(
                    shortcutBindings,
                    "paste",
                    copy.menu.actions,
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => runMenuAction(onCropSelected)}
                disabled={!availability.cropSelected}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(
                    shortcutBindings,
                    "crop",
                    copy.menu.actions,
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => runMenuAction(onFlipSelectedHorizontally)}
                disabled={selectedCount === 0}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(
                    shortcutBindings,
                    "flipHorizontal",
                    copy.menu.actions,
                  )}
                />
              </button>

              <div className="topbar-settings-divider" />

              <button
                type="button"
                onClick={() => runMenuAction(onUndo)}
                disabled={!availability.undo}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(
                    shortcutBindings,
                    "undo",
                    copy.menu.actions,
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => runMenuAction(onRedo)}
                disabled={!availability.redo}
              >
                <MenuItemContent
                  {...getMenuActionContentProps(
                    shortcutBindings,
                    "redo",
                    copy.menu.actions,
                  )}
                />
              </button>

              <div className="topbar-settings-divider" />

              <button type="button" onClick={() => runMenuAction(onShowShortcuts)}>
                <MenuItemContent
                  {...getMenuActionContentProps(
                    shortcutBindings,
                    "keyboardShortcut",
                    copy.menu.actions,
                  )}
                />
              </button>
            </>
          ) : null}

          {menu === "view" ? (
            <TopBarCanvasMenu
              shortcutBindings={shortcutBindings}
              canvasLocked={canvasLocked}
              runMenuAction={runMenuAction}
              onChangeCanvasSize={onChangeCanvasSize}
              onToggleCanvasLock={onToggleCanvasLock}
              onToggleSwatches={onToggleSwatches}
              onAutoArrange={onAutoArrange}
              onShowBackgroundColor={onShowBackgroundColor}
              onResetView={onResetView}
              onFitCanvasToContent={onFitCanvasToContent}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export const TopBarSettingsMenu = ({
  shortcutBindings,
  settingsOpen,
  selectedCount,
  canvasLocked,
  availability,
  onToggleSettings,
  onOpenProject,
  onImportTasks,
  onSaveProject,
  onSaveProjectAs,
  onExportCanvasImage,
  onExportGroupImages,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onExportSelectedTaskTxt,
  onExportAllTasksTxt,
  onChangeCanvasSize,
  onToggleCanvasLock,
  onToggleSwatches,
  onAutoArrange,
  onShowBackgroundColor,
  onResetView,
  onFitCanvasToContent,
  onShowShortcuts,
  onPaste,
  onCropSelected,
  onFlipSelectedHorizontally,
  onUndo,
  onRedo,
  onExit,
}: TopBarSettingsMenuProps) => {
  const [activeMenu, setActiveMenu] = useState<TopBarMenuKey | null>(null);
  const visibleActiveMenu = settingsOpen ? activeMenu : null;

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
    if (settingsOpen && visibleActiveMenu === menu) {
      closeMenus();
      return;
    }

    openMenu(menu);
  };

  const runMenuAction = (action: () => void) => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    closeMenus();
    action();
  };

  const menuButtonProps = {
    shortcutBindings,
    settingsOpen,
    selectedCount,
    canvasLocked,
    availability,
    activeMenu: visibleActiveMenu,
    runMenuAction,
    toggleMenu,
    onHoverMenu: setActiveMenu,
    onToggleSettings,
    onOpenProject,
    onImportTasks,
    onSaveProject,
    onSaveProjectAs,
    onExportCanvasImage,
    onExportGroupImages,
    onExportSelectedTaskHtml,
    onExportAllTasksHtml,
    onExportSelectedTaskTxt,
    onExportAllTasksTxt,
    onChangeCanvasSize,
    onToggleCanvasLock,
    onToggleSwatches,
    onAutoArrange,
    onShowBackgroundColor,
    onResetView,
    onFitCanvasToContent,
    onShowShortcuts,
    onPaste,
    onCropSelected,
    onFlipSelectedHorizontally,
    onUndo,
    onRedo,
    onExit,
  };

  return (
    <div
      className="topbar-menu-bar"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {(["file", "edit", "view"] satisfies TopBarMenuKey[]).map((menu) => (
        <TopBarMenuButton key={menu} menu={menu} {...menuButtonProps} />
      ))}
    </div>
  );
};
