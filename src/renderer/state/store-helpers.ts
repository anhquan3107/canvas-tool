import type { Project, ReferenceGroup, TodoItem } from "@shared/types/project";
import {
  DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "@shared/project-defaults";
import type { Action } from "@renderer/state/project-store-types";

export const randomUUID = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const MAX_HISTORY_ENTRIES = 100;

export const cloneProject = (project: Project) => structuredClone(project);

export const projectHistorySignature = (project: Project) =>
  JSON.stringify({
    ...project,
    updatedAt: undefined,
  });

export const touchProject = (project: Project): Project => ({
  ...project,
  updatedAt: now(),
});

export const reorderTodos = (todos: TodoItem[]) =>
  todos.map((todo, index) => ({ ...todo, order: index }));

export const createEmptyGroup = (
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

export const createResetCanvasGroup = (
  sourceGroup: ReferenceGroup,
): ReferenceGroup => {
  const resetCanvasGroup = createEmptyGroup(
    sourceGroup.name,
    sourceGroup.order,
    DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
    "canvas",
  );
  resetCanvasGroup.id = sourceGroup.id;
  return resetCanvasGroup;
};

export const cloneGroupSnapshot = (
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

export const shouldRecordHistory = (action: Action) =>
  ![
    "set-project",
    "set-active-group",
    "set-group-view",
    "undo",
    "redo",
    "begin-history-batch",
    "end-history-batch",
  ].includes(action.type);

export const pushHistoryEntry = (entries: Project[], project: Project) =>
  [...entries, project].slice(-MAX_HISTORY_ENTRIES);

export const preserveTransientViewState = (
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
