import type { ShortcutActionId, ShortcutBindings } from "@shared/shortcuts";
import {
  formatMenuShortcut,
  type MenuIconId,
} from "@renderer/app/components/MenuItemContent";

export type MenuActionKey =
  | "open"
  | "saveCanvas"
  | "saveCanvasAs"
  | "exportCanvasImage"
  | "exportGroupImages"
  | "exportSelectedTaskHtml"
  | "exportAllTasksHtml"
  | "resetView"
  | "changeCanvasSize"
  | "toggleCanvasLock"
  | "createGroup"
  | "deleteCurrentGroup"
  | "addTask"
  | "autoArrange"
  | "changeBackgroundColor"
  | "filterBlackAndWhite"
  | "filterBlur"
  | "doodle"
  | "keyboardShortcut"
  | "paste"
  | "crop"
  | "flipHorizontal"
  | "exit"
  | "copy"
  | "cut"
  | "delete"
  | "exportSwatches"
  | "arrangePinterest"
  | "arrangeHorizontal"
  | "undo"
  | "redo";

interface MenuActionMeta {
  icon: MenuIconId;
  label: string;
  shortcutActionId?: ShortcutActionId;
}

export const MENU_ACTION_META: Record<MenuActionKey, MenuActionMeta> = {
  open: { icon: "open", label: "Open", shortcutActionId: "file.open" },
  saveCanvas: { icon: "save", label: "Save Canvas", shortcutActionId: "file.save" },
  saveCanvasAs: {
    icon: "saveAs",
    label: "Save Canvas As...",
    shortcutActionId: "file.saveAs",
  },
  exportCanvasImage: {
    icon: "export",
    label: "Export Canvas to Images",
    shortcutActionId: "export.canvasImage",
  },
  exportGroupImages: {
    icon: "export",
    label: "Export Every Image to Folder",
    shortcutActionId: "export.groupImages",
  },
  exportSelectedTaskHtml: {
    icon: "task",
    label: "Export Selected Task to HTML",
  },
  exportAllTasksHtml: {
    icon: "task",
    label: "Export All Tasks to HTML",
    shortcutActionId: "export.allTasks",
  },
  resetView: {
    icon: "resetView",
    label: "Reset View",
    shortcutActionId: "canvas.resetView",
  },
  changeCanvasSize: {
    icon: "canvasSize",
    label: "Change Canvas Size...",
    shortcutActionId: "canvas.changeSize",
  },
  toggleCanvasLock: {
    icon: "lock",
    label: "Lock Canvas",
    shortcutActionId: "canvas.toggleLock",
  },
  createGroup: {
    icon: "group",
    label: "Create Group",
    shortcutActionId: "groups.create",
  },
  deleteCurrentGroup: { icon: "delete", label: "Delete Current Group" },
  addTask: { icon: "task", label: "Add Task", shortcutActionId: "tasks.add" },
  autoArrange: {
    icon: "arrange",
    label: "Auto Arrange",
    shortcutActionId: "arrange.auto",
  },
  changeBackgroundColor: {
    icon: "background",
    label: "Change Background Color",
  },
  filterBlackAndWhite: {
    icon: "filter",
    label: "B&W",
    shortcutActionId: "tools.toggleBlackAndWhite",
  },
  filterBlur: {
    icon: "filter",
    label: "Blur",
    shortcutActionId: "tools.toggleBlur",
  },
  doodle: {
    icon: "doodle",
    label: "Doodle",
    shortcutActionId: "tools.toggleDoodle",
  },
  keyboardShortcut: { icon: "shortcuts", label: "Keyboard Shortcut" },
  paste: { icon: "paste", label: "Paste", shortcutActionId: "edit.paste" },
  crop: { icon: "crop", label: "Crop", shortcutActionId: "edit.crop" },
  flipHorizontal: {
    icon: "flip",
    label: "Flip Horizontal",
    shortcutActionId: "edit.flipHorizontal",
  },
  exit: { icon: "exit", label: "Exit", shortcutActionId: "app.quit" },
  copy: { icon: "copy", label: "Copy", shortcutActionId: "edit.copy" },
  cut: { icon: "cut", label: "Cut", shortcutActionId: "edit.cut" },
  delete: { icon: "delete", label: "Delete", shortcutActionId: "edit.delete" },
  exportSwatches: { icon: "swatch", label: "Export Swatches" },
  arrangePinterest: { icon: "arrange", label: "Pinterest" },
  arrangeHorizontal: {
    icon: "arrange",
    label: "Horizontal",
    shortcutActionId: "arrange.horizontal",
  },
  undo: { icon: "undo", label: "Undo", shortcutActionId: "edit.undo" },
  redo: { icon: "redo", label: "Redo", shortcutActionId: "edit.redo" },
};

export const getMenuActionContentProps = (
  shortcutBindings: ShortcutBindings,
  actionKey: MenuActionKey,
) => {
  const meta = MENU_ACTION_META[actionKey];
  return {
    icon: meta.icon,
    label: meta.label,
    shortcut: formatMenuShortcut(shortcutBindings, meta.shortcutActionId),
  };
};
