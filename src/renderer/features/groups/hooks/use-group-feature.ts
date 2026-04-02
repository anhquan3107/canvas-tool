import { useCallback, useState } from "react";

interface UseGroupFeatureOptions {
  groupCount: number;
  addGroup: (name: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  onCreateGroupSuccess: () => void;
  setSelectedItemIds: (itemIds: string[]) => void;
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
}

export const useGroupFeature = ({
  groupCount,
  addGroup,
  renameGroup,
  onCreateGroupSuccess,
  setSelectedItemIds,
  pushToast,
}: UseGroupFeatureOptions) => {
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [draftGroupName, setDraftGroupName] = useState("Group 1");
  const [editingGroup, setEditingGroup] = useState<{
    id: string;
    currentName: string;
  } | null>(null);

  const openGroupDialog = useCallback(() => {
    setEditingGroup(null);
    setDraftGroupName(`Group ${groupCount + 1}`);
    setGroupDialogOpen(true);
  }, [groupCount]);

  const openRenameGroupDialog = useCallback((groupId: string, currentName: string) => {
    setEditingGroup({ id: groupId, currentName });
    setDraftGroupName(currentName);
    setGroupDialogOpen(true);
  }, []);

  const handleCreateGroup = useCallback(() => {
    const fallbackName = editingGroup?.currentName || `Group ${groupCount + 1}`;
    const name = draftGroupName.trim() || fallbackName;

    if (editingGroup) {
      renameGroup(editingGroup.id, name);
      setGroupDialogOpen(false);
      setEditingGroup(null);
      pushToast("success", `Renamed group to ${name}.`);
      return;
    }

    addGroup(name);
    setSelectedItemIds([]);
    setGroupDialogOpen(false);
    onCreateGroupSuccess();
    pushToast("success", `Saved current canvas as ${name}.`);
  }, [
    addGroup,
    draftGroupName,
    editingGroup,
    groupCount,
    onCreateGroupSuccess,
    pushToast,
    renameGroup,
    setSelectedItemIds,
  ]);

  const closeGroupDialog = useCallback(() => {
    setGroupDialogOpen(false);
    setEditingGroup(null);
  }, []);

  return {
    groupDialogOpen,
    draftGroupName,
    editingGroup,
    setGroupDialogOpen,
    setDraftGroupName,
    openGroupDialog,
    openRenameGroupDialog,
    handleCreateGroup,
    closeGroupDialog,
  };
};
