import { useCallback, useMemo, useState } from "react";
import type { Task } from "@shared/types/project";
import type { TaskDateRange } from "@renderer/features/tasks/types";
import {
  createDefaultTaskDates,
  getDayCount,
} from "@renderer/features/tasks/utils";

interface UseTaskFeatureOptions {
  tasks: Task[];
  addTask: (title: string) => void;
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
}

export const useTaskFeature = ({
  tasks,
  addTask,
  pushToast,
}: UseTaskFeatureOptions) => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskOverlayOpen, setTaskOverlayOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [draftTaskTitle, setDraftTaskTitle] = useState("New Task");
  const [taskDates, setTaskDates] = useState<TaskDateRange>(
    createDefaultTaskDates(),
  );

  const activeTask = useMemo(() => {
    if (!tasks.length) {
      return null;
    }

    const selected = tasks.find((task) => task.id === activeTaskId);
    return selected ?? tasks[0];
  }, [tasks, activeTaskId]);

  const taskDuration = useMemo(
    () => getDayCount(taskDates.startDate, taskDates.endDate),
    [taskDates.endDate, taskDates.startDate],
  );

  const openTaskDialog = useCallback(() => {
    setDraftTaskTitle(`New Task ${tasks.length + 1}`);
    setTaskDates(createDefaultTaskDates());
    setTaskDialogOpen(true);
  }, [tasks.length]);

  const handleCreateTask = useCallback(() => {
    const title = draftTaskTitle.trim() || `Task ${tasks.length + 1}`;
    addTask(title);
    setTaskDialogOpen(false);
    pushToast("success", `Created ${title}.`);
  }, [addTask, draftTaskTitle, pushToast, tasks.length]);

  return {
    activeTask,
    activeTaskId,
    activeTaskTodoCount: activeTask?.todos.length ?? 0,
    taskOverlayOpen,
    taskDialogOpen,
    draftTaskTitle,
    taskDates,
    taskDuration,
    setActiveTaskId,
    setTaskOverlayOpen,
    setTaskDialogOpen,
    setDraftTaskTitle,
    setTaskDates,
    openTaskDialog,
    handleCreateTask,
  };
};
