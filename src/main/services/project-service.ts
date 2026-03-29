import { randomUUID } from "node:crypto";
import type { Project, ReferenceGroup, Task } from "../../shared/types/project";

const now = () => new Date().toISOString();
const DEFAULT_CANVAS_SIZE = {
  width: 980,
  height: 640,
};

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
): ReferenceGroup => ({
  id: randomUUID(),
  name,
  order,
  canvasSize: { ...DEFAULT_CANVAS_SIZE },
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
  const group = createDefaultGroup("Group 1", 0);
  const createdAt = now();

  return {
    id: randomUUID(),
    version: 1,
    title: "Untitled",
    canvasSize: { ...DEFAULT_CANVAS_SIZE },
    activeGroupId: group.id,
    groups: [group],
    tasks: [createDefaultTask("Main task", 0)],
    createdAt,
    updatedAt: createdAt,
  };
};
