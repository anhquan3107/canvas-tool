import { useCallback, useState } from "react";
import type { ReferenceGroup, Task } from "@shared/types/project";

export type PendingDeletion =
  | { kind: "task"; taskId: string; label: string }
  | { kind: "group"; groupId: string; label: string }
  | null;

interface UseAppDeletionOptions {
  activeGroup: ReferenceGroup | undefined;
  groups: ReferenceGroup[];
  tasks: Task[];
  selectedTask: Task | null;
  handleDeleteTask: (taskId: string) => void;
  removeGroup: (groupId: string) => void;
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
  setSelectedItemIds: (itemIds: string[]) => void;
  setGroupsOverlayOpen: (open: boolean) => void;
}

export const useAppDeletion = ({
  activeGroup,
  groups,
  tasks,
  selectedTask,
  handleDeleteTask,
  removeGroup,
  pushToast,
  setSelectedItemIds,
  setGroupsOverlayOpen,
}: UseAppDeletionOptions) => {
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);

  const requestDeleteSelectedTask = useCallback(() => {
    if (!selectedTask) {
      pushToast("info", "Select a task to delete.");
      return;
    }

    setPendingDeletion({
      kind: "task",
      taskId: selectedTask.id,
      label: selectedTask.title,
    });
  }, [pushToast, selectedTask]);

  const requestDeleteTaskById = useCallback(
    (taskId: string) => {
      const task = tasks.find((entry) => entry.id === taskId);
      if (!task) {
        return;
      }

      setPendingDeletion({
        kind: "task",
        taskId: task.id,
        label: task.title,
      });
    },
    [tasks],
  );

  const requestDeleteCurrentGroup = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    if (activeGroup.kind !== "group") {
      pushToast("info", "Canvas cannot be deleted.");
      return;
    }

    setPendingDeletion({
      kind: "group",
      groupId: activeGroup.id,
      label: activeGroup.name,
    });
  }, [activeGroup, pushToast]);

  const requestDeleteGroupById = useCallback(
    (groupId: string) => {
      const targetGroup = groups.find((group) => group.id === groupId);
      if (!targetGroup) {
        return;
      }

      if (targetGroup.kind !== "group") {
        pushToast("info", "Canvas cannot be deleted.");
        return;
      }

      setPendingDeletion({
        kind: "group",
        groupId: targetGroup.id,
        label: targetGroup.name,
      });
    },
    [groups, pushToast],
  );

  const handleConfirmDeletion = useCallback(() => {
    if (!pendingDeletion) {
      return;
    }

    if (pendingDeletion.kind === "task") {
      handleDeleteTask(pendingDeletion.taskId);
      setPendingDeletion(null);
      return;
    }

    removeGroup(pendingDeletion.groupId);
    setSelectedItemIds([]);
    setGroupsOverlayOpen(false);
    setPendingDeletion(null);
    pushToast("success", `Deleted ${pendingDeletion.label}.`);
  }, [
    handleDeleteTask,
    pendingDeletion,
    pushToast,
    removeGroup,
    setGroupsOverlayOpen,
    setSelectedItemIds,
  ]);

  return {
    handleConfirmDeletion,
    pendingDeletion,
    requestDeleteCurrentGroup,
    requestDeleteGroupById,
    requestDeleteSelectedTask,
    requestDeleteTaskById,
    setPendingDeletion,
  };
};
