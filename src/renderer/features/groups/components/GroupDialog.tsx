import type { Dispatch, SetStateAction } from "react";
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
  if (!open) {
    return null;
  }

  return (
    <DialogFrame title={mode === "rename" ? "Rename Group" : "Create Group"} onClose={onClose}>
      <div className="dialog-field">
        <label htmlFor="group-name">Enter group name:</label>
        <input
          id="group-name"
          value={draftGroupName}
          onChange={(event) => onDraftGroupNameChange(event.target.value)}
        />
      </div>

      <div className="dialog-actions compact">
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
    </DialogFrame>
  );
};
