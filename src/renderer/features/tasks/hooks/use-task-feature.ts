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
  duplicateTask: (taskId: string) => string | null;
  updateTask: (
    taskId: string,
    updates: Partial<Pick<Task, "title" | "completed" | "startDate" | "endDate">>,
  ) => void;
  removeTask: (taskId: string) => void;
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
}

const TASK_IDLE_TIMEOUT_MS = 5000;
const TASK_SELECTION_HIDE_DURATION_MS = 640;

export const useTaskFeature = ({
  tasks,
  addTask,
  duplicateTask,
  updateTask,
  removeTask,
  pushToast,
}: UseTaskFeatureOptions) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [exportSelectedTaskId, setExportSelectedTaskId] = useState<string | null>(null);
  const [taskListExpanded, setTaskListExpanded] = useState(false);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskDetailPinned, setTaskDetailPinned] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<"create" | "edit" | "rename">(
    "create",
  );
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
  const [taskOverlayHovered, setTaskOverlayHovered] = useState(false);
  const [taskOverlayFocused, setTaskOverlayFocused] = useState(false);
  const [taskDetailHovered, setTaskDetailHovered] = useState(false);
  const [taskDetailFocused, setTaskDetailFocused] = useState(false);

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

  const primaryTask = taskListExpanded || pendingTaskSelectionDismissal
    ? orderedTasks[0] ?? null
    : selectedTask ?? orderedTasks[0] ?? null;

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

  const setTaskOverlayHovering = useCallback((hovered: boolean) => {
    setTaskOverlayHovered(hovered);
    if (hovered) {
      registerTaskOverlayInteraction();
    }
  }, [registerTaskOverlayInteraction]);

  const setTaskOverlayFocusWithin = useCallback((focused: boolean) => {
    setTaskOverlayFocused(focused);
    if (focused) {
      registerTaskOverlayInteraction();
    }
  }, [registerTaskOverlayInteraction]);

  const setTaskDetailHovering = useCallback((hovered: boolean) => {
    setTaskDetailHovered(hovered);
    if (hovered) {
      registerTaskDetailInteraction();
    }
  }, [registerTaskDetailInteraction]);

  const setTaskDetailFocusWithin = useCallback((focused: boolean) => {
    setTaskDetailFocused(focused);
    if (focused) {
      registerTaskDetailInteraction();
    }
  }, [registerTaskDetailInteraction]);

  const selectTask = useCallback((taskId: string | null) => {
    setPendingTaskSelectionDismissal(false);
    setSelectedTaskId(taskId);
    setExportSelectedTaskId(taskId);
    if (taskId) {
      registerTaskOverlayInteraction();
      registerTaskDetailInteraction();
    }
  }, [registerTaskDetailInteraction, registerTaskOverlayInteraction]);

  const toggleTaskListExpanded = useCallback(() => {
    registerTaskOverlayInteraction();
    setTaskListExpanded((expanded) => {
      const nextExpanded = !expanded;
      if (nextExpanded) {
        setTaskOverlayHovered(true);
      }
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

  const handleSubmitTask = useCallback(() => {
    const title = draftTaskTitle.trim() || `Task ${tasks.length + 1}`;

    if (editingTaskId) {
      updateTask(
        editingTaskId,
        taskDialogMode === "rename"
          ? {
              title,
            }
          : {
              title,
              startDate: taskDates.startDate,
              endDate: taskDates.endDate,
            },
      );
      setTaskDialogOpen(false);
      setEditingTaskId(null);
      setTaskDialogMode("create");
      pushToast(
        "success",
        taskDialogMode === "rename" ? `Renamed to ${title}.` : `Updated ${title}.`,
      );
      return;
    }

    const nextTaskId = addTask(title, taskDates);
    setSelectedTaskId(nextTaskId);
    setExportSelectedTaskId(nextTaskId);
    setTaskListExpanded(true);
    setTaskDetailOpen(true);
    setTaskCreationPreviewActive(true);
    setPendingTaskSelectionDismissal(false);
    setTaskDetailPinned(false);
    setTaskOverlayHovered(true);
    setTaskDialogOpen(false);
    setTaskDialogMode("create");
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
    taskDialogMode,
    taskDates,
    tasks.length,
    updateTask,
  ]);

  const handleDuplicateTask = useCallback(
    (taskId: string) => {
      const task = orderedTasks.find((entry) => entry.id === taskId);
      if (!task) {
        pushToast("info", "Select a task to duplicate.");
        return;
      }

      const nextTaskId = duplicateTask(taskId);
      if (!nextTaskId) {
        pushToast("error", "Could not duplicate task.");
        return;
      }

      setSelectedTaskId(nextTaskId);
      setExportSelectedTaskId(nextTaskId);
      setTaskListExpanded(true);
      setTaskDetailOpen(true);
      setTaskCreationPreviewActive(true);
      setPendingTaskSelectionDismissal(false);
      setTaskDetailPinned(false);
      setTaskOverlayHovered(true);
      registerTaskOverlayInteraction();
      registerTaskDetailInteraction();
      pushToast("success", `Duplicated ${task.title}.`);
    },
    [
      duplicateTask,
      orderedTasks,
      pushToast,
      registerTaskDetailInteraction,
      registerTaskOverlayInteraction,
    ],
  );

  useEffect(() => {
    if (!taskCreationPreviewActive || taskOverlayHovered || taskOverlayFocused) {
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
  }, [
    taskCreationPreviewActive,
    taskDetailPinned,
    taskOverlayActivityVersion,
    taskOverlayFocused,
    taskOverlayHovered,
  ]);

  useEffect(() => {
    if (
      !taskListExpanded ||
      taskCreationPreviewActive ||
      taskOverlayHovered ||
      taskOverlayFocused
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTaskListExpanded(false);
    }, TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    taskCreationPreviewActive,
    taskListExpanded,
    taskOverlayActivityVersion,
    taskOverlayFocused,
    taskOverlayHovered,
  ]);

  useEffect(() => {
    if (
      !taskDetailOpen ||
      taskDetailPinned ||
      !selectedTaskId ||
      taskDetailHovered ||
      taskDetailFocused
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTaskDetailOpen(false);
      setPendingTaskSelectionDismissal(true);
    }, TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    selectedTaskId,
    taskDetailActivityVersion,
    taskDetailFocused,
    taskDetailHovered,
    taskDetailOpen,
    taskDetailPinned,
  ]);

  useEffect(() => {
    if (primaryTask) {
      return;
    }

    setTaskOverlayHovered(false);
    setTaskOverlayFocused(false);
  }, [primaryTask]);

  useEffect(() => {
    if (selectedTask) {
      return;
    }

    setTaskDetailHovered(false);
    setTaskDetailFocused(false);
  }, [selectedTask]);

  useEffect(() => {
    if (!pendingTaskSelectionDismissal) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!taskDetailOpen && !taskDetailPinned) {
        setSelectedTaskId(null);
      }
      setPendingTaskSelectionDismissal(false);
    }, TASK_SELECTION_HIDE_DURATION_MS);

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
      if (exportSelectedTaskId === task.id) {
        setExportSelectedTaskId(nextSelectedTask?.id ?? null);
      }
      setTaskDetailPinned(false);
      setPendingTaskSelectionDismissal(false);
      setTaskListExpanded(false);
      setTaskCreationPreviewActive(false);
      pushToast("success", `Deleted ${task.title}.`);
    },
    [exportSelectedTaskId, orderedTasks, pushToast, removeTask, selectedTaskId],
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
    exportSelectedTask,
    selectedTaskId,
    orderedTasks,
    taskListExpanded,
    taskDetailOpen,
    taskDetailPinned,
    taskDialogOpen,
    taskDialogMode,
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
    setTaskOverlayHovering,
    setTaskOverlayFocusWithin,
    setTaskDetailHovering,
    setTaskDetailFocusWithin,
    openTaskDialog,
    openEditTaskDialog,
    openRenameTaskDialog,
    handleSubmitTask,
    handleDuplicateTask,
    handleDeleteTask,
    handleDeleteSelectedTask,
  };
};
