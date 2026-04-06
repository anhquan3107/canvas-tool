import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { ReferenceGroup, Task } from "@shared/types/project";

interface UseAppSelectionActionsOptions {
  activeGroup: ReferenceGroup | undefined;
  projectGroups: ReferenceGroup[];
  projectTasks: Task[];
  zoomOverlayOpen: boolean;
  selectTask: (taskId: string | null) => void;
  setActiveGroup: (groupId: string) => void;
  setAppInfoOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedItemIds: Dispatch<SetStateAction<string[]>>;
}

export const useAppSelectionActions = ({
  activeGroup,
  projectGroups,
  projectTasks,
  zoomOverlayOpen,
  selectTask,
  setActiveGroup,
  setAppInfoOpen,
  setSelectedItemIds,
}: UseAppSelectionActionsOptions) => {
  const selectTaskAndActivateLinkedGroup = useCallback(
    (taskId: string | null) => {
      selectTask(taskId);

      if (!taskId) {
        return;
      }

      const task = projectTasks.find((entry) => entry.id === taskId);
      if (!task?.linkedGroupId) {
        return;
      }

      const targetGroup = projectGroups.find(
        (group) => group.id === task.linkedGroupId,
      );
      if (!targetGroup) {
        return;
      }

      setActiveGroup(targetGroup.id);
      setSelectedItemIds([]);
    },
    [projectGroups, projectTasks, selectTask, setActiveGroup, setSelectedItemIds],
  );

  const handleCanvasSelectionChange = useCallback(
    (itemIds: string[]) => {
      if (itemIds.length > 0) {
        setAppInfoOpen(false);
      }

      setSelectedItemIds(itemIds);
    },
    [setAppInfoOpen, setSelectedItemIds],
  );

  const handleSelectAllItems = useCallback(() => {
    if (!activeGroup || zoomOverlayOpen) {
      return;
    }

    setAppInfoOpen(false);
    setSelectedItemIds(
      activeGroup.items
        .filter((item) => item.visible !== false)
        .map((item) => item.id),
    );
  }, [activeGroup, setAppInfoOpen, setSelectedItemIds, zoomOverlayOpen]);

  return {
    selectTaskAndActivateLinkedGroup,
    handleCanvasSelectionChange,
    handleSelectAllItems,
  };
};
