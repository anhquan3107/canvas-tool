import { useLayoutEffect, useRef, useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import type { MenuState } from "@renderer/app/types";
import {
  MenuItemContent,
  formatMenuShortcut,
} from "@renderer/app/components/MenuItemContent";

interface AppMenuProps extends MenuState {
  shortcutBindings: ShortcutBindings;
  selectedCount: number;
  canCropSelected: boolean;
  canExportSwatch: boolean;
  canPaste: boolean;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  canvasLocked: boolean;
  onToggleBlur: () => void;
  onToggleBlackAndWhite: () => void;
  onActivateDoodle: () => void;
  onShowBackgroundColor: () => void;
  onChangeCanvasSize: () => void;
  onToggleCanvasLock: () => void;
  onResetView: () => void;
  onCreateGroup: () => void;
  onCreateTask: () => void;
  onAutoArrange: () => void;
  onExportCanvasImage: () => void;
  onExportGroupImages: () => void;
  onExportSelectedTaskHtml: () => void;
  onExportAllTasksHtml: () => void;
  onCopySelected: () => void;
  onCutSelected: () => void;
  onPaste: () => void;
  onDeleteSelected: () => void;
  onCropSelected: () => void;
  onFlipSelectedHorizontally: () => void;
  onArrangePinterest: () => void;
  onArrangeHorizontal: () => void;
  onExportSwatch: () => void;
  onExit: () => void;
}

export const AppMenu = ({
  x,
  y,
  shortcutBindings,
  selectedCount,
  canCropSelected,
  canExportSwatch,
  canPaste,
  canExportSelectedTask,
  canExportAnyTask,
  canUndo,
  canRedo,
  onClose,
  onUndo,
  onRedo,
  onOpen,
  onSave,
  onSaveAs,
  canvasLocked,
  onToggleBlur,
  onToggleBlackAndWhite,
  onActivateDoodle,
  onShowBackgroundColor,
  onChangeCanvasSize,
  onToggleCanvasLock,
  onResetView,
  onCreateGroup,
  onCreateTask,
  onAutoArrange,
  onExportCanvasImage,
  onExportGroupImages,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onCopySelected,
  onCutSelected,
  onPaste,
  onDeleteSelected,
  onCropSelected,
  onFlipSelectedHorizontally,
  onArrangePinterest,
  onArrangeHorizontal,
  onExportSwatch,
  onExit,
}: AppMenuProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [taskExportOpen, setTaskExportOpen] = useState(false);
  const [canvasArrangeOpen, setCanvasArrangeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [placement, setPlacement] = useState<{
    left: number;
    top: number;
    horizontal: "left" | "right";
    vertical: "up" | "down";
  } | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8;
    const horizontal =
      x > viewportWidth * 0.5 || x + rect.width > viewportWidth - margin
        ? "left"
        : "right";
    const vertical =
      y > viewportHeight * 0.5 || y + rect.height > viewportHeight - margin
        ? "up"
        : "down";

    const unclampedLeft = horizontal === "left" ? x - rect.width : x;
    const unclampedTop = vertical === "up" ? y - rect.height : y;

    setPlacement({
      left: Math.min(
        viewportWidth - rect.width - margin,
        Math.max(margin, unclampedLeft),
      ),
      top: Math.min(
        viewportHeight - rect.height - margin,
        Math.max(margin, unclampedTop),
      ),
      horizontal,
      vertical,
    });
  }, [x, y, selectedCount, canPaste, canExportSelectedTask, canExportAnyTask]);

  return (
    <div
      ref={menuRef}
      className="app-menu"
      data-horizontal={placement?.horizontal ?? "right"}
      data-vertical={placement?.vertical ?? "down"}
      style={{
        left: placement?.left ?? x,
        top: placement?.top ?? y,
        visibility: placement ? "visible" : "hidden",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {selectedCount > 0 ? (
        <>
          <button type="button" onClick={onCopySelected}>
            <MenuItemContent
              icon="copy"
              label="Copy"
              shortcut={formatMenuShortcut(shortcutBindings, "edit.copy")}
            />
          </button>
          <button type="button" onClick={onCutSelected}>
            <MenuItemContent
              icon="cut"
              label="Cut"
              shortcut={formatMenuShortcut(shortcutBindings, "edit.cut")}
            />
          </button>
          <button type="button" onClick={onPaste} disabled={!canPaste}>
            <MenuItemContent
              icon="paste"
              label="Paste"
              shortcut={formatMenuShortcut(shortcutBindings, "edit.paste")}
            />
          </button>
          <div
            className="app-menu-submenu"
            onPointerEnter={() => setArrangeOpen(true)}
            onPointerLeave={() => setArrangeOpen(false)}
          >
            <button
              type="button"
              className="app-menu-submenu-trigger"
              onClick={() => setArrangeOpen((open) => !open)}
            >
              <MenuItemContent icon="arrange" label="Arrange" submenu />
            </button>
            {arrangeOpen ? (
              <div className="app-menu app-menu-submenu-panel">
                <button type="button" onClick={onArrangePinterest}>
                  <MenuItemContent icon="arrange" label="Pinterest" />
                </button>
                <button type="button" onClick={onArrangeHorizontal}>
                  <MenuItemContent
                    icon="arrange"
                    label="Horizontal"
                    shortcut={formatMenuShortcut(shortcutBindings, "arrange.horizontal")}
                  />
                </button>
              </div>
            ) : null}
          </div>
          <div className="app-menu-divider" />
          <button
            type="button"
            onClick={onCropSelected}
            disabled={!canCropSelected}
          >
            <MenuItemContent
              icon="crop"
              label="Crop"
              shortcut={formatMenuShortcut(shortcutBindings, "edit.crop")}
            />
          </button>
          <button type="button" onClick={onFlipSelectedHorizontally}>
            <MenuItemContent
              icon="flip"
              label="Flip Horizontal"
              shortcut={formatMenuShortcut(
                shortcutBindings,
                "edit.flipHorizontal",
              )}
            />
          </button>
          <div className="app-menu-divider" />
          <button type="button" onClick={onDeleteSelected}>
            <MenuItemContent
              icon="delete"
              label="Delete"
              shortcut={formatMenuShortcut(shortcutBindings, "edit.delete")}
            />
          </button>
          <div className="app-menu-divider" />
          <button
            type="button"
            onClick={onExportSwatch}
            disabled={!canExportSwatch}
          >
            <MenuItemContent icon="swatch" label="Export Swatches" />
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => void onOpen()}>
            <MenuItemContent
              icon="open"
              label="Open"
              shortcut={formatMenuShortcut(shortcutBindings, "file.open")}
            />
          </button>
          <button type="button" onClick={() => void onSave()}>
            <MenuItemContent
              icon="save"
              label="Save Canvas"
              shortcut={formatMenuShortcut(shortcutBindings, "file.save")}
            />
          </button>
          <button type="button" onClick={() => void onSaveAs()}>
            <MenuItemContent
              icon="saveAs"
              label="Save Canvas As..."
              shortcut={formatMenuShortcut(shortcutBindings, "file.saveAs")}
            />
          </button>
          <div
            className="app-menu-submenu"
            onPointerEnter={() => setExportOpen(true)}
            onPointerLeave={() => {
              setExportOpen(false);
              setTaskExportOpen(false);
            }}
          >
            <button
              type="button"
              className="app-menu-submenu-trigger"
              onClick={() => setExportOpen((open) => !open)}
            >
              <MenuItemContent icon="export" label="Export" submenu />
            </button>
            {exportOpen ? (
              <div className="app-menu app-menu-submenu-panel">
                <button type="button" onClick={onExportCanvasImage}>
                  <MenuItemContent
                    icon="export"
                    label="Export Canvas to Images"
                    shortcut={formatMenuShortcut(
                      shortcutBindings,
                      "export.canvasImage",
                    )}
                  />
                </button>
                <button type="button" onClick={onExportGroupImages}>
                  <MenuItemContent
                    icon="export"
                    label="Export Every Image to Folder"
                    shortcut={formatMenuShortcut(
                      shortcutBindings,
                      "export.groupImages",
                    )}
                  />
                </button>
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
                          icon="task"
                          label="Export Selected Task to HTML"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={onExportAllTasksHtml}
                        disabled={!canExportAnyTask}
                      >
                        <MenuItemContent
                          icon="task"
                          label="Export All Tasks to HTML"
                          shortcut={formatMenuShortcut(
                            shortcutBindings,
                            "export.allTasks",
                          )}
                        />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="app-menu-divider" />
          <button type="button" onClick={onResetView}>
            <MenuItemContent
              icon="resetView"
              label="Reset View"
              shortcut={formatMenuShortcut(shortcutBindings, "canvas.resetView")}
            />
          </button>
          <button type="button" onClick={onChangeCanvasSize}>
            <MenuItemContent
              icon="canvasSize"
              label="Change Canvas Size..."
              shortcut={formatMenuShortcut(shortcutBindings, "canvas.changeSize")}
            />
          </button>
          <button type="button" onClick={onToggleCanvasLock}>
            <MenuItemContent
              icon="lock"
              label={canvasLocked ? "Unlock Canvas" : "Lock Canvas"}
              shortcut={formatMenuShortcut(shortcutBindings, "canvas.toggleLock")}
            />
          </button>
          <div className="app-menu-divider" />
          <button type="button" onClick={onCreateGroup}>
            <MenuItemContent
              icon="group"
              label="Create Group"
              shortcut={formatMenuShortcut(shortcutBindings, "groups.create")}
            />
          </button>
          <button type="button" onClick={onCreateTask}>
            <MenuItemContent
              icon="task"
              label="Add Task"
              shortcut={formatMenuShortcut(shortcutBindings, "tasks.add")}
            />
          </button>
          <div className="app-menu-divider" />
          <div
            className="app-menu-submenu"
            onPointerEnter={() => setCanvasArrangeOpen(true)}
            onPointerLeave={() => setCanvasArrangeOpen(false)}
          >
            <button
              type="button"
              className="app-menu-submenu-trigger"
              onClick={() => setCanvasArrangeOpen((open) => !open)}
            >
              <MenuItemContent icon="arrange" label="Arrange" submenu />
            </button>
            {canvasArrangeOpen ? (
              <div className="app-menu app-menu-submenu-panel">
                <button type="button" onClick={onAutoArrange}>
                  <MenuItemContent
                    icon="arrange"
                    label="Auto Arrange"
                    shortcut={formatMenuShortcut(shortcutBindings, "arrange.auto")}
                  />
                </button>
              </div>
            ) : null}
          </div>
          <div className="app-menu-divider" />
          <button type="button" onClick={onShowBackgroundColor}>
            <MenuItemContent
              icon="background"
              label="Change Background Color"
            />
          </button>
          <div
            className="app-menu-submenu"
            onPointerEnter={() => setFilterOpen(true)}
            onPointerLeave={() => setFilterOpen(false)}
          >
            <button
              type="button"
              className="app-menu-submenu-trigger"
              onClick={() => setFilterOpen((open) => !open)}
            >
              <MenuItemContent icon="filter" label="Filter" submenu />
            </button>
            {filterOpen ? (
              <div className="app-menu app-menu-submenu-panel">
                <button type="button" onClick={onToggleBlackAndWhite}>
                  <MenuItemContent
                    icon="filter"
                    label="B&W"
                    shortcut={formatMenuShortcut(
                      shortcutBindings,
                      "tools.toggleBlackAndWhite",
                    )}
                  />
                </button>
                <button type="button" onClick={onToggleBlur}>
                  <MenuItemContent
                    icon="filter"
                    label="Blur"
                    shortcut={formatMenuShortcut(shortcutBindings, "tools.toggleBlur")}
                  />
                </button>
              </div>
            ) : null}
          </div>
          <div className="app-menu-divider" />
          <button type="button" onClick={onActivateDoodle}>
            <MenuItemContent
              icon="doodle"
              label="Doodle"
              shortcut={formatMenuShortcut(shortcutBindings, "tools.toggleDoodle")}
            />
          </button>
          <div className="app-menu-divider" />
          <button type="button" onClick={onUndo} disabled={!canUndo}>
            <MenuItemContent
              icon="undo"
              label="Undo"
              shortcut={formatMenuShortcut(shortcutBindings, "edit.undo")}
            />
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo}>
            <MenuItemContent
              icon="redo"
              label="Redo"
              shortcut={formatMenuShortcut(shortcutBindings, "edit.redo")}
            />
          </button>
          {canPaste ? (
            <button type="button" onClick={onPaste}>
              <MenuItemContent
                icon="paste"
                label="Paste"
                shortcut={formatMenuShortcut(shortcutBindings, "edit.paste")}
              />
            </button>
          ) : null}
          <div className="app-menu-divider" />
          <button type="button" onClick={onExit}>
            <MenuItemContent
              icon="exit"
              label="Exit"
              shortcut={formatMenuShortcut(shortcutBindings, "app.quit")}
            />
          </button>
        </>
      )}
      {selectedCount > 0 ? (
        <button type="button" onClick={onClose}>
          <MenuItemContent icon="exit" label="Close Menu" />
        </button>
      ) : null}
    </div>
  );
};
