import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";

interface AppMenuCanvasSectionProps {
  shortcutBindings: ShortcutBindings;
  canvasLocked: boolean;
  canDeleteActiveGroup: boolean;
  onResetView: () => void;
  onFitCanvasToContent: () => void;
  onChangeCanvasSize: () => void;
  onToggleSwatches: () => void;
  onToggleCanvasLock: () => void;
  onCreateGroup: () => void;
  onDeleteCurrentGroup: () => void;
  onAutoArrange: () => void;
  onShowBackgroundColor: () => void;
  onToggleBlackAndWhite: () => void;
  onToggleBlur: () => void;
  onActivateDoodle: () => void;
}

export const AppMenuCanvasSection = ({
  shortcutBindings,
  canvasLocked,
  canDeleteActiveGroup,
  onResetView,
  onFitCanvasToContent,
  onChangeCanvasSize,
  onToggleSwatches,
  onToggleCanvasLock,
  onCreateGroup,
  onDeleteCurrentGroup,
  onAutoArrange,
  onShowBackgroundColor,
  onToggleBlackAndWhite,
  onToggleBlur,
  onActivateDoodle,
}: AppMenuCanvasSectionProps) => {
  const [canvasArrangeOpen, setCanvasArrangeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={onResetView}>
        <MenuItemContent
          {...getMenuActionContentProps(shortcutBindings, "resetView")}
        />
      </button>
      <button type="button" onClick={onFitCanvasToContent}>
        <MenuItemContent
          {...getMenuActionContentProps(shortcutBindings, "fitCanvasToContent")}
        />
      </button>
      <button type="button" onClick={onChangeCanvasSize}>
        <MenuItemContent
          {...getMenuActionContentProps(shortcutBindings, "changeCanvasSize")}
        />
      </button>
      <button type="button" onClick={onToggleSwatches}>
        <MenuItemContent
          {...getMenuActionContentProps(shortcutBindings, "toggleSwatches")}
        />
      </button>
      <button type="button" onClick={onToggleCanvasLock}>
        <MenuItemContent
          icon="lock"
          label={canvasLocked ? "Unlock Canvas" : "Lock Canvas"}
          shortcut={
            getMenuActionContentProps(shortcutBindings, "toggleCanvasLock").shortcut
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
          {...getMenuActionContentProps(shortcutBindings, "changeBackgroundColor")}
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
    </>
  );
};
