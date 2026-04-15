import type { Project } from "@shared/types/project";
import type { Action } from "@renderer/state/project-store-types";
import { sanitizeTaskTitle } from "@renderer/features/tasks/utils";
import { randomUUID, touchProject } from "@renderer/state/store-helpers";

export const reduceTaskAction = (
  project: Project,
  action: Action,
): Project | null => {
  switch (action.type) {
    case "add-task":
      return touchProject({
        ...project,
        tasks: [
          {
            id: action.payload.id,
            title:
              sanitizeTaskTitle(action.payload.title) ||
              sanitizeTaskTitle(`Task ${project.tasks.length + 1}`),
            order: 0,
            startDate: action.payload.startDate,
            endDate: action.payload.endDate,
            todos: [],
          },
          ...project.tasks.map((task) => ({
            ...task,
            order: task.order + 1,
          })),
        ],
      });
    case "update-task":
      return touchProject({
        ...project,
        tasks: project.tasks.map((task) =>
          task.id === action.payload.taskId
            ? {
                ...task,
                ...(action.payload.title !== undefined
                  ? {
                      title:
                        sanitizeTaskTitle(action.payload.title) ||
                        sanitizeTaskTitle(task.title),
                    }
                  : {}),
                ...(action.payload.completed !== undefined
                  ? { completed: action.payload.completed }
                  : {}),
                ...(action.payload.startDate !== undefined
                  ? { startDate: action.payload.startDate }
                  : {}),
                ...(action.payload.endDate !== undefined
                  ? { endDate: action.payload.endDate }
                  : {}),
              }
            : task,
        ),
      });
    case "complete-task":
      return touchProject({
        ...project,
        tasks: project.tasks.map((task) =>
          task.id === action.payload.taskId
            ? {
                ...task,
                completed: action.payload.completed,
                todos: task.todos.map((todo) => ({
                  ...todo,
                  completed: action.payload.completed,
                })),
              }
            : task,
        ),
      });
    case "duplicate-task": {
      const sourceTask = project.tasks.find(
        (task) => task.id === action.payload.taskId,
      );
      if (!sourceTask) {
        return project;
      }

      return touchProject({
        ...project,
        tasks: [
          {
            ...sourceTask,
            id: action.payload.id,
            title: sanitizeTaskTitle(`${sourceTask.title} Copy`),
            order: 0,
            todos: sourceTask.todos.map((todo, index) => ({
              ...todo,
              id: randomUUID(),
              order: index,
            })),
          },
          ...project.tasks.map((task) => ({
            ...task,
            order: task.order + 1,
          })),
        ],
      });
    }
    case "link-task-group":
      return touchProject({
        ...project,
        tasks: project.tasks.map((task) =>
          task.id === action.payload.taskId
            ? {
                ...task,
                linkedGroupId: action.payload.groupId,
              }
            : task,
        ),
      });
    case "remove-task":
      return touchProject({
        ...project,
        tasks: project.tasks
          .filter((task) => task.id !== action.payload.taskId)
          .map((task, index) => ({
            ...task,
            order: index,
          })),
      });
    default:
      return null;
  }
};
