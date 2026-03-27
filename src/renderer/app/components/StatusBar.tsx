interface StatusBarProps {
  selectedCount: number;
  groupName: string;
  zoomLabel: string;
  canvasLabel: string;
  onDelete: () => void;
  onAutoArrange: () => void;
}

export const StatusBar = ({
  selectedCount,
  groupName,
  zoomLabel,
  canvasLabel,
  onDelete,
  onAutoArrange,
}: StatusBarProps) => (
  <footer className="status-bar">
    <div className="status-left">
      <span>{selectedCount} selected</span>
      <span>{groupName}</span>
    </div>
    <div className="status-right">
      {selectedCount > 0 ? (
        <button type="button" className="status-button danger" onClick={onDelete}>
          Delete
        </button>
      ) : null}
      <button type="button" className="status-button" onClick={onAutoArrange}>
        Auto Arrange
      </button>
      <span>Zoom: {zoomLabel}</span>
      <span>Canvas: {canvasLabel}</span>
    </div>
  </footer>
);
