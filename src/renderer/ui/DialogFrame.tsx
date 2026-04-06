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
    >
      <h3>{title}</h3>
      {children}
    </div>
  </DialogScrim>
);
