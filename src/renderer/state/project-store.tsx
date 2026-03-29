import {
  createContext,
  useCallback,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type {
  AnnotationStroke,
  CanvasItem,
  CanvasItemBase,
  GroupFilters,
  Project,
  ReferenceGroup,
  Task,
  TodoItem,
} from "@shared/types/project";
import {
  DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "@shared/project-defaults";

const randomUUID = () => crypto.randomUUID();
type CanvasItemPatch = Partial<Omit<CanvasItemBase, "id" | "type">>;

type Action =
  | { type: "set-project"; payload: Project }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "begin-history-batch" }
  | { type: "end-history-batch" }
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
      payload: { groupId: string; items: CanvasItem[] };
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
  | {
      type: "set-group-colors";
      payload: {
        groupId: string;
        colors: Partial<Pick<ReferenceGroup, "canvasColor" | "backgroundColor">>;
      };
    }
  | {
      type: "set-group-locked";
      payload: { groupId: string; locked: boolean };
    }
  | {
      type: "set-group-annotations";
      payload: { groupId: string; annotations: AnnotationStroke[] };
    }
  | { type: "flip-items"; payload: { groupId: string; itemIds: string[] } }
  | {
      type: "add-task";
      payload: { id: string; title: string; startDate: string; endDate: string };
    }
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
  canUndo: boolean;
  canRedo: boolean;
  dispatch: Dispatch<Action>;
  setProject: (project: Project) => void;
  undo: () => void;
  redo: () => void;
  runHistoryBatch: (callback: () => void) => void;
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
  addGroupItems: (groupId: string, items: CanvasItem[]) => void;
  removeGroupItems: (groupId: string, itemIds: string[]) => void;
  addGroup: (name: string) => void;
  setGroupFilters: (groupId: string, filters: Partial<GroupFilters>) => void;
  setGroupCanvasSize: (groupId: string, width: number, height: number) => void;
  setGroupColors: (
    groupId: string,
    colors: Partial<Pick<ReferenceGroup, "canvasColor" | "backgroundColor">>,
  ) => void;
  setGroupLocked: (groupId: string, locked: boolean) => void;
  setGroupAnnotations: (
    groupId: string,
    annotations: AnnotationStroke[],
  ) => void;
  flipItems: (groupId: string, itemIds: string[]) => void;
  addTask: (title: string, dates: Pick<Task, "startDate" | "endDate">) => string;
  addTodo: (taskId: string, text: string) => void;
  toggleTodo: (taskId: string, todoId: string) => void;
  renameTodo: (taskId: string, todoId: string, text: string) => void;
  reorderTodo: (
    taskId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void;
}

interface HistoryState {
  past: Project[];
  project: Project;
  future: Project[];
  batchBase: Project | null;
}

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
): ReferenceGroup => ({
  id: randomUUID(),
  name,
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
      const nextGroup = createEmptyGroup(
        action.payload.name || `Group ${project.groups.length + 1}`,
        project.groups.length,
        DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
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
          ...project.tasks,
          {
            id: action.payload.id,
            title: action.payload.title || `Task ${project.tasks.length + 1}`,
            order: project.tasks.length,
            startDate: action.payload.startDate,
            endDate: action.payload.endDate,
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
  [...entries, cloneProject(project)].slice(-MAX_HISTORY_ENTRIES);

const historyReducer = (state: HistoryState, action: Action): HistoryState => {
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

      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        project: cloneProject(previous),
        future: [cloneProject(state.project), ...state.future],
        batchBase: null,
      };
    }
    case "redo": {
      if (state.future.length === 0) {
        return state;
      }

      const next = state.future[0];
      return {
        past: pushHistoryEntry(state.past, state.project),
        project: cloneProject(next),
        future: state.future.slice(1),
        batchBase: null,
      };
    }
    case "begin-history-batch":
      return state.batchBase
        ? state
        : {
            ...state,
            batchBase: cloneProject(state.project),
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

export const ProjectContext = createContext<Store | null>(null);

export const ProjectProvider = ({
  initialProject,
  children,
}: {
  initialProject: Project;
  children: ReactNode;
}) => {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    project: initialProject,
    future: [],
    batchBase: null,
  });
  const project = state.project;

  const setProject = useCallback((nextProject: Project) => {
    dispatch({ type: "set-project", payload: nextProject });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
  }, []);

  const runHistoryBatch = useCallback((callback: () => void) => {
    dispatch({ type: "begin-history-batch" });
    callback();
    dispatch({ type: "end-history-batch" });
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

  const addGroupItems = useCallback((groupId: string, items: CanvasItem[]) => {
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

  const setGroupColors = useCallback(
    (
      groupId: string,
      colors: Partial<Pick<ReferenceGroup, "canvasColor" | "backgroundColor">>,
    ) => {
      dispatch({
        type: "set-group-colors",
        payload: { groupId, colors },
      });
    },
    [],
  );

  const setGroupLocked = useCallback((groupId: string, locked: boolean) => {
    dispatch({
      type: "set-group-locked",
      payload: { groupId, locked },
    });
  }, []);

  const setGroupAnnotations = useCallback(
    (groupId: string, annotations: AnnotationStroke[]) => {
      dispatch({
        type: "set-group-annotations",
        payload: { groupId, annotations },
      });
    },
    [],
  );

  const flipItems = useCallback((groupId: string, itemIds: string[]) => {
    dispatch({ type: "flip-items", payload: { groupId, itemIds } });
  }, []);

  const addTask = useCallback(
    (title: string, dates: Pick<Task, "startDate" | "endDate">) => {
      const id = randomUUID();
      dispatch({
        type: "add-task",
        payload: {
          id,
          title,
          startDate: dates.startDate ?? "",
          endDate: dates.endDate ?? "",
        },
      });
      return id;
    },
    [],
  );

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
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      dispatch,
      setProject,
      undo,
      redo,
      runHistoryBatch,
      setActiveGroup,
      setGroupView,
      patchGroupItems,
      addGroupItems,
      removeGroupItems,
      addGroup,
      setGroupFilters,
      setGroupCanvasSize,
      setGroupColors,
      setGroupLocked,
      setGroupAnnotations,
      flipItems,
      addTask,
      addTodo,
      toggleTodo,
      renameTodo,
      reorderTodo,
    }),
    [
      project,
      state.future.length,
      state.past.length,
      setProject,
      undo,
      redo,
      runHistoryBatch,
      setActiveGroup,
      setGroupView,
      patchGroupItems,
      addGroupItems,
      removeGroupItems,
      addGroup,
      setGroupFilters,
      setGroupCanvasSize,
      setGroupColors,
      setGroupLocked,
      setGroupAnnotations,
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
