import { AlertTriangle, Trash2 } from "lucide-react";
import { DialogScrim } from "@renderer/ui/DialogScrim";

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
  if (!open) {
    return null;
  }

  return (
    <DialogScrim onClose={onCancel}>
      <div
        className="dialog-card confirm-action-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
              Confirm deletion
            </span>
          </div>

          <p className="confirm-action-dialog-copy">{message}</p>
          <p className="confirm-action-dialog-note">
            This change happens immediately. You can still use Undo if needed.
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
              Keep It
            </button>
          </div>
        </div>
      </div>
    </DialogScrim>
  );
};
