import type { ImageItem } from "@shared/types/project";
import {
  getDataUrlByteLength,
  inferImageFormatLabel,
} from "@renderer/features/import/image-import";

interface StatusBarProps {
  selectedCount: number;
  selectedImage: ImageItem | null;
  zoomLabel: string;
  canvasLabel: string;
  autoArrangeEnabled: boolean;
  onToggleAutoArrange: () => void;
}

export const StatusBar = ({
  selectedCount,
  selectedImage,
  zoomLabel,
  canvasLabel,
  autoArrangeEnabled,
  onToggleAutoArrange,
}: StatusBarProps) => {
  const fileSizeBytes =
    selectedImage?.fileSizeBytes ?? getDataUrlByteLength(selectedImage?.assetPath);
  const fileSizeLabel =
    typeof fileSizeBytes === "number" && Number.isFinite(fileSizeBytes)
      ? fileSizeBytes >= 1024 * 1024
        ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${(fileSizeBytes / 1024).toFixed(1)} KB`
      : null;
  const formatLabel =
    selectedImage?.format ??
    inferImageFormatLabel(selectedImage?.assetPath) ??
    inferImageFormatLabel(selectedImage?.label);
  const dimensionLabel = selectedImage
    ? `${Math.round(selectedImage.originalWidth ?? selectedImage.width)} x ${Math.round(
        selectedImage.originalHeight ?? selectedImage.height,
      )}`
    : null;

  return (
    <footer className="status-bar">
      <div className="status-right">
        <div className="status-pill status-pill-count">Selected: {selectedCount}</div>
        {selectedImage && dimensionLabel ? (
          <div
            className="status-pill status-pill-meta"
            aria-label="Selected image information"
          >
            <span>{dimensionLabel}</span>
            {fileSizeLabel ? (
              <span className="status-selection-separator">•</span>
            ) : null}
            {fileSizeLabel ? <span>{fileSizeLabel}</span> : null}
            {formatLabel ? (
              <span className="status-selection-separator">•</span>
            ) : null}
            {formatLabel ? <span>{formatLabel}</span> : null}
          </div>
        ) : null}
        <button
          type="button"
          className={`status-toggle ${autoArrangeEnabled ? "is-active" : ""}`}
          onClick={onToggleAutoArrange}
          aria-pressed={autoArrangeEnabled}
        >
          <span className="status-checkbox" aria-hidden="true" />
          <span>Auto Arrange</span>
        </button>
        <div className="status-pill status-pill-metrics" aria-label="Zoom and canvas">
          <span className="status-pill-inline-label">Zoom:</span>
          <strong>{zoomLabel}</strong>
          <span className="status-pill-divider" aria-hidden="true" />
          <span className="status-pill-inline-label">Canvas:</span>
          <strong>{canvasLabel}</strong>
        </div>
      </div>
    </footer>
  );
};
