interface StatusBarProps {
  selectedCount: number;
  groupName: string;
  zoomLabel: string;
  canvasLabel: string;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onAutoArrange: () => void;
}

export const StatusBar = ({
  selectedCount,
  groupName,
  zoomLabel,
  canvasLabel,
  snapEnabled,
  onToggleSnap,
  onAutoArrange,
}: StatusBarProps) => (
  <footer className="status-bar">
    <div className="status-left">
      <span>{selectedCount} selected</span>
      <span>{groupName}</span>
    </div>
    <div className="status-right">
      <button type="button" className="status-button" onClick={onToggleSnap}>
        Snap: {snapEnabled ? "On" : "Off"}
      </button>
      <button type="button" className="status-button" onClick={onAutoArrange}>
        Auto Arrange
      </button>
      <span>Zoom: {zoomLabel}</span>
      <span>Canvas: {canvasLabel}</span>
    </div>
  </footer>
);
