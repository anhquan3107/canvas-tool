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
    <DialogFrame
      className="task-deadline-dialog canvas-size-dialog"
      title="Change Canvas Size"
      onClose={onClose}
    >
      <div className="task-dialog-shell">
        <div className="dialog-field task-dialog-field group-dialog-field">
          <label htmlFor="canvas-width">Canvas width:</label>
          <input
            className="group-dialog-input"
            id="canvas-width"
            type="text"
            inputMode="numeric"
            value={widthValue}
            onChange={(event) => onWidthChange(event.target.value)}
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
            onChange={(event) => onHeightChange(event.target.value)}
          />
        </div>

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
