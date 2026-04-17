import { DialogFrame } from "@renderer/ui/DialogFrame";

interface ConfirmCloseDialogProps {
  open: boolean;
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const ConfirmCloseDialog = ({
  open,
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: ConfirmCloseDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <DialogFrame title="Save Changes?" onClose={onCancel} onConfirm={onSave}>
      <p className="dialog-copy">
        Save changes to <strong>{fileName}</strong> before closing?
      </p>

      <div className="dialog-actions dialog-actions-triple">
        <button
          type="button"
          className="dialog-button primary"
          onClick={onSave}
        >
          Save
        </button>
        <button type="button" className="dialog-button" onClick={onDiscard}>
          Don&apos;t Save
        </button>
        <button
          type="button"
          className="dialog-button"
          onClick={onCancel}
          data-dialog-autofocus="true"
        >
          Cancel
        </button>
      </div>
    </DialogFrame>
  );
};
