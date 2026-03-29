import { useState } from "react";
import type { MenuState } from "@renderer/app/types";

interface AppMenuProps extends MenuState {
  selectedCount: number;
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
  onArrangePinterest: () => void;
  onArrangeHorizontal: () => void;
  onExportSwatch: () => void;
}

export const AppMenu = ({
  x,
  y,
  selectedCount,
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
  onArrangePinterest,
  onArrangeHorizontal,
  onExportSwatch,
}: AppMenuProps) => {
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [taskExportOpen, setTaskExportOpen] = useState(false);

  return (
    <div
      className="app-menu"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {selectedCount > 0 ? (
        <>
          <button type="button" onClick={onCopySelected}>
            Copy
          </button>
          <button type="button" onClick={onCutSelected}>
            Cut
          </button>
          <button type="button" onClick={onPaste} disabled={!canPaste}>
            Paste
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
              <span>Arrange</span>
              <span className="app-menu-submenu-arrow">›</span>
            </button>
            {arrangeOpen ? (
              <div className="app-menu app-menu-submenu-panel">
                <button type="button" onClick={onArrangePinterest}>
                  Pinterest
                </button>
                <button type="button" onClick={onArrangeHorizontal}>
                  Horizontal
                </button>
              </div>
            ) : null}
          </div>
          <div className="app-menu-divider" />
          <button type="button" onClick={onDeleteSelected}>
            Delete
          </button>
          <div className="app-menu-divider" />
          <button
            type="button"
            onClick={onExportSwatch}
            disabled={!canExportSwatch}
          >
            Export Swatches
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onUndo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo}>
            Redo
          </button>
          {canPaste ? (
            <button type="button" onClick={onPaste}>
              Paste
            </button>
          ) : null}
          <div className="app-menu-divider" />
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
              <span>Export</span>
              <span className="app-menu-submenu-arrow">›</span>
            </button>
            {exportOpen ? (
              <div className="app-menu app-menu-submenu-panel">
                <button type="button" onClick={onExportCanvasImage}>
                  Export Canvas to Images
                </button>
                <button type="button" onClick={onExportGroupImages}>
                  Export Every Image to Folder
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
                    <span>Export Tasks</span>
                    <span className="app-menu-submenu-arrow">›</span>
                  </button>
                  {taskExportOpen ? (
                    <div className="app-menu app-menu-submenu-panel">
                      <button
                        type="button"
                        onClick={onExportSelectedTaskHtml}
                        disabled={!canExportSelectedTask}
                      >
                        Export Selected Task to HTML
                      </button>
                      <button
                        type="button"
                        onClick={onExportAllTasksHtml}
                        disabled={!canExportAnyTask}
                      >
                        Export All Tasks to HTML
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="app-menu-divider" />
          <button type="button" onClick={() => void onOpen()}>
            Open
          </button>
          <button type="button" onClick={() => void onSave()}>
            Save Canvas
          </button>
          <button type="button" onClick={() => void onSaveAs()}>
            Save Canvas As...
          </button>
          <button type="button" onClick={onResetView}>
            Reset View
          </button>
          <button type="button" onClick={onAutoArrange}>
            Auto Arrange
          </button>
          <button type="button" onClick={onCreateGroup}>
            Create Group
          </button>
          <button type="button" onClick={onCreateTask}>
            Add Task
          </button>
          <div className="app-menu-divider" />
        </>
      )}
      <button type="button" onClick={onClose}>
        Close Menu
      </button>
    </div>
  );
};
