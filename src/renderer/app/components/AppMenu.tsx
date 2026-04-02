import { useLayoutEffect, useRef, useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import type { MenuState } from "@renderer/app/types";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";

interface AppMenuProps extends MenuState {
  shortcutBindings: ShortcutBindings;
  selectedCount: number;
  canCropSelected: boolean;
  canExportSwatch: boolean;
  canPaste: boolean;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  canDeleteActiveGroup: boolean;
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
  onDeleteCurrentGroup: () => void;
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
  onArrangeSelectedAuto: () => void;
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
  canDeleteActiveGroup,
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
  onDeleteCurrentGroup,
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
  onArrangeSelectedAuto,
  onExportSwatch,
  onExit,
}: AppMenuProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
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
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "copy")} />
          </button>
          <button type="button" onClick={onCutSelected}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "cut")} />
          </button>
          <button type="button" onClick={onPaste} disabled={!canPaste}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "paste")} />
          </button>
          <button type="button" onClick={onArrangeSelectedAuto}>
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "autoArrange")}
            />
          </button>
          <div className="app-menu-divider" />
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
          <div className="app-menu-divider" />
          <button type="button" onClick={onDeleteSelected}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "delete")} />
          </button>
          <div className="app-menu-divider" />
          <button
            type="button"
            onClick={onExportSwatch}
            disabled={!canExportSwatch}
          >
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "exportSwatches")}
            />
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => void onOpen()}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "open")} />
          </button>
          <button type="button" onClick={() => void onSave()}>
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "saveCanvas")}
            />
          </button>
          <button type="button" onClick={() => void onSaveAs()}>
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "saveCanvasAs")}
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
                    {...getMenuActionContentProps(shortcutBindings, "exportCanvasImage")}
                  />
                </button>
                <button type="button" onClick={onExportGroupImages}>
                  <MenuItemContent
                    {...getMenuActionContentProps(shortcutBindings, "exportGroupImages")}
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
          <div className="app-menu-divider" />
          <button type="button" onClick={onResetView}>
            <MenuItemContent
              {...getMenuActionContentProps(shortcutBindings, "resetView")}
            />
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
              shortcut={
                getMenuActionContentProps(shortcutBindings, "toggleCanvasLock")
                  .shortcut
              }
            />
          </button>
          <div className="app-menu-divider" />
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
          <button type="button" onClick={onCreateTask}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "addTask")} />
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
                    {...getMenuActionContentProps(shortcutBindings, "autoArrange")}
                  />
                </button>
              </div>
            ) : null}
          </div>
          <div className="app-menu-divider" />
          <button type="button" onClick={onShowBackgroundColor}>
            <MenuItemContent
              {...getMenuActionContentProps(
                shortcutBindings,
                "changeBackgroundColor",
              )}
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
          <div className="app-menu-divider" />
          <button type="button" onClick={onActivateDoodle}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "doodle")} />
          </button>
          <div className="app-menu-divider" />
          <button type="button" onClick={onUndo} disabled={!canUndo}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "undo")} />
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "redo")} />
          </button>
          {canPaste ? (
            <button type="button" onClick={onPaste}>
              <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "paste")} />
            </button>
          ) : null}
          <div className="app-menu-divider" />
          <button type="button" onClick={onExit}>
            <MenuItemContent {...getMenuActionContentProps(shortcutBindings, "exit")} />
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
