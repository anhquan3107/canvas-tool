import { randomUUID } from "node:crypto";
import type { Project, ReferenceGroup, Task } from "../../shared/types/project";
import {
  DEFAULT_EMPTY_GROUP_CANVAS_SIZE,
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "../../shared/project-defaults";

const now = () => new Date().toISOString();

export const createDefaultTodo = (text: string, order: number) => ({
  id: randomUUID(),
  text,
  completed: false,
  order,
});

export const createDefaultTask = (title: string, order: number): Task => ({
  id: randomUUID(),
  title,
  order,
  todos: [
    createDefaultTodo("Collect references", 0),
    createDefaultTodo("Review composition", 1),
  ],
});

export const createDefaultGroup = (
  name: string,
  order: number,
  kind: ReferenceGroup["kind"] = "group",
): ReferenceGroup => ({
  id: randomUUID(),
  name,
  kind,
  order,
  locked: false,
  canvasColor: DEFAULT_GROUP_CANVAS_COLOR,
  backgroundColor: DEFAULT_GROUP_BACKGROUND_COLOR,
  canvasSize: { ...DEFAULT_EMPTY_GROUP_CANVAS_SIZE },
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

export const createDefaultProject = (): Project => {
  const group = createDefaultGroup("Canvas", 0, "canvas");
  const createdAt = now();

  return {
    id: randomUUID(),
    version: 1,
    title: "Untitled",
    canvasSize: { ...DEFAULT_EMPTY_GROUP_CANVAS_SIZE },
    activeGroupId: group.id,
    groups: [group],
    tasks: [createDefaultTask("Main task", 0)],
    createdAt,
    updatedAt: createdAt,
  };
};
