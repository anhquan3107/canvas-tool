import type { Project } from "@shared/types/project";
import type { Action } from "@renderer/state/project-store-types";
import {
  cloneGroupSnapshot,
  createResetCanvasGroup,
  touchProject,
} from "@renderer/state/store-helpers";

export const reduceGroupAction = (
  project: Project,
  action: Action,
): Project | null => {
  switch (action.type) {
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

      return touchProject({
        ...project,
        activeGroupId: canvasGroup.id,
        groups: project.groups
          .map((group) =>
            group.id === canvasGroup.id
              ? createResetCanvasGroup(canvasGroup)
              : group,
          )
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
    default:
      return null;
  }
};
