import { DialogFrame } from "@renderer/ui/DialogFrame";
import { useI18n } from "@renderer/i18n";

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
  const { copy } = useI18n();
  if (!open) {
    return null;
  }

  return (
    <DialogFrame
      title={copy.dialogs.saveChangesTitle}
      onClose={onCancel}
      onConfirm={onSave}
    >
      <p className="dialog-copy">
        {copy.dialogs.saveChangesMessage(fileName).split(fileName)[0]}
        <strong>{fileName}</strong>
        {copy.dialogs.saveChangesMessage(fileName).split(fileName)[1] ?? ""}
      </p>

      <div className="dialog-actions dialog-actions-triple">
        <button
          type="button"
          className="dialog-button primary"
          onClick={onSave}
        >
          {copy.common.save}
        </button>
        <button type="button" className="dialog-button" onClick={onDiscard}>
          {copy.dialogs.dontSave}
        </button>
        <button
          type="button"
          className="dialog-button"
          onClick={onCancel}
          data-dialog-autofocus="true"
        >
          {copy.common.cancel}
        </button>
      </div>
    </DialogFrame>
  );
};
