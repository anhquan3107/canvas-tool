import { useRef } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { DialogScrim } from "@renderer/ui/DialogScrim";
import { createDialogKeyDownHandler } from "@renderer/ui/dialog-keyboard";
import { useDialogInitialFocus } from "@renderer/ui/use-dialog-initial-focus";
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
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useDialogInitialFocus(dialogRef, open);

  if (!open) {
    return null;
  }

  return (
    <DialogScrim onClose={onCancel}>
      <div
        ref={dialogRef}
        className="dialog-card confirm-action-dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={createDialogKeyDownHandler({
          onClose: onCancel,
          onConfirm,
        })}
        role="dialog"
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
      </div>
    </DialogScrim>
  );
};
