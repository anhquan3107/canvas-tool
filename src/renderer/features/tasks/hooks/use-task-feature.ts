import { useCallback, useEffect, useMemo, useState } from "react";
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
  updateTask: (
    taskId: string,
    updates: Partial<Pick<Task, "title" | "startDate" | "endDate">>,
  ) => void;
  removeTask: (taskId: string) => void;
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
}

const TASK_IDLE_TIMEOUT_MS = 5000;

export const useTaskFeature = ({
  tasks,
  addTask,
  updateTask,
  removeTask,
  pushToast,
}: UseTaskFeatureOptions) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskListExpanded, setTaskListExpanded] = useState(false);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskDetailPinned, setTaskDetailPinned] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [draftTaskTitle, setDraftTaskTitle] = useState("New Task");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDates, setTaskDates] = useState<TaskDateRange>(
    createDefaultTaskDates(),
  );
  const [taskCreationPreviewActive, setTaskCreationPreviewActive] = useState(false);
  const [pendingTaskSelectionDismissal, setPendingTaskSelectionDismissal] =
    useState(false);
  const [taskOverlayActivityVersion, setTaskOverlayActivityVersion] = useState(0);
  const [taskDetailActivityVersion, setTaskDetailActivityVersion] = useState(0);

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

  const registerTaskOverlayInteraction = useCallback(() => {
    setTaskOverlayActivityVersion((version) => version + 1);
  }, []);

  const registerTaskDetailInteraction = useCallback(() => {
    setTaskDetailActivityVersion((version) => version + 1);
  }, []);

  const selectTask = useCallback((taskId: string | null) => {
    setPendingTaskSelectionDismissal(false);
    setSelectedTaskId(taskId);
    if (taskId) {
      registerTaskOverlayInteraction();
      registerTaskDetailInteraction();
    }
  }, [registerTaskDetailInteraction, registerTaskOverlayInteraction]);

  const toggleTaskListExpanded = useCallback(() => {
    registerTaskOverlayInteraction();
    setTaskListExpanded((expanded) => {
      const nextExpanded = !expanded;
      if (!nextExpanded) {
        setTaskCreationPreviewActive(false);
      }
      return nextExpanded;
    });
  }, [registerTaskOverlayInteraction]);

  const collapseTaskList = useCallback(() => {
    setTaskListExpanded(false);
    setTaskCreationPreviewActive(false);
  }, []);

  const toggleTaskDetailOpen = useCallback(() => {
    setPendingTaskSelectionDismissal(false);
    registerTaskDetailInteraction();
    setTaskDetailOpen((open) => !open);
  }, [registerTaskDetailInteraction]);

  const toggleTaskDetailPinned = useCallback(() => {
    setPendingTaskSelectionDismissal(false);
    registerTaskDetailInteraction();
    setTaskDetailPinned((pinned) => !pinned);
  }, [registerTaskDetailInteraction]);

  const openTaskDialog = useCallback(() => {
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

  const handleSubmitTask = useCallback(() => {
    const title = draftTaskTitle.trim() || `Task ${tasks.length + 1}`;

    if (editingTaskId) {
      updateTask(editingTaskId, {
        title,
        startDate: taskDates.startDate,
        endDate: taskDates.endDate,
      });
      setTaskDialogOpen(false);
      setEditingTaskId(null);
      pushToast("success", `Updated ${title}.`);
      return;
    }

    const nextTaskId = addTask(title, taskDates);
    setSelectedTaskId(nextTaskId);
    setTaskListExpanded(true);
    setTaskDetailOpen(true);
    setTaskCreationPreviewActive(true);
    setPendingTaskSelectionDismissal(false);
    setTaskDetailPinned(false);
    setTaskDialogOpen(false);
    registerTaskOverlayInteraction();
    registerTaskDetailInteraction();
    pushToast("success", `Created ${title}.`);
  }, [
    addTask,
    draftTaskTitle,
    editingTaskId,
    pushToast,
    registerTaskDetailInteraction,
    registerTaskOverlayInteraction,
    taskDates,
    tasks.length,
    updateTask,
  ]);

  useEffect(() => {
    if (!taskCreationPreviewActive) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTaskListExpanded(false);
      if (!taskDetailPinned) {
        setTaskDetailOpen(false);
        setPendingTaskSelectionDismissal(true);
      }
      setTaskCreationPreviewActive(false);
    }, TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [taskCreationPreviewActive, taskDetailPinned, taskOverlayActivityVersion]);

  useEffect(() => {
    if (!taskDetailOpen || taskDetailPinned || !selectedTaskId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTaskDetailOpen(false);
      setPendingTaskSelectionDismissal(true);
    }, TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedTaskId, taskDetailActivityVersion, taskDetailOpen, taskDetailPinned]);

  useEffect(() => {
    if (!pendingTaskSelectionDismissal) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!taskDetailOpen && !taskDetailPinned) {
        setSelectedTaskId(null);
      }
      setPendingTaskSelectionDismissal(false);
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pendingTaskSelectionDismissal, taskDetailOpen, taskDetailPinned]);

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
      setTaskDetailPinned(false);
      setPendingTaskSelectionDismissal(false);
      setTaskListExpanded(false);
      setTaskCreationPreviewActive(false);
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
    taskDetailPinned,
    taskDialogOpen,
    editingTaskId,
    draftTaskTitle,
    taskDates,
    taskDuration,
    setSelectedTaskId,
    setTaskListExpanded,
    setTaskDetailOpen,
    setTaskDialogOpen,
    setDraftTaskTitle,
    setTaskDates,
    selectTask,
    toggleTaskListExpanded,
    collapseTaskList,
    toggleTaskDetailOpen,
    toggleTaskDetailPinned,
    registerTaskOverlayInteraction,
    registerTaskDetailInteraction,
    openTaskDialog,
    openEditTaskDialog,
    handleSubmitTask,
    handleDeleteTask,
    handleDeleteSelectedTask,
  };
};
