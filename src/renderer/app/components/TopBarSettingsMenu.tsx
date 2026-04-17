import { useEffect, useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { TopBarCanvasMenu } from "@renderer/app/components/TopBarCanvasMenu";
import { TopBarFileMenu } from "@renderer/app/components/TopBarFileMenu";
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
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    closeMenus();
    action();
  };

  const renderMenuButton = (menu: TopBarMenuKey) => (
    <div
      key={menu}
      className="topbar-settings-shell"
      onPointerDown={(event) => event.stopPropagation()}
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
            <TopBarFileMenu
              shortcutBindings={shortcutBindings}
              canExportSelectedTask={canExportSelectedTask}
              canExportAnyTask={canExportAnyTask}
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
                  {...getMenuActionContentProps(shortcutBindings, "keyboardShortcut")}
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
