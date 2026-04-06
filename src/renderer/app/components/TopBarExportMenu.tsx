import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";

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
  const [taskExportOpen, setTaskExportOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => runMenuAction(onExportCanvasImage)}
      >
        <MenuItemContent
          {...getMenuActionContentProps(shortcutBindings, "exportCanvasImage")}
        />
      </button>
      <button
        type="button"
        onClick={() => runMenuAction(onExportGroupImages)}
      >
        <MenuItemContent
          {...getMenuActionContentProps(shortcutBindings, "exportGroupImages")}
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
          onClick={() => setTaskExportOpen((open) => !open)}
        >
          <MenuItemContent icon="task" label="Export Tasks" submenu />
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
                )}
              />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
};
