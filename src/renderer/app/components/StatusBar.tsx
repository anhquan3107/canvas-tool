import type { ImageItem } from "@shared/types/project";
import {
  getDataUrlByteLength,
  inferImageFormatLabel,
} from "@renderer/features/import/image-import";

interface StatusBarProps {
  selectedCount: number;
  selectedImage: ImageItem | null;
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
  selectedImage,
  groupName,
  zoomLabel,
  canvasLabel,
  snapEnabled,
  autoArrangeEnabled,
  onToggleSnap,
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
      <div className="status-left">
        <span>{selectedCount} selected</span>
        <span>{groupName}</span>
      </div>
      {selectedImage && dimensionLabel ? (
        <div className="status-selection-meta" aria-label="Selected image information">
          <span>{dimensionLabel}</span>
          {fileSizeLabel ? <span className="status-selection-separator">•</span> : null}
          {fileSizeLabel ? <span>{fileSizeLabel}</span> : null}
          {formatLabel ? <span className="status-selection-separator">•</span> : null}
          {formatLabel ? <span>{formatLabel}</span> : null}
        </div>
      ) : (
        <div className="status-selection-meta" />
      )}
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
};
