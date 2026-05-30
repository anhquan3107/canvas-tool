import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";
import { useI18n } from "@renderer/i18n";

interface AppMenuEditSectionProps {
  shortcutBindings: ShortcutBindings;
  canvasLocked: boolean;
  selectedCount: number;
  availability: {
    cropSelected: boolean;
    exportSwatch: boolean;
    paste: boolean;
    undo: boolean;
    redo: boolean;
  };
  onCopySelected: () => void;
  onCutSelected: () => void;
  onPaste: () => void;
  onArrangeSelectedAuto: () => void;
  onCropSelected: () => void;
  onFlipSelectedHorizontally: () => void;
  onDeleteSelected: () => void;
  onExportSwatch: () => void;
  onUndo: () => void;
  onRedo: () => void;
  mode: "selection" | "general";
}

export const AppMenuEditSection = ({
  shortcutBindings,
  canvasLocked,
  selectedCount,
  availability,
  onCopySelected,
  onCutSelected,
  onPaste,
  onArrangeSelectedAuto,
  onCropSelected,
  onFlipSelectedHorizontally,
  onDeleteSelected,
  onExportSwatch,
  onUndo,
  onRedo,
  mode,
}: AppMenuEditSectionProps) => {
  const { copy } = useI18n();
  if (mode === "selection") {
    return (
      <>
        <button type="button" onClick={onCopySelected}>
          <MenuItemContent
            {...getMenuActionContentProps(
              shortcutBindings,
              "copy",
              copy.menu.actions,
            )}
          />
        </button>
        <button type="button" onClick={onCutSelected} disabled={canvasLocked}>
          <MenuItemContent
            {...getMenuActionContentProps(
              shortcutBindings,
              "cut",
              copy.menu.actions,
            )}
          />
        </button>
        <button
          type="button"
          onClick={onPaste}
          disabled={!availability.paste || canvasLocked}
        >
          <MenuItemContent
            {...getMenuActionContentProps(
              shortcutBindings,
              "paste",
              copy.menu.actions,
            )}
          />
        </button>
        <button type="button" onClick={onArrangeSelectedAuto} disabled={canvasLocked}>
          <MenuItemContent
            {...getMenuActionContentProps(
              shortcutBindings,
              "autoArrange",
              copy.menu.actions,
            )}
          />
        </button>
        <div className="app-menu-divider" />
        <button
          type="button"
          onClick={onCropSelected}
          disabled={!availability.cropSelected || canvasLocked}
        >
          <MenuItemContent
            {...getMenuActionContentProps(
              shortcutBindings,
              "crop",
              copy.menu.actions,
            )}
          />
        </button>
        <button
          type="button"
          onClick={onFlipSelectedHorizontally}
          disabled={canvasLocked}
        >
          <MenuItemContent
            {...getMenuActionContentProps(
              shortcutBindings,
              "flipHorizontal",
              copy.menu.actions,
            )}
          />
        </button>
        <div className="app-menu-divider" />
        <button type="button" onClick={onDeleteSelected} disabled={canvasLocked}>
          <MenuItemContent
            {...getMenuActionContentProps(
              shortcutBindings,
              "delete",
              copy.menu.actions,
            )}
          />
        </button>
        <div className="app-menu-divider" />
        <button
          type="button"
          onClick={onExportSwatch}
          disabled={!availability.exportSwatch}
        >
          <MenuItemContent
            {...getMenuActionContentProps(
              shortcutBindings,
              "exportSwatches",
              copy.menu.actions,
            )}
          />
        </button>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onUndo}
        disabled={!availability.undo || canvasLocked}
      >
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "undo",
            copy.menu.actions,
          )}
        />
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!availability.redo || canvasLocked}
      >
        <MenuItemContent
          {...getMenuActionContentProps(
            shortcutBindings,
            "redo",
            copy.menu.actions,
          )}
        />
      </button>
      {availability.paste ? (
        <button type="button" onClick={onPaste} disabled={canvasLocked}>
          <MenuItemContent
            {...getMenuActionContentProps(
              shortcutBindings,
              "paste",
              copy.menu.actions,
            )}
          />
        </button>
      ) : null}
      {selectedCount > 0 ? (
        <>
          <div className="app-menu-divider" />
          <button
            type="button"
            onClick={onCropSelected}
            disabled={!availability.cropSelected || canvasLocked}
          >
            <MenuItemContent
              {...getMenuActionContentProps(
                shortcutBindings,
                "crop",
                copy.menu.actions,
              )}
            />
          </button>
          <button
            type="button"
            onClick={onFlipSelectedHorizontally}
            disabled={canvasLocked}
          >
            <MenuItemContent
              {...getMenuActionContentProps(
                shortcutBindings,
                "flipHorizontal",
                copy.menu.actions,
              )}
            />
          </button>
        </>
      ) : null}
    </>
  );
};
