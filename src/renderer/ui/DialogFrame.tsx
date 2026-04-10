import type { ReactNode } from "react";
import { DialogScrim } from "@renderer/ui/DialogScrim";

interface DialogFrameProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}

export const DialogFrame = ({
  title,
  children,
  onClose,
  className,
}: DialogFrameProps) => (
  <DialogScrim onClose={onClose}>
    <div
      className={`dialog-card${className ? ` ${className}` : ""}`}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="dialog-frame-topbar">
        <span className="dialog-frame-topbar-label">{title}</span>
      </div>
      <div className="dialog-frame-body">{children}</div>
    </div>
  </DialogScrim>
);
