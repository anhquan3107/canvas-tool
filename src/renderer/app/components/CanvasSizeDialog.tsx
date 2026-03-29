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
  if (!open) {
    return null;
  }

  return (
    <DialogFrame title="Change Canvas Size" onClose={onClose}>
      <div className="dialog-grid">
        <div className="dialog-field">
          <label htmlFor="canvas-width">Width</label>
          <input
            id="canvas-width"
            type="number"
            min={1}
            step={1}
            value={widthValue}
            onChange={(event) => onWidthChange(event.target.value)}
          />
        </div>

        <div className="dialog-field">
          <label htmlFor="canvas-height">Height</label>
          <input
            id="canvas-height"
            type="number"
            min={1}
            step={1}
            value={heightValue}
            onChange={(event) => onHeightChange(event.target.value)}
          />
        </div>
      </div>

      <div className="dialog-actions">
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
    </DialogFrame>
  );
};
