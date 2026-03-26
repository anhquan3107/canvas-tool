import { randomUUID } from "node:crypto";
import type {
  ImageItem,
  Project,
  ReferenceGroup,
  Task,
} from "../../shared/types/project";

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
): ReferenceGroup => ({
  id: randomUUID(),
  name,
  order,
  canvasSize: {
    width: 2400,
    height: 1600,
  },
  zoom: 1,
  panX: 120,
  panY: 120,
  layoutMode: "pinterest-dynamic",
  filters: {
    blur: 0,
    grayscale: 0,
  },
  items: [
    {
      id: randomUUID(),
      type: "image",
      x: 180,
      y: 140,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      width: 280,
      height: 220,
      flippedX: false,
      locked: false,
      visible: true,
      zIndex: 0,
      source: "local",
      label: "Reference 1",
    } satisfies ImageItem,
    {
      id: randomUUID(),
      type: "image",
      x: 520,
      y: 240,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      width: 360,
      height: 260,
      flippedX: false,
      locked: false,
      visible: true,
      zIndex: 1,
      source: "local",
      label: "Reference 2",
    } satisfies ImageItem,
  ],
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
    canvasSize: {
      width: 2400,
      height: 1600,
    },
    activeGroupId: group.id,
    groups: [group],
    tasks: [createDefaultTask("Main task", 0)],
    createdAt,
    updatedAt: createdAt,
  };
};
