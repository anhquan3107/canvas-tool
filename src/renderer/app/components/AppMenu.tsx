import type { MenuState } from "@renderer/app/types";

interface AppMenuProps extends MenuState {
  selectedCount: number;
  onClose: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onResetView: () => void;
  onCreateGroup: () => void;
  onCreateTask: () => void;
  onAutoArrange: () => void;
  onCopySelected: () => void;
  onCutSelected: () => void;
  onDeleteSelected: () => void;
  onArrangePinterest: () => void;
  onArrangeHorizontal: () => void;
}

export const AppMenu = ({
  x,
  y,
  selectedCount,
  onClose,
  onOpen,
  onSave,
  onSaveAs,
  onResetView,
  onCreateGroup,
  onCreateTask,
  onAutoArrange,
  onCopySelected,
  onCutSelected,
  onDeleteSelected,
  onArrangePinterest,
  onArrangeHorizontal,
}: AppMenuProps) => (
  <div
    className="app-menu"
    style={{ left: x, top: y }}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    {selectedCount > 0 ? (
      <>
        <button type="button" onClick={() => void onCopySelected()}>
          Copy Selection
        </button>
        <button type="button" onClick={onCutSelected}>
          Cut Selection
        </button>
        <button type="button" onClick={onArrangePinterest}>
          Arrange Pinterest
        </button>
        <button type="button" onClick={onArrangeHorizontal}>
          Arrange Horizontal
        </button>
        <button type="button" onClick={onDeleteSelected}>
          Delete Selection
        </button>
        <div className="app-menu-divider" />
      </>
    ) : null}
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
    <button type="button" onClick={onClose}>
      Close Menu
    </button>
  </div>
);
