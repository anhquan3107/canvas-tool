import {
  createContext,
  useCallback,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  AnnotationStroke,
  CanvasItem,
  GroupFilters,
  Project,
  ReferenceGroup,
  Task,
} from "@shared/types/project";
import { historyReducer } from "@renderer/state/project-store-reducer";
import type { CanvasItemPatch, Store } from "@renderer/state/project-store-types";

const randomUUID = () => crypto.randomUUID();

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

  const renameGroup = useCallback((groupId: string, name: string) => {
    dispatch({ type: "rename-group", payload: { groupId, name } });
  }, []);

  const removeGroup = useCallback((groupId: string) => {
    dispatch({ type: "remove-group", payload: { groupId } });
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

  const updateTask = useCallback(
    (
      taskId: string,
      updates: Partial<Pick<Task, "title" | "startDate" | "endDate">>,
    ) => {
      dispatch({ type: "update-task", payload: { taskId, ...updates } });
    },
    [],
  );

  const completeTask = useCallback((taskId: string, completed: boolean) => {
    dispatch({ type: "complete-task", payload: { taskId, completed } });
  }, []);

  const linkTaskToGroup = useCallback((taskId: string, groupId?: string) => {
    dispatch({ type: "link-task-group", payload: { taskId, groupId } });
  }, []);

  const removeTask = useCallback((taskId: string) => {
    dispatch({ type: "remove-task", payload: { taskId } });
  }, []);

  const addTodo = useCallback((taskId: string, text: string) => {
    dispatch({ type: "add-todo", payload: { taskId, text } });
  }, []);

  const removeTodo = useCallback((taskId: string, todoId: string) => {
    dispatch({ type: "remove-todo", payload: { taskId, todoId } });
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
      renameGroup,
      removeGroup,
      setGroupFilters,
      setGroupCanvasSize,
      setGroupColors,
      setGroupLocked,
      setGroupAnnotations,
      flipItems,
      addTask,
      updateTask,
      completeTask,
      linkTaskToGroup,
      removeTask,
      addTodo,
      removeTodo,
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
      renameGroup,
      removeGroup,
      setGroupFilters,
      setGroupCanvasSize,
      setGroupColors,
      setGroupLocked,
      setGroupAnnotations,
      flipItems,
      addTask,
      updateTask,
      completeTask,
      linkTaskToGroup,
      removeTask,
      addTodo,
      removeTodo,
      toggleTodo,
      renameTodo,
      reorderTodo,
    ],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
};
