import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Task } from "@shared/types/project";
import { useI18n } from "@renderer/i18n";
import type { TaskDateRange } from "@renderer/features/tasks/types";
import { sanitizeTaskTitle } from "@renderer/features/tasks/utils";

interface UseTaskCrudOptions {
  tasks: Task[];
  orderedTasks: Task[];
  selectedTask: Task | null;
  selectedTaskId: string | null;
  exportSelectedTaskId: string | null;
  draftTaskTitle: string;
  editingTaskId: string | null;
  taskDialogMode: "create" | "edit" | "rename";
  taskDates: TaskDateRange;
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
  setSelectedTaskId: Dispatch<SetStateAction<string | null>>;
  setExportSelectedTaskId: Dispatch<SetStateAction<string | null>>;
  setTaskListExpanded: Dispatch<SetStateAction<boolean>>;
  setTaskDetailOpen: Dispatch<SetStateAction<boolean>>;
  setTaskDetailPinned: Dispatch<SetStateAction<boolean>>;
  setTaskCreationPreviewActive: Dispatch<SetStateAction<boolean>>;
  setPendingTaskSelectionDismissal: Dispatch<SetStateAction<boolean>>;
  setTaskOverlayHovering: (hovered: boolean) => void;
  setTaskDialogOpen: Dispatch<SetStateAction<boolean>>;
  setEditingTaskId: Dispatch<SetStateAction<string | null>>;
  setTaskDialogMode: Dispatch<SetStateAction<"create" | "edit" | "rename">>;
  registerTaskOverlayInteraction: () => void;
  registerTaskDetailInteraction: () => void;
}

export const useTaskCrud = ({
  tasks,
  orderedTasks,
  selectedTask,
  selectedTaskId,
  exportSelectedTaskId,
  draftTaskTitle,
  editingTaskId,
  taskDialogMode,
  taskDates,
  addTask,
  duplicateTask,
  updateTask,
  removeTask,
  pushToast,
  setSelectedTaskId,
  setExportSelectedTaskId,
  setTaskListExpanded,
  setTaskDetailOpen,
  setTaskDetailPinned,
  setTaskCreationPreviewActive,
  setPendingTaskSelectionDismissal,
  setTaskOverlayHovering,
  setTaskDialogOpen,
  setEditingTaskId,
  setTaskDialogMode,
  registerTaskOverlayInteraction,
  registerTaskDetailInteraction,
}: UseTaskCrudOptions) => {
  const { copy } = useI18n();
  const handleSubmitTask = useCallback(() => {
    const title =
      sanitizeTaskTitle(draftTaskTitle) ||
      sanitizeTaskTitle(copy.tasks.defaults.newTask(tasks.length + 1));

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
        taskDialogMode === "rename"
          ? copy.toasts.renamedTo(title)
          : copy.toasts.updatedLabel(title),
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
    setTaskOverlayHovering(true);
    setTaskDialogOpen(false);
    setTaskDialogMode("create");
    registerTaskOverlayInteraction();
    registerTaskDetailInteraction();
    pushToast("success", copy.toasts.createdLabel(title));
  }, [
    addTask,
    copy.tasks.defaults,
    copy.toasts,
    draftTaskTitle,
    editingTaskId,
    pushToast,
    registerTaskDetailInteraction,
    registerTaskOverlayInteraction,
    setEditingTaskId,
    setExportSelectedTaskId,
    setPendingTaskSelectionDismissal,
    setSelectedTaskId,
    setTaskCreationPreviewActive,
    setTaskDetailOpen,
    setTaskDetailPinned,
    setTaskDialogMode,
    setTaskDialogOpen,
    setTaskListExpanded,
    setTaskOverlayHovering,
    taskDialogMode,
    taskDates,
    tasks.length,
    updateTask,
  ]);

  const handleDuplicateTask = useCallback(
    (taskId: string) => {
      const task = orderedTasks.find((entry) => entry.id === taskId);
      if (!task) {
        pushToast("info", copy.toasts.selectTaskToDuplicate);
        return;
      }

      const nextTaskId = duplicateTask(taskId);
      if (!nextTaskId) {
        pushToast("error", copy.toasts.couldNotDuplicateTask);
        return;
      }

      setSelectedTaskId(nextTaskId);
      setExportSelectedTaskId(nextTaskId);
      setTaskListExpanded(true);
      setTaskDetailOpen(true);
      setTaskCreationPreviewActive(true);
      setPendingTaskSelectionDismissal(false);
      setTaskDetailPinned(false);
      setTaskOverlayHovering(true);
      registerTaskOverlayInteraction();
      registerTaskDetailInteraction();
      pushToast("success", copy.toasts.duplicatedLabel(task.title));
    },
    [
      copy.toasts,
      duplicateTask,
      orderedTasks,
      pushToast,
      registerTaskDetailInteraction,
      registerTaskOverlayInteraction,
      setExportSelectedTaskId,
      setPendingTaskSelectionDismissal,
      setSelectedTaskId,
      setTaskCreationPreviewActive,
      setTaskDetailOpen,
      setTaskDetailPinned,
      setTaskListExpanded,
      setTaskOverlayHovering,
    ],
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      const task = orderedTasks.find((entry) => entry.id === taskId);
      if (!task) {
        pushToast("info", copy.toasts.selectTaskToDelete);
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
      pushToast("success", copy.toasts.deletedLabel(task.title));
    },
    [
      copy.toasts,
      exportSelectedTaskId,
      orderedTasks,
      pushToast,
      removeTask,
      selectedTaskId,
      setExportSelectedTaskId,
      setPendingTaskSelectionDismissal,
      setSelectedTaskId,
      setTaskCreationPreviewActive,
      setTaskDetailOpen,
      setTaskDetailPinned,
      setTaskListExpanded,
    ],
  );

  const handleDeleteSelectedTask = useCallback(() => {
    if (!selectedTask) {
      pushToast("info", copy.toasts.selectTaskToDelete);
      return;
    }

    handleDeleteTask(selectedTask.id);
  }, [copy.toasts.selectTaskToDelete, handleDeleteTask, pushToast, selectedTask]);

  return {
    handleSubmitTask,
    handleDuplicateTask,
    handleDeleteTask,
    handleDeleteSelectedTask,
  };
};
