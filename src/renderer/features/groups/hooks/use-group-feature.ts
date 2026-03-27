import { useCallback, useState } from "react";

interface UseGroupFeatureOptions {
  groupCount: number;
  addGroup: (name: string) => void;
  setSelectedItemIds: (itemIds: string[]) => void;
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
}

export const useGroupFeature = ({
  groupCount,
  addGroup,
  setSelectedItemIds,
  pushToast,
}: UseGroupFeatureOptions) => {
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [draftGroupName, setDraftGroupName] = useState("Group 2");

  const openGroupDialog = useCallback(() => {
    setDraftGroupName(`Group ${groupCount + 1}`);
    setGroupDialogOpen(true);
  }, [groupCount]);

  const handleCreateGroup = useCallback(() => {
    const name = draftGroupName.trim() || `Group ${groupCount + 1}`;
    addGroup(name);
    setSelectedItemIds([]);
    setGroupDialogOpen(false);
    pushToast("success", `Created ${name}.`);
  }, [addGroup, draftGroupName, groupCount, pushToast, setSelectedItemIds]);

  return {
    groupDialogOpen,
    draftGroupName,
    setGroupDialogOpen,
    setDraftGroupName,
    openGroupDialog,
    handleCreateGroup,
  };
};
