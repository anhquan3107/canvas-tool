import { useRef, type ReactNode } from "react";
import { DialogScrim } from "@renderer/ui/DialogScrim";
import { useDialogInitialFocus } from "@renderer/ui/use-dialog-initial-focus";
import { useDialogKeyboardShortcuts } from "@renderer/ui/use-dialog-keyboard-shortcuts";

interface DialogFrameProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  className?: string;
}

export const DialogFrame = ({
  title,
  children,
  onClose,
  onConfirm,
  className,
}: DialogFrameProps) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useDialogInitialFocus(dialogRef);
  useDialogKeyboardShortcuts({ onClose, onConfirm });

  return (
    <DialogScrim onClose={onClose}>
      <dialog
        open
        ref={dialogRef}
        className={`dialog-card${className ? ` ${className}` : ""}`}
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="dialog-frame-topbar">
          <span className="dialog-frame-topbar-label">{title}</span>
        </div>
        <div className="dialog-frame-body">{children}</div>
      </dialog>
    </DialogScrim>
  );
};
