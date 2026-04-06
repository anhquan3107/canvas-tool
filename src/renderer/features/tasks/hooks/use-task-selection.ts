import { useCallback, useMemo, useState } from "react";
import type { Task } from "@shared/types/project";

export const useTaskSelection = ({ tasks }: { tasks: Task[] }) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [exportSelectedTaskId, setExportSelectedTaskId] = useState<string | null>(null);
  const [taskListExpanded, setTaskListExpanded] = useState(false);
  const [taskCreationPreviewActive, setTaskCreationPreviewActive] = useState(false);
  const [pendingTaskSelectionDismissal, setPendingTaskSelectionDismissal] =
    useState(false);

  const orderedTasks = useMemo(
    () => [...tasks].sort((left, right) => left.order - right.order),
    [tasks],
  );

  const selectedTask = useMemo(
    () => orderedTasks.find((task) => task.id === selectedTaskId) ?? null,
    [orderedTasks, selectedTaskId],
  );

  const exportSelectedTask = useMemo(
    () => orderedTasks.find((task) => task.id === exportSelectedTaskId) ?? null,
    [exportSelectedTaskId, orderedTasks],
  );

  const primaryTask =
    taskListExpanded || pendingTaskSelectionDismissal
      ? orderedTasks[0] ?? null
      : selectedTask ?? orderedTasks[0] ?? null;

  const collapseTaskList = useCallback(() => {
    setTaskListExpanded(false);
    setTaskCreationPreviewActive(false);
  }, []);

  return {
    primaryTask,
    selectedTask,
    exportSelectedTask,
    orderedTasks,
    selectedTaskId,
    setSelectedTaskId,
    exportSelectedTaskId,
    setExportSelectedTaskId,
    taskListExpanded,
    setTaskListExpanded,
    taskCreationPreviewActive,
    setTaskCreationPreviewActive,
    pendingTaskSelectionDismissal,
    setPendingTaskSelectionDismissal,
    collapseTaskList,
  };
};
