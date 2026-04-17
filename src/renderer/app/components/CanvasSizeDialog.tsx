import { useEffect, useRef, useState } from "react";
import { DialogFrame } from "@renderer/ui/DialogFrame";

interface CanvasSizeDialogProps {
  open: boolean;
  widthValue: string;
  heightValue: string;
  onClose: () => void;
  onConfirm: () => void;
  onWidthChange: (value: string) => void;
  onHeightChange: (value: string) => void;
}

export const CanvasSizeDialog = ({
  open,
  widthValue,
  heightValue,
  onClose,
  onConfirm,
  onWidthChange,
  onHeightChange,
}: CanvasSizeDialogProps) => {
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const aspectRatioRef = useRef(1);
  const widthInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const width = Number(widthValue);
    const height = Number(heightValue);
    aspectRatioRef.current =
      Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
        ? width / height
        : 1;
    setMaintainAspectRatio(true);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      widthInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  if (!open) {
    return null;
  }

  const syncHeightFromWidth = (nextWidthValue: string) => {
    const nextWidth = Number(nextWidthValue);
    if (!Number.isFinite(nextWidth) || nextWidth <= 0 || aspectRatioRef.current <= 0) {
      return;
    }

    onHeightChange(String(Math.max(1, Math.round(nextWidth / aspectRatioRef.current))));
  };

  const syncWidthFromHeight = (nextHeightValue: string) => {
    const nextHeight = Number(nextHeightValue);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0 || aspectRatioRef.current <= 0) {
      return;
    }

    onWidthChange(String(Math.max(1, Math.round(nextHeight * aspectRatioRef.current))));
  };

  const handleWidthChange = (nextWidthValue: string) => {
    onWidthChange(nextWidthValue);
    if (maintainAspectRatio) {
      syncHeightFromWidth(nextWidthValue);
    }
  };

  const handleHeightChange = (nextHeightValue: string) => {
    onHeightChange(nextHeightValue);
    if (maintainAspectRatio) {
      syncWidthFromHeight(nextHeightValue);
    }
  };

  const handleMaintainAspectRatioChange = (checked: boolean) => {
    setMaintainAspectRatio(checked);
    if (!checked) {
      return;
    }

    if (widthValue.trim()) {
      syncHeightFromWidth(widthValue);
      return;
    }

    if (heightValue.trim()) {
      syncWidthFromHeight(heightValue);
    }
  };

  return (
    <DialogFrame
      className="task-deadline-dialog canvas-size-dialog"
      title="Change Canvas Size"
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <div className="task-dialog-shell">
        <div className="dialog-field task-dialog-field group-dialog-field">
          <label htmlFor="canvas-width">Canvas width:</label>
          <input
            ref={widthInputRef}
            className="group-dialog-input"
            id="canvas-width"
            type="text"
            autoFocus
            inputMode="numeric"
            value={widthValue}
            onChange={(event) => handleWidthChange(event.target.value)}
          />
        </div>

        <div className="dialog-field task-dialog-field group-dialog-field">
          <label htmlFor="canvas-height">Canvas height:</label>
          <input
            className="group-dialog-input"
            id="canvas-height"
            type="text"
            inputMode="numeric"
            value={heightValue}
            onChange={(event) => handleHeightChange(event.target.value)}
          />
        </div>

        <label className="canvas-size-aspect-toggle">
          <input
            type="checkbox"
            checked={maintainAspectRatio}
            onChange={(event) => handleMaintainAspectRatioChange(event.target.checked)}
          />
          <span className="canvas-size-aspect-toggle-ui" aria-hidden="true" />
          <span>Maintain aspect ratio</span>
        </label>

        <div className="dialog-actions task-dialog-actions">
          <button
            type="button"
            className="dialog-button primary"
            onClick={onConfirm}
          >
            Apply
          </button>
          <button type="button" className="dialog-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </DialogFrame>
  );
};
