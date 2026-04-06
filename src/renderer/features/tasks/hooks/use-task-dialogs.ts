import { useCallback, useMemo, useState } from "react";
import type { Task } from "@shared/types/project";
import type { TaskDateRange } from "@renderer/features/tasks/types";
import {
  createDefaultTaskDates,
  getDayCount,
} from "@renderer/features/tasks/utils";

export const useTaskDialogs = ({
  tasks,
  orderedTasks,
}: {
  tasks: Task[];
  orderedTasks: Task[];
}) => {
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<"create" | "edit" | "rename">(
    "create",
  );
  const [draftTaskTitle, setDraftTaskTitle] = useState("New Task");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDates, setTaskDates] = useState<TaskDateRange>(
    createDefaultTaskDates(),
  );

  const taskDuration = useMemo(
    () => getDayCount(taskDates.startDate, taskDates.endDate),
    [taskDates.endDate, taskDates.startDate],
  );

  const openTaskDialog = useCallback(() => {
    setTaskDialogMode("create");
    setEditingTaskId(null);
    setDraftTaskTitle(`New Task ${tasks.length + 1}`);
    setTaskDates(createDefaultTaskDates());
    setTaskDialogOpen(true);
  }, [tasks.length]);

  const openEditTaskDialog = useCallback(
    (taskId: string) => {
      const task = orderedTasks.find((entry) => entry.id === taskId);
      if (!task) {
        return;
      }

      setTaskDialogMode("edit");
      setEditingTaskId(task.id);
      setDraftTaskTitle(task.title);
      setTaskDates({
        startDate: task.startDate ?? createDefaultTaskDates().startDate,
        endDate: task.endDate ?? createDefaultTaskDates().endDate,
      });
      setTaskDialogOpen(true);
    },
    [orderedTasks],
  );

  const openRenameTaskDialog = useCallback(
    (taskId: string) => {
      const task = orderedTasks.find((entry) => entry.id === taskId);
      if (!task) {
        return;
      }

      setTaskDialogMode("rename");
      setEditingTaskId(task.id);
      setDraftTaskTitle(task.title);
      setTaskDates({
        startDate: task.startDate ?? createDefaultTaskDates().startDate,
        endDate: task.endDate ?? createDefaultTaskDates().endDate,
      });
      setTaskDialogOpen(true);
    },
    [orderedTasks],
  );

  return {
    taskDialogOpen,
    setTaskDialogOpen,
    taskDialogMode,
    setTaskDialogMode,
    draftTaskTitle,
    setDraftTaskTitle,
    editingTaskId,
    setEditingTaskId,
    taskDates,
    setTaskDates,
    taskDuration,
    openTaskDialog,
    openEditTaskDialog,
    openRenameTaskDialog,
  };
};
