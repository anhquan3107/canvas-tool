import type { Project } from "@shared/types/project";
import type { Action } from "@renderer/state/project-store-types";
import {
  randomUUID,
  reorderTodos,
  touchProject,
} from "@renderer/state/store-helpers";

export const reduceTodoAction = (
  project: Project,
  action: Action,
): Project | null => {
  switch (action.type) {
    case "add-todo":
      return touchProject({
        ...project,
        tasks: project.tasks.map((task) => {
          if (task.id !== action.payload.taskId) {
            return task;
          }

          return {
            ...task,
            todos: [
              ...task.todos,
              {
                id: randomUUID(),
                text: action.payload.text,
                completed: false,
                order: task.todos.length,
              },
            ],
          };
        }),
      });
    case "remove-todo":
      return touchProject({
        ...project,
        tasks: project.tasks.map((task) => {
          if (task.id !== action.payload.taskId) {
            return task;
          }

          return {
            ...task,
            todos: reorderTodos(
              task.todos.filter((todo) => todo.id !== action.payload.todoId),
            ),
          };
        }),
      });
    case "toggle-todo":
      return touchProject({
        ...project,
        tasks: project.tasks.map((task) => {
          if (task.id !== action.payload.taskId) {
            return task;
          }

          return {
            ...task,
            todos: task.todos.map((todo) =>
              todo.id === action.payload.todoId
                ? { ...todo, completed: !todo.completed }
                : todo,
            ),
          };
        }),
      });
    case "rename-todo":
      return touchProject({
        ...project,
        tasks: project.tasks.map((task) => {
          if (task.id !== action.payload.taskId) {
            return task;
          }

          return {
            ...task,
            todos: task.todos.map((todo) =>
              todo.id === action.payload.todoId
                ? { ...todo, text: action.payload.text }
                : todo,
            ),
          };
        }),
      });
    case "reorder-todo":
      return touchProject({
        ...project,
        tasks: project.tasks.map((task) => {
          if (task.id !== action.payload.taskId) {
            return task;
          }

          const nextTodos = [...task.todos];
          const [moved] = nextTodos.splice(action.payload.sourceIndex, 1);
          nextTodos.splice(action.payload.targetIndex, 0, moved);

          return {
            ...task,
            todos: reorderTodos(nextTodos),
          };
        }),
      });
    default:
      return null;
  }
};
