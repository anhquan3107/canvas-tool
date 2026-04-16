import { useRef, type ReactNode } from "react";
import { DialogScrim } from "@renderer/ui/DialogScrim";
import { createDialogKeyDownHandler } from "@renderer/ui/dialog-keyboard";
import { useDialogInitialFocus } from "@renderer/ui/use-dialog-initial-focus";

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
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useDialogInitialFocus(dialogRef);

  return (
    <DialogScrim onClose={onClose}>
      <div
        ref={dialogRef}
        className={`dialog-card${className ? ` ${className}` : ""}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={createDialogKeyDownHandler({ onClose, onConfirm })}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="dialog-frame-topbar">
          <span className="dialog-frame-topbar-label">{title}</span>
        </div>
        <div className="dialog-frame-body">{children}</div>
      </div>
    </DialogScrim>
  );
};
