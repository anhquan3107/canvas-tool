import { useCallback, useMemo, useState } from "react";
import type { Task } from "@shared/types/project";
import type { TaskDateRange } from "@renderer/features/tasks/types";
import {
  createDefaultTaskDates,
  getDayCount,
} from "@renderer/features/tasks/utils";

interface UseTaskFeatureOptions {
  tasks: Task[];
  addTask: (
    title: string,
    dates: Pick<Task, "startDate" | "endDate">,
  ) => string;
  removeTask: (taskId: string) => void;
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
}

export const useTaskFeature = ({
  tasks,
  addTask,
  removeTask,
  pushToast,
}: UseTaskFeatureOptions) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskListExpanded, setTaskListExpanded] = useState(false);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [draftTaskTitle, setDraftTaskTitle] = useState("New Task");
  const [taskDates, setTaskDates] = useState<TaskDateRange>(
    createDefaultTaskDates(),
  );

  const orderedTasks = useMemo(
    () => [...tasks].sort((left, right) => left.order - right.order),
    [tasks],
  );

  const selectedTask = useMemo(
    () => orderedTasks.find((task) => task.id === selectedTaskId) ?? null,
    [orderedTasks, selectedTaskId],
  );

  const primaryTask = selectedTask ?? orderedTasks[0] ?? null;

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
    const nextTaskId = addTask(title, taskDates);
    setSelectedTaskId(nextTaskId);
    setTaskListExpanded(false);
    setTaskDetailOpen(true);
    setTaskDialogOpen(false);
    pushToast("success", `Created ${title}.`);
  }, [addTask, draftTaskTitle, pushToast, taskDates, tasks.length]);

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      const task = orderedTasks.find((entry) => entry.id === taskId);
      if (!task) {
        pushToast("info", "Select a task to delete.");
        return;
      }

      const currentIndex = orderedTasks.findIndex((entry) => entry.id === task.id);
      const nextSelectedTask =
        orderedTasks[currentIndex + 1] ??
        orderedTasks[currentIndex - 1] ??
        null;

      removeTask(task.id);
      if (selectedTaskId === task.id) {
        setSelectedTaskId(nextSelectedTask?.id ?? null);
        setTaskDetailOpen(Boolean(nextSelectedTask));
      }
      setTaskListExpanded(false);
      pushToast("success", `Deleted ${task.title}.`);
    },
    [orderedTasks, pushToast, removeTask, selectedTaskId],
  );

  const handleDeleteSelectedTask = useCallback(() => {
    if (!selectedTask) {
      pushToast("info", "Select a task to delete.");
      return;
    }
    handleDeleteTask(selectedTask.id);
  }, [handleDeleteTask, pushToast, selectedTask]);

  return {
    primaryTask,
    selectedTask,
    selectedTaskId,
    orderedTasks,
    taskListExpanded,
    taskDetailOpen,
    taskDialogOpen,
    draftTaskTitle,
    taskDates,
    taskDuration,
    setSelectedTaskId,
    setTaskListExpanded,
    setTaskDetailOpen,
    setTaskDialogOpen,
    setDraftTaskTitle,
    setTaskDates,
    openTaskDialog,
    handleCreateTask,
    handleDeleteTask,
    handleDeleteSelectedTask,
  };
};
