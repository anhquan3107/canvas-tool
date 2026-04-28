import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";
import { useI18n } from "@renderer/i18n";

interface AppMenuTaskSectionProps {
  shortcutBindings: ShortcutBindings;
  canvasLocked?: boolean;
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
  canvasLocked = false,
  canExportSelectedTask,
  canExportAnyTask,
  onCreateTask,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onExportSelectedTaskTxt,
  onExportAllTasksTxt,
  mode,
}: AppMenuTaskSectionProps) => {
  const { copy } = useI18n();
  const [taskExportOpen, setTaskExportOpen] = useState(false);

  const exportSubmenu = (
    <div
      className="app-menu-submenu"
      onPointerEnter={() => {
        if (!canvasLocked) {
          setTaskExportOpen(true);
        }
      }}
      onPointerLeave={() => setTaskExportOpen(false)}
    >
      <button
        type="button"
        className="app-menu-submenu-trigger"
        disabled={canvasLocked}
        onClick={() => {
          if (!canvasLocked) {
            setTaskExportOpen(true);
          }
        }}
      >
        <MenuItemContent icon="task" label={copy.menu.exportTasks} submenu />
      </button>
      {taskExportOpen && !canvasLocked ? (
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
                copy.menu.actions,
              )}
            />
          </button>
          <button
            type="button"
            onClick={onExportAllTasksHtml}
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
            onClick={onExportSelectedTaskTxt}
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
            onClick={onExportAllTasksTxt}
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
  );

  if (mode === "export-submenu") {
    return exportSubmenu;
  }

  return (
    <>
      <button type="button" onClick={onCreateTask} disabled={canvasLocked}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "addTask",
            copy.menu.actions,
          )}
        />
      </button>
    </>
  );
};
