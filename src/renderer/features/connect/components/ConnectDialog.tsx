import { useRef } from "react";
import { DialogFrame } from "@renderer/ui/DialogFrame";
import { createDialogKeyDownHandler } from "@renderer/ui/dialog-keyboard";
import { useI18n } from "@renderer/i18n";
import { useDialogInitialFocus } from "@renderer/ui/use-dialog-initial-focus";
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
  const { copy } = useI18n();
  const embeddedDialogRef = useRef<HTMLDivElement | null>(null);

  useDialogInitialFocus(embeddedDialogRef, open && embedded);

  if (!open) {
    return null;
  }

  const content = (
    <>
      <div className="connect-dialog-section">
        <p className="connect-dialog-copy">
          {copy.connectDialog.description}
        </p>
      </div>

      <div className="connect-dialog-section">
        <span className="connect-dialog-label">{copy.connectDialog.source}</span>
        <div className="capture-source-grid">
          {loading ? (
            <div className="capture-source-empty">{copy.connectDialog.loadingSources}</div>
          ) : sources.length === 0 ? (
            <div className="capture-source-empty">{copy.connectDialog.noSources}</div>
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
                  <span>
                    {source.kind === "screen"
                      ? copy.connectDialog.sourceKinds.screen
                      : copy.connectDialog.sourceKinds.window}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="connect-dialog-section">
        <span className="connect-dialog-label">{copy.connectDialog.latencyQuality}</span>
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
                {copy.capture.quality[option]}
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
          {copy.connectDialog.connect}
        </button>
        <button type="button" className="dialog-button" onClick={onClose}>
          {copy.common.cancel}
        </button>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div
        ref={embeddedDialogRef}
        className="connect-dialog-embedded"
        onKeyDown={createDialogKeyDownHandler({
          onClose,
          onConfirm: selectedSourceId && !loading ? onConfirm : undefined,
        })}
        tabIndex={-1}
      >
        {content}
      </div>
    );
  }

  return (
    <DialogFrame
      className="connect-dialog-card"
      title={copy.connectDialog.title}
      onClose={onClose}
      onConfirm={selectedSourceId && !loading ? onConfirm : undefined}
    >
      {content}
    </DialogFrame>
  );
};
