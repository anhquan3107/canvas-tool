import { DialogFrame } from "@renderer/ui/DialogFrame";
import type { CaptureQuality, CaptureSource } from "@renderer/features/connect/types";
import { CAPTURE_QUALITY_PROFILES } from "@renderer/features/connect/utils";

interface ConnectDialogProps {
  open: boolean;
  embedded?: boolean;
  loading: boolean;
  sources: CaptureSource[];
  selectedSourceId: string | null;
  quality: CaptureQuality;
  onClose: () => void;
  onSelectSource: (sourceId: string) => void;
  onQualityChange: (quality: CaptureQuality) => void;
  onConfirm: () => void;
}

export const ConnectDialog = ({
  open,
  embedded = false,
  loading,
  sources,
  selectedSourceId,
  quality,
  onClose,
  onSelectSource,
  onQualityChange,
  onConfirm,
}: ConnectDialogProps) => {
  if (!open) {
    return null;
  }

  const content = (
    <>
      <div className="connect-dialog-section">
        <p className="connect-dialog-copy">
          Capture a window or screen into the canvas. Blur and B&amp;W filters stay
          available on the board after connection.
        </p>
      </div>

      <div className="connect-dialog-section">
        <span className="connect-dialog-label">Source</span>
        <div className="capture-source-grid">
          {loading ? (
            <div className="capture-source-empty">Loading windows and screens...</div>
          ) : sources.length === 0 ? (
            <div className="capture-source-empty">
              No capturable sources found. On macOS, make sure Screen Recording is
              allowed for the app.
            </div>
          ) : (
            sources.map((source) => (
              <button
                key={source.id}
                type="button"
                className={`capture-source-card ${
                  source.id === selectedSourceId ? "active" : ""
                }`}
                onClick={() => onSelectSource(source.id)}
              >
                <div className="capture-source-preview">
                  {source.thumbnailDataUrl ? (
                    <img src={source.thumbnailDataUrl} alt={source.name} />
                  ) : (
                    <div className="capture-source-fallback">{source.kind}</div>
                  )}
                </div>
                <div className="capture-source-meta">
                  <strong>{source.name}</strong>
                  <span>{source.kind === "screen" ? "Display" : "Window"}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="connect-dialog-section">
        <span className="connect-dialog-label">Latency / Quality</span>
        <div className="capture-quality-row">
          {(Object.keys(CAPTURE_QUALITY_PROFILES) as CaptureQuality[]).map(
            (option) => (
              <button
                key={option}
                type="button"
                className={`capture-quality-chip ${
                  option === quality ? "active" : ""
                }`}
                onClick={() => onQualityChange(option)}
              >
                {CAPTURE_QUALITY_PROFILES[option].label}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="dialog-actions">
        <button
          type="button"
          className="dialog-button primary"
          onClick={onConfirm}
          disabled={!selectedSourceId || loading}
        >
          Connect
        </button>
        <button type="button" className="dialog-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  );

  if (embedded) {
    return <div className="connect-dialog-embedded">{content}</div>;
  }

  return (
    <DialogFrame
      className="connect-dialog-card"
      title="Connect Capture"
      onClose={onClose}
    >
      {content}
    </DialogFrame>
  );
};
