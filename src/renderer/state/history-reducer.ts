import type { Project } from "@shared/types/project";
import type { Action, HistoryState } from "@renderer/state/project-store-types";
import { reduceGroupAction } from "@renderer/state/group-reducer";
import { reduceTaskAction } from "@renderer/state/task-reducer";
import { reduceTodoAction } from "@renderer/state/todo-reducer";
import {
  cloneProject,
  preserveTransientViewState,
  projectHistorySignature,
  pushHistoryEntry,
  shouldRecordHistory,
} from "@renderer/state/store-helpers";

const projectReducer = (project: Project, action: Action): Project => {
  if (action.type === "set-project") {
    return action.payload;
  }

  if (
    action.type === "undo" ||
    action.type === "redo" ||
    action.type === "begin-history-batch" ||
    action.type === "end-history-batch"
  ) {
    return project;
  }

  return (
    reduceGroupAction(project, action) ??
    reduceTaskAction(project, action) ??
    reduceTodoAction(project, action) ??
    project
  );
};

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
