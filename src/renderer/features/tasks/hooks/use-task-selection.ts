import { useCallback, useMemo, useState } from "react";
import type { Task } from "@shared/types/project";

const getComparableDeadline = (task: Task) => {
  const value = task.endDate?.trim();
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

const compareTasksForLeftPanel = (left: Task, right: Task) => {
  const leftCompleted = Boolean(left.completed);
  const rightCompleted = Boolean(right.completed);

  if (leftCompleted !== rightCompleted) {
    return leftCompleted ? 1 : -1;
  }

  const leftDeadline = getComparableDeadline(left);
  const rightDeadline = getComparableDeadline(right);

  if (leftDeadline && rightDeadline && leftDeadline !== rightDeadline) {
    return leftDeadline.localeCompare(rightDeadline);
  }

  if (leftDeadline && !rightDeadline) {
    return -1;
  }

  if (!leftDeadline && rightDeadline) {
    return 1;
  }

  if (left.order !== right.order) {
    return left.order - right.order;
  }

  return left.id.localeCompare(right.id);
};

export const useTaskSelection = ({ tasks }: { tasks: Task[] }) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [exportSelectedTaskId, setExportSelectedTaskId] = useState<string | null>(null);
  const [taskListExpanded, setTaskListExpanded] = useState(false);
  const [taskCreationPreviewActive, setTaskCreationPreviewActive] = useState(false);
  const [pendingTaskSelectionDismissal, setPendingTaskSelectionDismissal] =
    useState(false);

  const orderedTasks = useMemo(
    () => [...tasks].sort(compareTasksForLeftPanel),
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
