import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";

interface TopBarSettingsMenuProps {
  shortcutBindings: ShortcutBindings;
  settingsOpen: boolean;
  selectedCount: number;
  canCropSelected: boolean;
  canPaste: boolean;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  canDeleteActiveGroup: boolean;
  canvasLocked: boolean;
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
  onToggleBlur: () => void;
  onToggleBlackAndWhite: () => void;
  onActivateDoodle: () => void;
  onShowBackgroundColor: () => void;
  onResetView: () => void;
  onTaskClick: () => void;
  onCreateGroup: () => void;
  onDeleteCurrentGroup: () => void;
  onShowShortcuts: () => void;
  onPaste: () => void;
  onCropSelected: () => void;
  onFlipSelectedHorizontally: () => void;
  onExit: () => void;
}

export const TopBarSettingsMenu = ({
  shortcutBindings,
  settingsOpen,
  selectedCount,
  canCropSelected,
  canPaste,
  canExportSelectedTask,
  canExportAnyTask,
  canDeleteActiveGroup,
  canvasLocked,
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
  onToggleBlur,
  onToggleBlackAndWhite,
  onActivateDoodle,
  onShowBackgroundColor,
  onResetView,
  onTaskClick,
  onCreateGroup,
  onDeleteCurrentGroup,
  onShowShortcuts,
  onPaste,
  onCropSelected,
  onFlipSelectedHorizontally,
  onExit,
}: TopBarSettingsMenuProps) => {
  const [exportOpen, setExportOpen] = useState(false);
  const [taskExportOpen, setTaskExportOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div
      className="topbar-settings-shell"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={`toolbar-button ${settingsOpen ? "active" : ""}`}
        onClick={onToggleSettings}
      >
        Setting
      </button>

      {settingsOpen ? (
        <div className="topbar-settings-menu">
          <button type="button" onClick={onOpenProject}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "open")} />
          </button>
          <button type="button" onClick={onSaveProject}>
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "saveCanvas")}
            />
          </button>
          <button type="button" onClick={onSaveProjectAs}>
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "saveCanvasAs")}
            />
          </button>
          <div
            className="topbar-settings-submenu"
            onPointerEnter={() => setExportOpen(true)}
            onPointerLeave={() => {
              setExportOpen(false);
              setTaskExportOpen(false);
            }}
          >
            <button
              type="button"
              className="topbar-settings-submenu-trigger"
              onClick={() => setExportOpen((open) => !open)}
            >
              <MenuItemContent icon="export" label="Export" submenu />
            </button>
            {exportOpen ? (
              <div className="topbar-settings-menu topbar-settings-submenu-panel">
                <button type="button" onClick={onExportCanvasImage}>
                  <MenuItemContent
                    {...getMenuActionContentProps(shortcutBindings, "exportCanvasImage")}
                  />
                </button>
                <button type="button" onClick={onExportGroupImages}>
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
                          {...getMenuActionContentProps(
                            shortcutBindings,
                            "exportAllTasksHtml",
                          )}
                        />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="topbar-settings-divider" />
          <button type="button" onClick={onResetView}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "resetView")} />
          </button>
          <button type="button" onClick={onChangeCanvasSize}>
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "changeCanvasSize")}
            />
          </button>
          <button type="button" onClick={onToggleCanvasLock}>
            <MenuItemContent
              icon="lock"
              label={canvasLocked ? "Unlock Canvas" : "Lock Canvas"}
              shortcut={getMenuActionContentProps(
                shortcutBindings,
                "toggleCanvasLock",
              ).shortcut}
            />
          </button>

          <div className="topbar-settings-divider" />
          <button type="button" onClick={onCreateGroup}>
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "createGroup")}
            />
          </button>
          <button
            type="button"
            onClick={onDeleteCurrentGroup}
            disabled={!canDeleteActiveGroup}
          >
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "deleteCurrentGroup")}
            />
          </button>
          <button type="button" onClick={onTaskClick}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "addTask")} />
          </button>

          <div className="topbar-settings-divider" />
          <div
            className="topbar-settings-submenu"
            onPointerEnter={() => setArrangeOpen(true)}
            onPointerLeave={() => setArrangeOpen(false)}
          >
            <button
              type="button"
              className="topbar-settings-submenu-trigger"
              onClick={() => setArrangeOpen((open) => !open)}
            >
              <MenuItemContent icon="arrange" label="Arrange" submenu />
            </button>
            {arrangeOpen ? (
              <div className="topbar-settings-menu topbar-settings-submenu-panel">
                <button type="button" onClick={onAutoArrange}>
                  <MenuItemContent
                    {...getMenuActionContentProps(shortcutBindings, "autoArrange")}
                  />
                </button>
              </div>
            ) : null}
          </div>

          <div className="topbar-settings-divider" />
          <button type="button" onClick={onShowBackgroundColor}>
            <MenuItemContent
              {...getMenuActionContentProps(
                shortcutBindings,
                "changeBackgroundColor",
              )}
            />
          </button>
          <div
            className="topbar-settings-submenu"
            onPointerEnter={() => setFilterOpen(true)}
            onPointerLeave={() => setFilterOpen(false)}
          >
            <button
              type="button"
              className="topbar-settings-submenu-trigger"
              onClick={() => setFilterOpen((open) => !open)}
            >
              <MenuItemContent icon="filter" label="Filter" submenu />
            </button>
            {filterOpen ? (
              <div className="topbar-settings-menu topbar-settings-submenu-panel">
                <button type="button" onClick={onToggleBlackAndWhite}>
                  <MenuItemContent
                    {...getMenuActionContentProps(
                      shortcutBindings,
                      "filterBlackAndWhite",
                    )}
                  />
                </button>
                <button type="button" onClick={onToggleBlur}>
                  <MenuItemContent
                    {...getMenuActionContentProps(shortcutBindings, "filterBlur")}
                  />
                </button>
              </div>
            ) : null}
          </div>

          <div className="topbar-settings-divider" />
          <button type="button" onClick={onActivateDoodle}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "doodle")} />
          </button>

          <div className="topbar-settings-divider" />
          <button type="button" onClick={onShowShortcuts}>
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "keyboardShortcut")}
            />
          </button>
          <button type="button" disabled={!canPaste} onClick={onPaste}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "paste")} />
          </button>

          {selectedCount > 0 ? (
            <>
              <div className="topbar-settings-divider" />
              <button
                type="button"
                onClick={onCropSelected}
                disabled={!canCropSelected}
              >
                <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "crop")} />
              </button>
              <button type="button" onClick={onFlipSelectedHorizontally}>
                <MenuItemContent
                  {...getMenuActionContentProps(shortcutBindings, "flipHorizontal")}
                />
              </button>
            </>
          ) : null}

          <div className="topbar-settings-divider" />
          <button type="button" onClick={onExit}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "exit")} />
          </button>
        </div>
      ) : null}
    </div>
  );
};
