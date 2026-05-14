import { useLayoutEffect, useRef, useState } from "react";
import type { ShortcutBindings } from "@shared/shortcuts";
import type { MenuState } from "@renderer/app/types";
import { MenuItemContent } from "@renderer/app/components/MenuItemContent";
import { AppMenuCanvasSection } from "@renderer/app/components/AppMenuCanvasSection";
import { AppMenuEditSection } from "@renderer/app/components/AppMenuEditSection";
import { AppMenuFileSection } from "@renderer/app/components/AppMenuFileSection";
import { AppMenuTaskSection } from "@renderer/app/components/AppMenuTaskSection";

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
  onImportTasks: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  canvasLocked: boolean;
  onToggleBlur: () => void;
  onToggleBlackAndWhite: () => void;
  onActivateDoodle: () => void;
  onShowBackgroundColor: () => void;
  onChangeCanvasSize: () => void;
  onToggleCanvasLock: () => void;
  onToggleSwatches: () => void;
  onResetView: () => void;
  onFitCanvasToContent: () => void;
  onCreateGroup: () => void;
  onDeleteCurrentGroup: () => void;
  onCreateTask: () => void;
  onAutoArrange: () => void;
  onExportCanvasImage: () => void;
  onExportGroupImages: () => void;
  onExportSelectedTaskHtml: () => void;
  onExportAllTasksHtml: () => void;
  onExportSelectedTaskTxt: () => void;
  onExportAllTasksTxt: () => void;
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
  onImportTasks,
  onSave,
  onSaveAs,
  canvasLocked,
  onToggleBlur,
  onToggleBlackAndWhite,
  onActivateDoodle,
  onShowBackgroundColor,
  onChangeCanvasSize,
  onToggleCanvasLock,
  onToggleSwatches,
  onResetView,
  onFitCanvasToContent,
  onCreateGroup,
  onDeleteCurrentGroup,
  onCreateTask,
  onAutoArrange,
  onExportCanvasImage,
  onExportGroupImages,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onExportSelectedTaskTxt,
  onExportAllTasksTxt,
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
        <AppMenuEditSection
          shortcutBindings={shortcutBindings}
          canvasLocked={canvasLocked}
          selectedCount={selectedCount}
          canCropSelected={canCropSelected}
          canExportSwatch={canExportSwatch}
          canPaste={canPaste}
          canUndo={canUndo}
          canRedo={canRedo}
          onCopySelected={onCopySelected}
          onCutSelected={onCutSelected}
          onPaste={onPaste}
          onArrangeSelectedAuto={onArrangeSelectedAuto}
          onCropSelected={onCropSelected}
          onFlipSelectedHorizontally={onFlipSelectedHorizontally}
          onDeleteSelected={onDeleteSelected}
          onExportSwatch={onExportSwatch}
          onUndo={onUndo}
          onRedo={onRedo}
          mode="selection"
        />
      ) : (
        <>
          <AppMenuFileSection
            shortcutBindings={shortcutBindings}
            canExportSelectedTask={canExportSelectedTask}
            canExportAnyTask={canExportAnyTask}
            onOpen={onOpen}
            onSave={onSave}
            onSaveAs={onSaveAs}
            onImportTasks={onImportTasks}
            onExportCanvasImage={onExportCanvasImage}
            onExportGroupImages={onExportGroupImages}
            onExportSelectedTaskHtml={onExportSelectedTaskHtml}
            onExportAllTasksHtml={onExportAllTasksHtml}
            onExportSelectedTaskTxt={onExportSelectedTaskTxt}
            onExportAllTasksTxt={onExportAllTasksTxt}
            onExit={onExit}
          />
          <div className="app-menu-divider" />
          <AppMenuCanvasSection
            shortcutBindings={shortcutBindings}
            canvasLocked={canvasLocked}
            canDeleteActiveGroup={canDeleteActiveGroup}
            onResetView={onResetView}
            onFitCanvasToContent={onFitCanvasToContent}
            onChangeCanvasSize={onChangeCanvasSize}
            onToggleSwatches={onToggleSwatches}
            onToggleCanvasLock={onToggleCanvasLock}
            onCreateGroup={onCreateGroup}
            onDeleteCurrentGroup={onDeleteCurrentGroup}
            onAutoArrange={onAutoArrange}
            onShowBackgroundColor={onShowBackgroundColor}
            onToggleBlackAndWhite={onToggleBlackAndWhite}
            onToggleBlur={onToggleBlur}
            onActivateDoodle={onActivateDoodle}
          />
          <div className="app-menu-divider" />
          <AppMenuTaskSection
            shortcutBindings={shortcutBindings}
            canvasLocked={canvasLocked}
            canExportSelectedTask={canExportSelectedTask}
            canExportAnyTask={canExportAnyTask}
            onCreateTask={onCreateTask}
            onExportSelectedTaskHtml={onExportSelectedTaskHtml}
            onExportAllTasksHtml={onExportAllTasksHtml}
            onExportSelectedTaskTxt={onExportSelectedTaskTxt}
            onExportAllTasksTxt={onExportAllTasksTxt}
            mode="main"
          />
          <div className="app-menu-divider" />
          <AppMenuEditSection
            shortcutBindings={shortcutBindings}
            canvasLocked={canvasLocked}
            selectedCount={selectedCount}
            canCropSelected={canCropSelected}
            canExportSwatch={canExportSwatch}
            canPaste={canPaste}
            canUndo={canUndo}
            canRedo={canRedo}
            onCopySelected={onCopySelected}
            onCutSelected={onCutSelected}
            onPaste={onPaste}
            onArrangeSelectedAuto={onArrangeSelectedAuto}
            onCropSelected={onCropSelected}
            onFlipSelectedHorizontally={onFlipSelectedHorizontally}
            onDeleteSelected={onDeleteSelected}
            onExportSwatch={onExportSwatch}
            onUndo={onUndo}
            onRedo={onRedo}
            mode="general"
          />
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
