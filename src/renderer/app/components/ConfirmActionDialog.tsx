import { useRef } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { DialogScrim } from "@renderer/ui/DialogScrim";
import { useDialogInitialFocus } from "@renderer/ui/use-dialog-initial-focus";
import { useDialogKeyboardShortcuts } from "@renderer/ui/use-dialog-keyboard-shortcuts";
import { useI18n } from "@renderer/i18n";

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionDialog = ({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) => {
  const { copy } = useI18n();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useDialogInitialFocus(dialogRef, open);
  useDialogKeyboardShortcuts(
    {
      onClose: onCancel,
      onConfirm,
    },
    open,
  );

  if (!open) {
    return null;
  }

  return (
    <DialogScrim onClose={onCancel}>
      <dialog
        open
        ref={dialogRef}
        className="dialog-card confirm-action-dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="dialog-frame-topbar">
          <span className="dialog-frame-topbar-label">{title}</span>
        </div>

        <div className="dialog-frame-body confirm-action-dialog-body">
          <div className="confirm-action-dialog-hero">
            <div className="confirm-action-dialog-badge" aria-hidden="true">
              <Trash2 size={15} strokeWidth={2} />
            </div>
            <span className="confirm-action-dialog-eyebrow">
              <AlertTriangle size={11} strokeWidth={2.2} />
              {copy.dialogs.confirmDeletion}
            </span>
          </div>

          <p className="confirm-action-dialog-copy">{message}</p>
          <p className="confirm-action-dialog-note">
            {copy.dialogs.deletionNote}
          </p>

          <div className="confirm-action-dialog-actions">
            <button
              type="button"
              className="dialog-button dialog-button-danger"
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
            <button type="button" className="dialog-button" onClick={onCancel}>
              {copy.common.keepIt}
            </button>
          </div>
        </div>
      </dialog>
    </DialogScrim>
  );
};
