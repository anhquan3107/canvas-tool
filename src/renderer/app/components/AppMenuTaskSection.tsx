import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";

interface AppMenuTaskSectionProps {
  shortcutBindings: ShortcutBindings;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  onCreateTask?: () => void;
  onExportSelectedTaskHtml: () => void;
  onExportAllTasksHtml: () => void;
  onExportSelectedTaskTxt: () => void;
  onExportAllTasksTxt: () => void;
  mode: "main" | "export-submenu";
}

export const AppMenuTaskSection = ({
  shortcutBindings,
  canExportSelectedTask,
  canExportAnyTask,
  onCreateTask,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onExportSelectedTaskTxt,
  onExportAllTasksTxt,
  mode,
}: AppMenuTaskSectionProps) => {
  const [taskExportOpen, setTaskExportOpen] = useState(false);

  const exportSubmenu = (
    <div
      className="app-menu-submenu"
      onPointerEnter={() => setTaskExportOpen(true)}
      onPointerLeave={() => setTaskExportOpen(false)}
    >
      <button
        type="button"
        className="app-menu-submenu-trigger"
        onClick={() => setTaskExportOpen((open) => !open)}
      >
        <MenuItemContent icon="task" label="Export Tasks" submenu />
      </button>
      {taskExportOpen ? (
        <div className="app-menu app-menu-submenu-panel">
          <button
            type="button"
            onClick={onExportSelectedTaskHtml}
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
            onClick={onExportAllTasksHtml}
            disabled={!canExportAnyTask}
          >
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "exportAllTasksHtml")}
            />
          </button>
          <button
            type="button"
            onClick={onExportSelectedTaskTxt}
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
            onClick={onExportAllTasksTxt}
            disabled={!canExportAnyTask}
          >
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "exportAllTasksTxt")}
            />
          </button>
        </div>
      ) : null}
    </div>
  );

  if (mode === "export-submenu") {
    return exportSubmenu;
  }

  return (
    <>
      <button type="button" onClick={onCreateTask}>
        <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "addTask")} />
      </button>
      {exportSubmenu}
    </>
  );
};
