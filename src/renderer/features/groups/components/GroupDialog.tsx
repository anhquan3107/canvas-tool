import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { DialogFrame } from "@renderer/ui/DialogFrame";

interface GroupDialogProps {
  open: boolean;
  draftGroupName: string;
  mode: "create" | "rename";
  onClose: () => void;
  onCreateGroup: () => void;
  onDraftGroupNameChange: Dispatch<SetStateAction<string>>;
}

export const GroupDialog = ({
  open,
  draftGroupName,
  mode,
  onClose,
  onCreateGroup,
  onDraftGroupNameChange,
}: GroupDialogProps) => {
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      nameInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <DialogFrame
      className="task-deadline-dialog group-name-dialog"
      title={mode === "rename" ? "Rename Group" : "Create Group"}
      onClose={onClose}
      onConfirm={onCreateGroup}
    >
      <div className="task-dialog-shell">
      <div className="dialog-field task-dialog-field group-dialog-field">
        <label htmlFor="group-name">Enter group name:</label>
        <input
          ref={nameInputRef}
          className="group-dialog-input"
          id="group-name"
          autoFocus
          value={draftGroupName}
          onChange={(event) => onDraftGroupNameChange(event.target.value)}
        />
      </div>

      <div className="dialog-actions task-dialog-actions">
        <button
          type="button"
          className="dialog-button primary"
          onClick={onCreateGroup}
        >
          {mode === "rename" ? "Rename" : "OK"}
        </button>
        <button type="button" className="dialog-button" onClick={onClose}>
          Cancel
        </button>
      </div>
      </div>
    </DialogFrame>
  );
};
