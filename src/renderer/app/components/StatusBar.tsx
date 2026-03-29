interface StatusBarProps {
  selectedCount: number;
  groupName: string;
  zoomLabel: string;
  canvasLabel: string;
  snapEnabled: boolean;
  autoArrangeEnabled: boolean;
  onToggleSnap: () => void;
  onToggleAutoArrange: () => void;
}

export const StatusBar = ({
  selectedCount,
  groupName,
  zoomLabel,
  canvasLabel,
  snapEnabled,
  autoArrangeEnabled,
  onToggleSnap,
  onToggleAutoArrange,
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
      <button
        type="button"
        className="status-button"
        onClick={onToggleAutoArrange}
      >
        Auto Arrange: {autoArrangeEnabled ? "On" : "Off"}
      </button>
      <span>Zoom: {zoomLabel}</span>
      <span>Canvas: {canvasLabel}</span>
    </div>
  </footer>
);
