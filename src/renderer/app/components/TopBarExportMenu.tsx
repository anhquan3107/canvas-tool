import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";
import { useI18n } from "@renderer/i18n";

interface TopBarExportMenuProps {
  shortcutBindings: ShortcutBindings;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  runMenuAction: (action: () => void) => void;
  onExportCanvasImage: () => void;
  onExportGroupImages: () => void;
  onExportSelectedTaskHtml: () => void;
  onExportAllTasksHtml: () => void;
  onExportSelectedTaskTxt: () => void;
  onExportAllTasksTxt: () => void;
}

export const TopBarExportMenu = ({
  shortcutBindings,
  canExportSelectedTask,
  canExportAnyTask,
  runMenuAction,
  onExportCanvasImage,
  onExportGroupImages,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onExportSelectedTaskTxt,
  onExportAllTasksTxt,
}: TopBarExportMenuProps) => {
  const { copy } = useI18n();
  const [taskExportOpen, setTaskExportOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => runMenuAction(onExportCanvasImage)}
      >
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "exportCanvasImage",
            copy.menu.actions,
          )}
        />
      </button>
      <button
        type="button"
        onClick={() => runMenuAction(onExportGroupImages)}
      >
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "exportGroupImages",
            copy.menu.actions,
          )}
        />
      </button>
      <div
        className="topbar-settings-submenu"
        onPointerEnter={() => setTaskExportOpen(true)}
        onPointerLeave={() => setTaskExportOpen(false)}
      >
        <button
          type="button"
          className="topbar-settings-submenu-trigger"
          onClick={() => setTaskExportOpen(true)}
        >
          <MenuItemContent icon="task" label={copy.menu.exportTasks} submenu />
        </button>
        {taskExportOpen ? (
          <div className="topbar-settings-menu topbar-settings-submenu-panel">
            <button
              type="button"
              onClick={() => runMenuAction(onExportSelectedTaskHtml)}
              disabled={!canExportSelectedTask}
            >
              <MenuItemContent
                {...getMenuActionContentProps(
                  shortcutBindings,
                  "exportSelectedTaskHtml",
                  copy.menu.actions,
                )}
              />
            </button>
            <button
              type="button"
              onClick={() => runMenuAction(onExportAllTasksHtml)}
              disabled={!canExportAnyTask}
            >
              <MenuItemContent
                {...getMenuActionContentProps(
                  shortcutBindings,
                  "exportAllTasksHtml",
                  copy.menu.actions,
                )}
              />
            </button>
            <button
              type="button"
              onClick={() => runMenuAction(onExportSelectedTaskTxt)}
              disabled={!canExportSelectedTask}
            >
              <MenuItemContent
                {...getMenuActionContentProps(
                  shortcutBindings,
                  "exportSelectedTaskTxt",
                  copy.menu.actions,
                )}
              />
            </button>
            <button
              type="button"
              onClick={() => runMenuAction(onExportAllTasksTxt)}
              disabled={!canExportAnyTask}
            >
              <MenuItemContent
                {...getMenuActionContentProps(
                  shortcutBindings,
                  "exportAllTasksTxt",
                  copy.menu.actions,
                )}
              />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
};
