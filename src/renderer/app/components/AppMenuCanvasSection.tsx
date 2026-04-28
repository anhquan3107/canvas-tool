import { useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";
import { useI18n } from "@renderer/i18n";

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
  const { copy } = useI18n();
  const [canvasArrangeOpen, setCanvasArrangeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const canvasActionsDisabled = canvasLocked;

  return (
    <>
      <button type="button" onClick={onResetView} disabled={canvasActionsDisabled}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "resetView",
            copy.menu.actions,
          )}
        />
      </button>
      <button
        type="button"
        onClick={onFitCanvasToContent}
        disabled={canvasActionsDisabled}
      >
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "fitCanvasToContent",
            copy.menu.actions,
          )}
        />
      </button>
      <button type="button" onClick={onChangeCanvasSize} disabled={canvasActionsDisabled}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "changeCanvasSize",
            copy.menu.actions,
          )}
        />
      </button>
      <button type="button" onClick={onToggleSwatches} disabled={canvasActionsDisabled}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "toggleSwatches",
            copy.menu.actions,
          )}
        />
      </button>
      <button type="button" onClick={onToggleCanvasLock}>
        <MenuItemContent
          icon="lock"
          label={canvasLocked ? copy.menu.unlockCanvas : copy.menu.lockCanvas}
          shortcut={
            getMenuActionContentProps(
              shortcutBindings,
              "toggleCanvasLock",
              copy.menu.actions,
            ).shortcut
          }
        />
      </button>
      <div className="app-menu-divider" />
      <button type="button" onClick={onCreateGroup} disabled={canvasActionsDisabled}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "createGroup",
            copy.menu.actions,
          )}
        />
      </button>
      <button
        type="button"
        onClick={onDeleteCurrentGroup}
        disabled={!canDeleteActiveGroup || canvasActionsDisabled}
      >
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "deleteCurrentGroup",
            copy.menu.actions,
          )}
        />
      </button>
      <div
        className="app-menu-submenu"
        onPointerEnter={() => {
          if (!canvasActionsDisabled) {
            setCanvasArrangeOpen(true);
          }
        }}
        onPointerLeave={() => setCanvasArrangeOpen(false)}
      >
        <button
          type="button"
          className="app-menu-submenu-trigger"
          disabled={canvasActionsDisabled}
          onClick={() => {
            if (!canvasActionsDisabled) {
              setCanvasArrangeOpen(true);
            }
          }}
        >
          <MenuItemContent icon="arrange" label={copy.menu.arrange} submenu />
        </button>
        {canvasArrangeOpen && !canvasActionsDisabled ? (
          <div className="app-menu app-menu-submenu-panel">
            <button type="button" onClick={onAutoArrange}>
              <MenuItemContent
                {...getMenuActionContentProps(
                  shortcutBindings,
                  "autoArrange",
                  copy.menu.actions,
                )}
              />
            </button>
          </div>
        ) : null}
      </div>
      <div className="app-menu-divider" />
      <button type="button" onClick={onShowBackgroundColor} disabled={canvasActionsDisabled}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "changeBackgroundColor",
            copy.menu.actions,
          )}
        />
      </button>
      <div
        className="app-menu-submenu"
        onPointerEnter={() => {
          if (!canvasActionsDisabled) {
            setFilterOpen(true);
          }
        }}
        onPointerLeave={() => setFilterOpen(false)}
      >
        <button
          type="button"
          className="app-menu-submenu-trigger"
          disabled={canvasActionsDisabled}
          onClick={() => {
            if (!canvasActionsDisabled) {
              setFilterOpen(true);
            }
          }}
        >
          <MenuItemContent icon="filter" label={copy.menu.filter} submenu />
        </button>
        {filterOpen && !canvasActionsDisabled ? (
          <div className="app-menu app-menu-submenu-panel">
            <button type="button" onClick={onToggleBlackAndWhite}>
              <MenuItemContent
                {...getMenuActionContentProps(
                  shortcutBindings,
                  "filterBlackAndWhite",
                  copy.menu.actions,
                )}
              />
            </button>
            <button type="button" onClick={onToggleBlur}>
              <MenuItemContent
                {...getMenuActionContentProps(
                  shortcutBindings,
                  "filterBlur",
                  copy.menu.actions,
                )}
              />
            </button>
          </div>
        ) : null}
      </div>
      <div className="app-menu-divider" />
      <button type="button" onClick={onActivateDoodle} disabled={canvasActionsDisabled}>
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "doodle",
            copy.menu.actions,
          )}
        />
      </button>
    </>
  );
};
