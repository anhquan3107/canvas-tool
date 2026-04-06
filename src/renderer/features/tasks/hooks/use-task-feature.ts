import { useCallback } from "react";
import type { Task } from "@shared/types/project";
import { useTaskCrud } from "@renderer/features/tasks/hooks/use-task-crud";
import { useTaskDetailPanel } from "@renderer/features/tasks/hooks/use-task-detail-panel";
import { useTaskDialogs } from "@renderer/features/tasks/hooks/use-task-dialogs";
import { useTaskSelection } from "@renderer/features/tasks/hooks/use-task-selection";

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

export const useTaskFeature = ({
  tasks,
  addTask,
  duplicateTask,
  updateTask,
  removeTask,
  pushToast,
}: UseTaskFeatureOptions) => {
  const selection = useTaskSelection({ tasks });
  const dialogs = useTaskDialogs({
    tasks,
    orderedTasks: selection.orderedTasks,
  });
  const detailPanel = useTaskDetailPanel({
    primaryTask: selection.primaryTask,
    selectedTask: selection.selectedTask,
    selectedTaskId: selection.selectedTaskId,
    taskListExpanded: selection.taskListExpanded,
    setTaskListExpanded: selection.setTaskListExpanded,
    taskCreationPreviewActive: selection.taskCreationPreviewActive,
    setTaskCreationPreviewActive: selection.setTaskCreationPreviewActive,
    pendingTaskSelectionDismissal: selection.pendingTaskSelectionDismissal,
    setPendingTaskSelectionDismissal: selection.setPendingTaskSelectionDismissal,
    setSelectedTaskId: selection.setSelectedTaskId,
  });

  const selectTask = useCallback((taskId: string | null) => {
    selection.setPendingTaskSelectionDismissal(false);
    selection.setSelectedTaskId(taskId);
    selection.setExportSelectedTaskId(taskId);
    if (taskId) {
      detailPanel.registerTaskOverlayInteraction();
      detailPanel.registerTaskDetailInteraction();
    }
  }, [detailPanel, selection]);

  const crud = useTaskCrud({
    tasks,
    orderedTasks: selection.orderedTasks,
    selectedTask: selection.selectedTask,
    selectedTaskId: selection.selectedTaskId,
    exportSelectedTaskId: selection.exportSelectedTaskId,
    draftTaskTitle: dialogs.draftTaskTitle,
    editingTaskId: dialogs.editingTaskId,
    taskDialogMode: dialogs.taskDialogMode,
    taskDates: dialogs.taskDates,
    addTask,
    duplicateTask,
    updateTask,
    removeTask,
    pushToast,
    setSelectedTaskId: selection.setSelectedTaskId,
    setExportSelectedTaskId: selection.setExportSelectedTaskId,
    setTaskListExpanded: selection.setTaskListExpanded,
    setTaskDetailOpen: detailPanel.setTaskDetailOpen,
    setTaskDetailPinned: detailPanel.setTaskDetailPinned,
    setTaskCreationPreviewActive: selection.setTaskCreationPreviewActive,
    setPendingTaskSelectionDismissal: selection.setPendingTaskSelectionDismissal,
    setTaskOverlayHovering: detailPanel.setTaskOverlayHovering,
    setTaskDialogOpen: dialogs.setTaskDialogOpen,
    setEditingTaskId: dialogs.setEditingTaskId,
    setTaskDialogMode: dialogs.setTaskDialogMode,
    registerTaskOverlayInteraction: detailPanel.registerTaskOverlayInteraction,
    registerTaskDetailInteraction: detailPanel.registerTaskDetailInteraction,
  });

  return {
    primaryTask: selection.primaryTask,
    selectedTask: selection.selectedTask,
    exportSelectedTask: selection.exportSelectedTask,
    selectedTaskId: selection.selectedTaskId,
    orderedTasks: selection.orderedTasks,
    taskListExpanded: selection.taskListExpanded,
    taskDetailOpen: detailPanel.taskDetailOpen,
    taskDetailPinned: detailPanel.taskDetailPinned,
    taskDialogOpen: dialogs.taskDialogOpen,
    taskDialogMode: dialogs.taskDialogMode,
    editingTaskId: dialogs.editingTaskId,
    draftTaskTitle: dialogs.draftTaskTitle,
    taskDates: dialogs.taskDates,
    taskDuration: dialogs.taskDuration,
    setSelectedTaskId: selection.setSelectedTaskId,
    setTaskListExpanded: selection.setTaskListExpanded,
    setTaskDetailOpen: detailPanel.setTaskDetailOpen,
    setTaskDialogOpen: dialogs.setTaskDialogOpen,
    setDraftTaskTitle: dialogs.setDraftTaskTitle,
    setTaskDates: dialogs.setTaskDates,
    selectTask,
    toggleTaskListExpanded: detailPanel.toggleTaskListExpanded,
    collapseTaskList: selection.collapseTaskList,
    toggleTaskDetailOpen: detailPanel.toggleTaskDetailOpen,
    toggleTaskDetailPinned: detailPanel.toggleTaskDetailPinned,
    registerTaskOverlayInteraction: detailPanel.registerTaskOverlayInteraction,
    registerTaskDetailInteraction: detailPanel.registerTaskDetailInteraction,
    setTaskOverlayHovering: detailPanel.setTaskOverlayHovering,
    setTaskOverlayFocusWithin: detailPanel.setTaskOverlayFocusWithin,
    setTaskDetailHovering: detailPanel.setTaskDetailHovering,
    setTaskDetailFocusWithin: detailPanel.setTaskDetailFocusWithin,
    openTaskDialog: dialogs.openTaskDialog,
    openEditTaskDialog: dialogs.openEditTaskDialog,
    openRenameTaskDialog: dialogs.openRenameTaskDialog,
    handleSubmitTask: crud.handleSubmitTask,
    handleDuplicateTask: crud.handleDuplicateTask,
    handleDeleteTask: crud.handleDeleteTask,
    handleDeleteSelectedTask: crud.handleDeleteSelectedTask,
  };
};
