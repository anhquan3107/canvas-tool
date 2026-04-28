import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { TaskTransferTask, TasksImportResult } from "@shared/types/ipc";
import type { Project, ReferenceGroup, Task } from "@shared/types/project";
import { useI18n } from "@renderer/i18n";

type PushToast = (kind: "success" | "error" | "info", message: string) => void;

export type TaskImportMode = "merge" | "replace" | "skip-duplicates";

export type TaskImportPreviewState = TasksImportResult & {
  duplicateCount: number;
  importableCount: number;
};

interface UseAppTaskActionsOptions {
  project: Project;
  pushToast: PushToast;
  setProject: (project: Project) => void;
  taskImportPreview: TaskImportPreviewState | null;
  setTaskImportPreview: Dispatch<SetStateAction<TaskImportPreviewState | null>>;
}

const buildTaskDuplicateSignature = (
  task: Pick<
    TaskTransferTask,
    "title" | "startDate" | "endDate" | "linkedGroupName" | "todos"
  >,
) =>
  JSON.stringify({
    title: task.title.trim().toLowerCase(),
    startDate: task.startDate ?? "",
    endDate: task.endDate ?? "",
    linkedGroupName: task.linkedGroupName?.trim().toLowerCase() ?? "",
    todos: [...task.todos]
      .sort((left, right) => left.order - right.order)
      .map((todo) => ({
        text: todo.text.trim().toLowerCase(),
        completed: todo.completed,
      })),
  });

const buildExistingTaskDuplicateSet = (
  tasks: Task[],
  groups: ReferenceGroup[],
) => {
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  return new Set(
    tasks.map((task) =>
      buildTaskDuplicateSignature({
        ...task,
        linkedGroupName: task.linkedGroupId
          ? groupNameById.get(task.linkedGroupId)
          : undefined,
      }),
    ),
  );
};

const resolveImportedTaskGroupId = (
  task: TaskTransferTask,
  groups: ReferenceGroup[],
) => {
  if (task.linkedGroupId && groups.some((group) => group.id === task.linkedGroupId)) {
    return task.linkedGroupId;
  }

  if (!task.linkedGroupName) {
    return undefined;
  }

  const matchedGroup = groups.find(
    (group) => group.name.trim().toLowerCase() === task.linkedGroupName?.trim().toLowerCase(),
  );
  return matchedGroup?.id;
};

const cloneImportedTasksForProject = (
  tasks: TaskTransferTask[],
  groups: ReferenceGroup[],
  startingOrder: number,
) =>
  tasks.map<Task>((task, index) => ({
    id: crypto.randomUUID(),
    title: task.title,
    order: startingOrder + index,
    completed: task.completed,
    startDate: task.startDate,
    endDate: task.endDate,
    linkedGroupId: resolveImportedTaskGroupId(task, groups),
    todos: [...task.todos]
      .sort((left, right) => left.order - right.order)
      .map((todo, todoIndex) => ({
        id: crypto.randomUUID(),
        text: todo.text,
        completed: todo.completed,
        order: todoIndex,
      })),
  }));

export const useAppTaskActions = ({
  project,
  pushToast,
  setProject,
  taskImportPreview,
  setTaskImportPreview,
}: UseAppTaskActionsOptions) => {
  const { copy } = useI18n();
  const handleImportTasks = useCallback(async () => {
    try {
      const result = await window.desktopApi.project.importTasks();
      if (!result) {
        return;
      }

      const existingTaskIds = new Set(project.tasks.map((task) => task.id));
      const existingTaskSignatures = buildExistingTaskDuplicateSet(
        project.tasks,
        project.groups,
      );
      const duplicateCount = result.tasks.filter(
        (task) =>
          existingTaskIds.has(task.id) ||
          existingTaskSignatures.has(buildTaskDuplicateSignature(task)),
      ).length;

      setTaskImportPreview({
        ...result,
        duplicateCount,
        importableCount: Math.max(0, result.tasks.length - duplicateCount),
      });
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? error.message : copy.toasts.taskImportFailed,
      );
    }
  }, [
    copy.toasts.taskImportFailed,
    project.groups,
    project.tasks,
    pushToast,
    setTaskImportPreview,
  ]);

  const handleApplyImportedTasks = useCallback(
    (mode: TaskImportMode) => {
      if (!taskImportPreview) {
        return;
      }

      const existingTaskIds = new Set(project.tasks.map((task) => task.id));
      const existingTaskSignatures = buildExistingTaskDuplicateSet(
        project.tasks,
        project.groups,
      );
      const importedTasks =
        mode === "skip-duplicates"
          ? taskImportPreview.tasks.filter(
              (task) =>
                !existingTaskIds.has(task.id) &&
                !existingTaskSignatures.has(buildTaskDuplicateSignature(task)),
            )
          : taskImportPreview.tasks;

      const nextTasks =
        mode === "replace"
          ? cloneImportedTasksForProject(importedTasks, project.groups, 0)
          : [
              ...project.tasks,
              ...cloneImportedTasksForProject(
                importedTasks,
                project.groups,
                project.tasks.length,
              ),
            ];

      if (importedTasks.length === 0) {
        setTaskImportPreview(null);
        pushToast("info", copy.toasts.noNewTasksToImport);
        return;
      }

      setProject({
        ...project,
        tasks: nextTasks,
        updatedAt: new Date().toISOString(),
      });
      setTaskImportPreview(null);
      pushToast(
        "success",
        mode === "replace"
          ? copy.toasts.replacedTasks(importedTasks.length)
          : copy.toasts.importedTasks(importedTasks.length),
      );
    },
    [
      copy.toasts.importedTasks,
      copy.toasts.noNewTasksToImport,
      copy.toasts.replacedTasks,
      project,
      pushToast,
      setProject,
      setTaskImportPreview,
      taskImportPreview,
    ],
  );

  return {
    handleImportTasks,
    handleApplyImportedTasks,
  };
};
