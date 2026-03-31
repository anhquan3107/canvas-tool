import type { Dispatch } from "react";
import type {
  AnnotationStroke,
  CanvasItem,
  CanvasItemBase,
  GroupFilters,
  Project,
  ReferenceGroup,
  Task,
} from "@shared/types/project";

export type CanvasItemPatch = Partial<Omit<CanvasItemBase, "id" | "type">>;

export type Action =
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
  | { type: "rename-group"; payload: { groupId: string; name: string } }
  | { type: "remove-group"; payload: { groupId: string } }
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
  | {
      type: "update-task";
      payload: {
        taskId: string;
        title?: string;
        completed?: boolean;
        startDate?: string;
        endDate?: string;
      };
    }
  | { type: "complete-task"; payload: { taskId: string; completed: boolean } }
  | { type: "duplicate-task"; payload: { taskId: string; id: string } }
  | { type: "link-task-group"; payload: { taskId: string; groupId?: string } }
  | { type: "remove-task"; payload: { taskId: string } }
  | { type: "add-todo"; payload: { taskId: string; text: string } }
  | { type: "remove-todo"; payload: { taskId: string; todoId: string } }
  | { type: "toggle-todo"; payload: { taskId: string; todoId: string } }
  | {
      type: "rename-todo";
      payload: { taskId: string; todoId: string; text: string };
    }
  | {
      type: "reorder-todo";
      payload: { taskId: string; sourceIndex: number; targetIndex: number };
    };

export interface Store {
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
  renameGroup: (groupId: string, name: string) => void;
  removeGroup: (groupId: string) => void;
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
  updateTask: (
    taskId: string,
    updates: Partial<Pick<Task, "title" | "completed" | "startDate" | "endDate">>,
  ) => void;
  completeTask: (taskId: string, completed: boolean) => void;
  duplicateTask: (taskId: string) => string | null;
  linkTaskToGroup: (taskId: string, groupId?: string) => void;
  removeTask: (taskId: string) => void;
  addTodo: (taskId: string, text: string) => void;
  removeTodo: (taskId: string, todoId: string) => void;
  toggleTodo: (taskId: string, todoId: string) => void;
  renameTodo: (taskId: string, todoId: string, text: string) => void;
  reorderTodo: (
    taskId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void;
}

export interface HistoryState {
  past: Project[];
  project: Project;
  future: Project[];
  batchBase: Project | null;
}
