import type { ShortcutBindings } from "@shared/shortcuts";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { getMenuActionContentProps } from "@renderer/app/menu/menu-action-config";

interface AppMenuEditSectionProps {
  shortcutBindings: ShortcutBindings;
  selectedCount: number;
  canCropSelected: boolean;
  canExportSwatch: boolean;
  canPaste: boolean;
  canUndo: boolean;
  canRedo: boolean;
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
  selectedCount,
  canCropSelected,
  canExportSwatch,
  canPaste,
  canUndo,
  canRedo,
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
  if (mode === "selection") {
    return (
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
    );
  }

  return (
    <>
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
      {selectedCount > 0 ? (
        <>
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
        </>
      ) : null}
    </>
  );
};
