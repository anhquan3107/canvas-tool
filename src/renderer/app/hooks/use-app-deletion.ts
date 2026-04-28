import { useCallback, useState } from "react";
import type { ReferenceGroup, Task } from "@shared/types/project";
import { useI18n } from "@renderer/i18n";

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
  const { copy } = useI18n();
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);

  const requestDeleteSelectedTask = useCallback(() => {
    if (!selectedTask) {
      pushToast("info", copy.toasts.selectTaskToDelete);
      return;
    }

    setPendingDeletion({
      kind: "task",
      taskId: selectedTask.id,
      label: selectedTask.title,
    });
  }, [copy.toasts.selectTaskToDelete, pushToast, selectedTask]);

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
      pushToast("info", copy.toasts.canvasCannotBeDeleted);
      return;
    }

    setPendingDeletion({
      kind: "group",
      groupId: activeGroup.id,
      label: activeGroup.name,
    });
  }, [activeGroup, copy.toasts.canvasCannotBeDeleted, pushToast]);

  const requestDeleteGroupById = useCallback(
    (groupId: string) => {
      const targetGroup = groups.find((group) => group.id === groupId);
      if (!targetGroup) {
        return;
      }

      if (targetGroup.kind !== "group") {
        pushToast("info", copy.toasts.canvasCannotBeDeleted);
        return;
      }

      setPendingDeletion({
        kind: "group",
        groupId: targetGroup.id,
        label: targetGroup.name,
      });
    },
    [copy.toasts.canvasCannotBeDeleted, groups, pushToast],
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
    pushToast("success", copy.toasts.deletedLabel(pendingDeletion.label));
  }, [
    copy.toasts,
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
