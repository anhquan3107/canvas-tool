import type { ImageItem } from "@shared/types/project";
import {
  getDataUrlByteLength,
  inferImageFormatLabel,
} from "@renderer/features/import/image-import";
import { useI18n } from "@renderer/i18n";

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
  const { copy } = useI18n();
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
        <div className="status-pill status-pill-count">
          {copy.statusBar.selected(selectedCount)}
        </div>
        {selectedImage && dimensionLabel ? (
          <div
            className="status-pill status-pill-meta"
            aria-label={copy.statusBar.selectedImageInformation}
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
          <span>{copy.statusBar.autoArrange}</span>
        </button>
        <div
          className="status-pill status-pill-metrics"
          aria-label={copy.statusBar.zoomAndCanvas}
        >
          <span className="status-pill-inline-label">{copy.statusBar.zoom}:</span>
          <strong>{zoomLabel}</strong>
          <span className="status-pill-divider" aria-hidden="true" />
          <span className="status-pill-inline-label">{copy.statusBar.canvas}:</span>
          <strong>{canvasLabel}</strong>
        </div>
      </div>
    </footer>
  );
};
