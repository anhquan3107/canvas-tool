import type {
  CanvasItem,
  Project,
  ReferenceGroup,
  TodoItem,
} from "@shared/types/project";
import {
  DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "@shared/project-defaults";
import type { Action, HistoryState } from "@renderer/state/project-store-types";

const randomUUID = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const MAX_HISTORY_ENTRIES = 100;
const cloneProject = (project: Project) => structuredClone(project);
const projectHistorySignature = (project: Project) =>
  JSON.stringify({
    ...project,
    updatedAt: undefined,
  });

const touchProject = (project: Project): Project => ({
  ...project,
  updatedAt: now(),
});

const reorderTodos = (todos: TodoItem[]) =>
  todos.map((todo, index) => ({ ...todo, order: index }));

const createEmptyGroup = (
  name: string,
  order: number,
  canvasSize: Project["canvasSize"],
  kind: ReferenceGroup["kind"] = "group",
): ReferenceGroup => ({
  id: randomUUID(),
  name,
  kind,
  order,
  locked: false,
  canvasColor: DEFAULT_GROUP_CANVAS_COLOR,
  backgroundColor: DEFAULT_GROUP_BACKGROUND_COLOR,
  canvasSize: { ...canvasSize },
  zoom: 1,
  panX: 0,
  panY: 0,
  layoutMode: "pinterest-dynamic",
  filters: {
    blur: 0,
    grayscale: 0,
  },
  items: [],
  annotations: [],
  extractedSwatches: [],
});

const cloneGroupSnapshot = (
  sourceGroup: ReferenceGroup,
  name: string,
  order: number,
): ReferenceGroup => ({
  ...structuredClone(sourceGroup),
  id: randomUUID(),
  name,
  kind: "group",
  order,
});

const projectReducer = (project: Project, action: Action): Project => {
  switch (action.type) {
    case "set-project":
      return action.payload;
    case "undo":
    case "redo":
    case "begin-history-batch":
    case "end-history-batch":
      return project;
    case "set-active-group":
      return touchProject({
        ...project,
        activeGroupId: action.payload,
      });
    case "set-group-view":
      return touchProject({
        ...project,
        groups: project.groups.map((group) =>
          group.id === action.payload.groupId
            ? {
                ...group,
                zoom: action.payload.zoom,
                panX: action.payload.panX,
                panY: action.payload.panY,
              }
            : group,
        ),
      });
    case "patch-group-items":
      return touchProject({
        ...project,
        groups: project.groups.map((group) => {
          if (group.id !== action.payload.groupId) {
            return group;
          }

          return {
            ...group,
            items: group.items.map((item) => {
              const patch = action.payload.updates[item.id];
              return patch ? { ...item, ...patch } : item;
            }),
          };
        }),
      });
    case "add-group-items":
      return touchProject({
        ...project,
        groups: project.groups.map((group) => {
          if (group.id !== action.payload.groupId) {
            return group;
          }

          return {
            ...group,
            items: [...group.items, ...action.payload.items],
          };
        }),
      });
    case "remove-group-items": {
      const removed = new Set(action.payload.itemIds);

      return touchProject({
        ...project,
        groups: project.groups.map((group) => {
          if (group.id !== action.payload.groupId) {
            return group;
          }

          return {
            ...group,
            items: group.items.filter((item) => !removed.has(item.id)),
          };
        }),
      });
    }
    case "add-group": {
      const canvasGroup =
        project.groups.find((group) => group.kind === "canvas") ?? project.groups[0];
      const sourceGroup =
        project.groups.find((group) => group.id === project.activeGroupId) ??
        canvasGroup;
      if (!canvasGroup || !sourceGroup) {
        return project;
      }

      const snapshotGroup = cloneGroupSnapshot(
        sourceGroup,
        action.payload.name ||
          `Group ${project.groups.filter((group) => group.kind === "group").length + 1}`,
        project.groups.length,
      );
      const resetCanvasGroup = createEmptyGroup(
        canvasGroup.name,
        canvasGroup.order,
        DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
        "canvas",
      );
      resetCanvasGroup.id = canvasGroup.id;

      return touchProject({
        ...project,
        activeGroupId: canvasGroup.id,
        groups: project.groups
          .map((group) => (group.id === canvasGroup.id ? resetCanvasGroup : group))
          .concat(snapshotGroup)
          .map((group, index) => ({
            ...group,
            order: index,
          })),
      });
    }
    case "rename-group":
      return touchProject({
        ...project,
        groups: project.groups.map((group) =>
          group.id === action.payload.groupId
            ? {
                ...group,
                name: action.payload.name,
              }
            : group,
        ),
      });
    case "remove-group": {
      const targetGroup = project.groups.find(
        (group) => group.id === action.payload.groupId,
      );
      if (!targetGroup || targetGroup.kind === "canvas") {
        return project;
      }

      const removedIndex = project.groups.findIndex(
        (group) => group.id === action.payload.groupId,
      );
      if (removedIndex < 0) {
        return project;
      }

      const nextGroups = project.groups
        .filter((group) => group.id !== action.payload.groupId)
        .map((group, index) => ({
          ...group,
          order: index,
        }));
      const canvasGroup =
        nextGroups.find((group) => group.kind === "canvas") ?? nextGroups[0];

      return touchProject({
        ...project,
        activeGroupId:
          project.activeGroupId === action.payload.groupId
            ? canvasGroup.id
            : project.activeGroupId,
        groups: nextGroups,
      });
    }
    case "set-group-filters":
      return touchProject({
        ...project,
        groups: project.groups.map((group) => {
          if (group.id !== action.payload.groupId) {
            return group;
          }

          return {
            ...group,
            filters: {
              ...group.filters,
              ...action.payload.filters,
            },
          };
        }),
      });
    case "set-group-canvas-size":
      return touchProject({
        ...project,
        groups: project.groups.map((group) => {
          if (group.id !== action.payload.groupId) {
            return group;
          }

          return {
            ...group,
            canvasSize: {
              width: Math.max(1, Math.round(action.payload.width)),
              height: Math.max(1, Math.round(action.payload.height)),
            },
          };
        }),
      });
    case "set-group-colors":
      return touchProject({
        ...project,
        groups: project.groups.map((group) => {
          if (group.id !== action.payload.groupId) {
            return group;
          }

          return {
            ...group,
            ...action.payload.colors,
          };
        }),
      });
    case "set-group-locked":
      return touchProject({
        ...project,
        groups: project.groups.map((group) => {
          if (group.id !== action.payload.groupId) {
            return group;
          }

          return {
            ...group,
            locked: action.payload.locked,
          };
        }),
      });
    case "set-group-annotations":
      return touchProject({
        ...project,
        groups: project.groups.map((group) => {
          if (group.id !== action.payload.groupId) {
            return group;
          }

          return {
            ...group,
            annotations: action.payload.annotations,
          };
        }),
      });
    case "flip-items":
      return touchProject({
        ...project,
        groups: project.groups.map((group) => {
          if (group.id !== action.payload.groupId) {
            return group;
          }

          const itemSet = new Set(action.payload.itemIds);

          return {
            ...group,
            items: group.items.map((item) =>
              itemSet.has(item.id)
                ? { ...item, flippedX: !item.flippedX }
                : item,
            ),
          };
        }),
      });
    case "add-task":
      return touchProject({
        ...project,
        tasks: [
          {
            id: action.payload.id,
            title: action.payload.title || `Task ${project.tasks.length + 1}`,
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
                  ? { title: action.payload.title }
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
            title: `${sourceTask.title} Copy`,
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
    case "remove-task": {
      const nextTasks = project.tasks
        .filter((task) => task.id !== action.payload.taskId)
        .map((task, index) => ({
          ...task,
          order: index,
        }));

      return touchProject({
        ...project,
        tasks: nextTasks,
      });
    }
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
      return project;
  }
};

const shouldRecordHistory = (action: Action) =>
  ![
    "set-project",
    "set-active-group",
    "set-group-view",
    "undo",
    "redo",
    "begin-history-batch",
    "end-history-batch",
  ].includes(action.type);

const pushHistoryEntry = (entries: Project[], project: Project) =>
  [...entries, project].slice(-MAX_HISTORY_ENTRIES);

const preserveTransientViewState = (
  nextProject: Project,
  currentProject: Project,
): Project => ({
  ...nextProject,
  activeGroupId: currentProject.activeGroupId,
  groups: nextProject.groups.map((group) => {
    const currentGroup = currentProject.groups.find(
      (entry) => entry.id === group.id,
    );

    if (!currentGroup) {
      return group;
    }

    return {
      ...group,
      zoom: currentGroup.zoom,
      panX: currentGroup.panX,
      panY: currentGroup.panY,
    };
  }),
});

export const historyReducer = (
  state: HistoryState,
  action: Action,
): HistoryState => {
  switch (action.type) {
    case "set-project":
      return {
        past: [],
        project: cloneProject(action.payload),
        future: [],
        batchBase: null,
      };
    case "undo": {
      if (state.past.length === 0) {
        return state;
      }

      const previous = preserveTransientViewState(
        state.past[state.past.length - 1],
        state.project,
      );
      return {
        past: state.past.slice(0, -1),
        project: previous,
        future: [state.project, ...state.future],
        batchBase: null,
      };
    }
    case "redo": {
      if (state.future.length === 0) {
        return state;
      }

      const next = preserveTransientViewState(state.future[0], state.project);
      return {
        past: pushHistoryEntry(state.past, state.project),
        project: next,
        future: state.future.slice(1),
        batchBase: null,
      };
    }
    case "begin-history-batch":
      return state.batchBase
        ? state
        : {
            ...state,
            batchBase: state.project,
          };
    case "end-history-batch": {
      if (!state.batchBase) {
        return state;
      }

      if (
        projectHistorySignature(state.batchBase) ===
        projectHistorySignature(state.project)
      ) {
        return {
          ...state,
          batchBase: null,
        };
      }

      return {
        past: pushHistoryEntry(state.past, state.batchBase),
        project: state.project,
        future: [],
        batchBase: null,
      };
    }
    default: {
      const nextProject = projectReducer(state.project, action);
      if (nextProject === state.project) {
        return state;
      }

      if (!shouldRecordHistory(action)) {
        return {
          ...state,
          project: nextProject,
        };
      }

      if (state.batchBase) {
        return {
          ...state,
          project: nextProject,
          future: [],
        };
      }

      return {
        past: pushHistoryEntry(state.past, state.project),
        project: nextProject,
        future: [],
        batchBase: null,
      };
    }
  }
};
