import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { AppMenuTaskSection } from "@renderer/app/components/AppMenuTaskSection";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";
import { useI18n } from "@renderer/i18n";

interface AppMenuFileSectionProps {
  shortcutBindings: ShortcutBindings;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onImportTasks: () => void;
  onExportCanvasImage: () => void;
  onExportGroupImages: () => void;
  onExportSelectedTaskHtml: () => void;
  onExportAllTasksHtml: () => void;
  onExportSelectedTaskTxt: () => void;
  onExportAllTasksTxt: () => void;
  onExit: () => void;
}

export const AppMenuFileSection = ({
  shortcutBindings,
  canExportSelectedTask,
  canExportAnyTask,
  onOpen,
  onSave,
  onSaveAs,
  onImportTasks,
  onExportCanvasImage,
  onExportGroupImages,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onExportSelectedTaskTxt,
  onExportAllTasksTxt,
  onExit,
}: AppMenuFileSectionProps) => {
  const { copy } = useI18n();
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => void onOpen()}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "open",
            copy.menu.actions,
          )}
        />
      </button>
      <button type="button" onClick={() => void onSave()}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "saveCanvas",
            copy.menu.actions,
          )}
        />
      </button>
      <button type="button" onClick={() => void onSaveAs()}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "saveCanvasAs",
            copy.menu.actions,
          )}
        />
      </button>
      <div
        className="app-menu-submenu"
        onPointerEnter={() => setExportOpen(true)}
        onPointerLeave={() => setExportOpen(false)}
      >
        <button
          type="button"
          className="app-menu-submenu-trigger"
          onClick={() => setExportOpen(true)}
        >
          <MenuItemContent icon="export" label={copy.menu.export} submenu />
        </button>
        {exportOpen ? (
          <div className="app-menu app-menu-submenu-panel">
            <button type="button" onClick={onExportCanvasImage}>
              <MenuItemContent
                {...getMenuActionContentProps(
                  shortcutBindings,
                  "exportCanvasImage",
                  copy.menu.actions,
                )}
              />
            </button>
            <button type="button" onClick={onExportGroupImages}>
              <MenuItemContent
                {...getMenuActionContentProps(
                  shortcutBindings,
                  "exportGroupImages",
                  copy.menu.actions,
                )}
              />
            </button>
            <AppMenuTaskSection
              shortcutBindings={shortcutBindings}
              canExportSelectedTask={canExportSelectedTask}
              canExportAnyTask={canExportAnyTask}
              onExportSelectedTaskHtml={onExportSelectedTaskHtml}
              onExportAllTasksHtml={onExportAllTasksHtml}
              onExportSelectedTaskTxt={onExportSelectedTaskTxt}
              onExportAllTasksTxt={onExportAllTasksTxt}
              mode="export-submenu"
            />
          </div>
        ) : null}
      </div>
      <button type="button" onClick={onImportTasks}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "importTasks",
            copy.menu.actions,
          )}
        />
      </button>
      <div className="app-menu-divider" />
      <button type="button" onClick={onExit}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "exit",
            copy.menu.actions,
          )}
        />
      </button>
    </>
  );
};
