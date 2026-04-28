import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { TopBarExportMenu } from "@renderer/app/components/TopBarExportMenu";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";
import { useI18n } from "@renderer/i18n";

interface TopBarFileMenuProps {
  shortcutBindings: ShortcutBindings;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  runMenuAction: (action: () => void) => void;
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
  onExit: () => void;
}

export const TopBarFileMenu = ({
  shortcutBindings,
  canExportSelectedTask,
  canExportAnyTask,
  runMenuAction,
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
  onExit,
}: TopBarFileMenuProps) => {
  const { copy } = useI18n();
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => runMenuAction(onOpenProject)}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "open",
            copy.menu.actions,
          )}
        />
      </button>
      <button type="button" onClick={() => runMenuAction(onSaveProject)}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "saveCanvas",
            copy.menu.actions,
          )}
        />
      </button>
      <button type="button" onClick={() => runMenuAction(onSaveProjectAs)}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "saveCanvasAs",
            copy.menu.actions,
          )}
        />
      </button>

      <div className="topbar-settings-divider" />

      <div
        className="topbar-settings-submenu"
        onPointerEnter={() => setExportOpen(true)}
        onPointerLeave={() => setExportOpen(false)}
      >
        <button
          type="button"
          className="topbar-settings-submenu-trigger"
          onClick={() => setExportOpen(true)}
        >
          <MenuItemContent icon="export" label={copy.menu.export} submenu />
        </button>
        {exportOpen ? (
          <div className="topbar-settings-menu topbar-settings-submenu-panel">
            <TopBarExportMenu
              shortcutBindings={shortcutBindings}
              canExportSelectedTask={canExportSelectedTask}
              canExportAnyTask={canExportAnyTask}
              runMenuAction={runMenuAction}
              onExportCanvasImage={onExportCanvasImage}
              onExportGroupImages={onExportGroupImages}
              onExportSelectedTaskHtml={onExportSelectedTaskHtml}
              onExportAllTasksHtml={onExportAllTasksHtml}
              onExportSelectedTaskTxt={onExportSelectedTaskTxt}
              onExportAllTasksTxt={onExportAllTasksTxt}
            />
          </div>
        ) : null}
      </div>

      <button type="button" onClick={() => runMenuAction(onImportTasks)}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "importTasks",
            copy.menu.actions,
          )}
        />
      </button>

      <div className="topbar-settings-divider" />

      <button type="button" onClick={() => runMenuAction(onExit)}>
        <MenuItemContent
          icon="exit"
          label={copy.menu.quit}
          shortcut={
            getMenuActionContentProps(
              shortcutBindings,
              "exit",
              copy.menu.actions,
            ).shortcut
          }
        />
      </button>
    </>
  );
};
