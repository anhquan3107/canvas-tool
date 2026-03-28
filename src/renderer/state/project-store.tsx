import {
  createContext,
  useCallback,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type {
  CanvasItemBase,
  GroupFilters,
  ImageItem,
  Project,
  ReferenceGroup,
  TodoItem,
} from "@shared/types/project";

const randomUUID = () => crypto.randomUUID();
type CanvasItemPatch = Partial<Omit<CanvasItemBase, "id" | "type">>;

type Action =
  | { type: "set-project"; payload: Project }
  | { type: "set-active-group"; payload: string }
  | {
      type: "set-group-view";
      payload: { groupId: string; zoom: number; panX: number; panY: number };
    }
  | {
      type: "patch-group-items";
      payload: { groupId: string; updates: Record<string, CanvasItemPatch> };
    }
  | {
      type: "add-group-items";
      payload: { groupId: string; items: ImageItem[] };
    }
  | {
      type: "remove-group-items";
      payload: { groupId: string; itemIds: string[] };
    }
  | { type: "add-group"; payload: { name: string } }
  | {
      type: "set-group-filters";
      payload: { groupId: string; filters: Partial<GroupFilters> };
    }
  | {
      type: "set-group-canvas-size";
      payload: { groupId: string; width: number; height: number };
    }
  | { type: "flip-items"; payload: { groupId: string; itemIds: string[] } }
  | { type: "add-task"; payload: { title: string } }
  | { type: "add-todo"; payload: { taskId: string; text: string } }
  | { type: "toggle-todo"; payload: { taskId: string; todoId: string } }
  | {
      type: "rename-todo";
      payload: { taskId: string; todoId: string; text: string };
    }
  | {
      type: "reorder-todo";
      payload: { taskId: string; sourceIndex: number; targetIndex: number };
    };

interface Store {
  project: Project;
  dispatch: Dispatch<Action>;
  setProject: (project: Project) => void;
  setActiveGroup: (groupId: string) => void;
  setGroupView: (
    groupId: string,
    zoom: number,
    panX: number,
    panY: number,
  ) => void;
  patchGroupItems: (
    groupId: string,
    updates: Record<string, CanvasItemPatch>,
  ) => void;
  addGroupItems: (groupId: string, items: ImageItem[]) => void;
  removeGroupItems: (groupId: string, itemIds: string[]) => void;
  addGroup: (name: string) => void;
  setGroupFilters: (groupId: string, filters: Partial<GroupFilters>) => void;
  setGroupCanvasSize: (groupId: string, width: number, height: number) => void;
  flipItems: (groupId: string, itemIds: string[]) => void;
  addTask: (title: string) => void;
  addTodo: (taskId: string, text: string) => void;
  toggleTodo: (taskId: string, todoId: string) => void;
  renameTodo: (taskId: string, todoId: string, text: string) => void;
  reorderTodo: (
    taskId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void;
}

const now = () => new Date().toISOString();

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
): ReferenceGroup => ({
  id: randomUUID(),
  name,
  order,
  canvasSize: { ...canvasSize },
  zoom: 1,
  panX: 120,
  panY: 120,
  layoutMode: "pinterest-dynamic",
  filters: {
    blur: 0,
    grayscale: 0,
  },
  items: [],
  annotations: [],
  extractedSwatches: [],
});

const reducer = (project: Project, action: Action): Project => {
  switch (action.type) {
    case "set-project":
      return action.payload;
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
      const nextGroup = createEmptyGroup(
        action.payload.name || `Group ${project.groups.length + 1}`,
        project.groups.length,
        project.canvasSize,
      );

      return touchProject({
        ...project,
        activeGroupId: nextGroup.id,
        groups: [...project.groups, nextGroup],
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
          ...project.tasks,
          {
            id: randomUUID(),
            title: action.payload.title || `Task ${project.tasks.length + 1}`,
            order: project.tasks.length,
            todos: [],
          },
        ],
      });
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

export const ProjectContext = createContext<Store | null>(null);

export const ProjectProvider = ({
  initialProject,
  children,
}: {
  initialProject: Project;
  children: ReactNode;
}) => {
  const [project, dispatch] = useReducer(reducer, initialProject);

  const setProject = useCallback((nextProject: Project) => {
    dispatch({ type: "set-project", payload: nextProject });
  }, []);

  const setActiveGroup = useCallback((groupId: string) => {
    dispatch({ type: "set-active-group", payload: groupId });
  }, []);

  const setGroupView = useCallback(
    (groupId: string, zoom: number, panX: number, panY: number) => {
      dispatch({
        type: "set-group-view",
        payload: { groupId, zoom, panX, panY },
      });
    },
    [],
  );

  const patchGroupItems = useCallback(
    (groupId: string, updates: Record<string, CanvasItemPatch>) => {
      dispatch({ type: "patch-group-items", payload: { groupId, updates } });
    },
    [],
  );

  const addGroupItems = useCallback((groupId: string, items: ImageItem[]) => {
    dispatch({ type: "add-group-items", payload: { groupId, items } });
  }, []);

  const removeGroupItems = useCallback((groupId: string, itemIds: string[]) => {
    dispatch({ type: "remove-group-items", payload: { groupId, itemIds } });
  }, []);

  const addGroup = useCallback((name: string) => {
    dispatch({ type: "add-group", payload: { name } });
  }, []);

  const setGroupFilters = useCallback(
    (groupId: string, filters: Partial<GroupFilters>) => {
      dispatch({ type: "set-group-filters", payload: { groupId, filters } });
    },
    [],
  );

  const setGroupCanvasSize = useCallback(
    (groupId: string, width: number, height: number) => {
      dispatch({
        type: "set-group-canvas-size",
        payload: { groupId, width, height },
      });
    },
    [],
  );

  const flipItems = useCallback((groupId: string, itemIds: string[]) => {
    dispatch({ type: "flip-items", payload: { groupId, itemIds } });
  }, []);

  const addTask = useCallback((title: string) => {
    dispatch({ type: "add-task", payload: { title } });
  }, []);

  const addTodo = useCallback((taskId: string, text: string) => {
    dispatch({ type: "add-todo", payload: { taskId, text } });
  }, []);

  const toggleTodo = useCallback((taskId: string, todoId: string) => {
    dispatch({ type: "toggle-todo", payload: { taskId, todoId } });
  }, []);

  const renameTodo = useCallback(
    (taskId: string, todoId: string, text: string) => {
      dispatch({ type: "rename-todo", payload: { taskId, todoId, text } });
    },
    [],
  );

  const reorderTodo = useCallback(
    (taskId: string, sourceIndex: number, targetIndex: number) => {
      dispatch({
        type: "reorder-todo",
        payload: { taskId, sourceIndex, targetIndex },
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      project,
      dispatch,
      setProject,
      setActiveGroup,
      setGroupView,
      patchGroupItems,
      addGroupItems,
      removeGroupItems,
      addGroup,
      setGroupFilters,
      setGroupCanvasSize,
      flipItems,
      addTask,
      addTodo,
      toggleTodo,
      renameTodo,
      reorderTodo,
    }),
    [
      project,
      setProject,
      setActiveGroup,
      setGroupView,
      patchGroupItems,
      addGroupItems,
      removeGroupItems,
      addGroup,
      setGroupFilters,
      setGroupCanvasSize,
      flipItems,
      addTask,
      addTodo,
      toggleTodo,
      renameTodo,
      reorderTodo,
    ],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
};
