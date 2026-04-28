import type { ShortcutActionId, ShortcutBindings } from "@shared/shortcuts";
import {
  formatMenuShortcut,
  type MenuIconId,
} from "@renderer/app/components/MenuItemContent";
import type { LocaleMessages } from "@renderer/i18n";

export type MenuActionKey =
  | "open"
  | "importTasks"
  | "saveCanvas"
  | "saveCanvasAs"
  | "exportCanvasImage"
  | "exportGroupImages"
  | "exportSelectedTaskHtml"
  | "exportAllTasksHtml"
  | "exportSelectedTaskTxt"
  | "exportAllTasksTxt"
  | "resetView"
  | "fitCanvasToContent"
  | "changeCanvasSize"
  | "toggleCanvasLock"
  | "toggleSwatches"
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
  shortcutActionId?: ShortcutActionId;
}

export const MENU_ACTION_META: Record<MenuActionKey, MenuActionMeta> = {
  open: { icon: "open", shortcutActionId: "file.open" },
  importTasks: { icon: "task" },
  saveCanvas: { icon: "save", shortcutActionId: "file.save" },
  saveCanvasAs: {
    icon: "saveAs",
    shortcutActionId: "file.saveAs",
  },
  exportCanvasImage: {
    icon: "export",
    shortcutActionId: "export.canvasImage",
  },
  exportGroupImages: {
    icon: "export",
    shortcutActionId: "export.groupImages",
  },
  exportSelectedTaskHtml: {
    icon: "task",
  },
  exportAllTasksHtml: {
    icon: "task",
    shortcutActionId: "export.allTasks",
  },
  exportSelectedTaskTxt: {
    icon: "task",
  },
  exportAllTasksTxt: {
    icon: "task",
  },
  resetView: {
    icon: "resetView",
    shortcutActionId: "canvas.fitToWindow",
  },
  fitCanvasToContent: {
    icon: "resetView",
    shortcutActionId: "canvas.resetView",
  },
  changeCanvasSize: {
    icon: "canvasSize",
    shortcutActionId: "canvas.changeSize",
  },
  toggleCanvasLock: {
    icon: "lock",
    shortcutActionId: "canvas.toggleLock",
  },
  toggleSwatches: {
    icon: "swatch",
    shortcutActionId: "canvas.toggleSwatches",
  },
  createGroup: {
    icon: "group",
    shortcutActionId: "groups.create",
  },
  deleteCurrentGroup: { icon: "delete" },
  addTask: { icon: "task", shortcutActionId: "tasks.add" },
  autoArrange: {
    icon: "arrange",
    shortcutActionId: "arrange.auto",
  },
  changeBackgroundColor: {
    icon: "background",
  },
  filterBlackAndWhite: {
    icon: "filter",
    shortcutActionId: "tools.toggleBlackAndWhite",
  },
  filterBlur: {
    icon: "filter",
    shortcutActionId: "tools.toggleBlur",
  },
  doodle: {
    icon: "doodle",
    shortcutActionId: "tools.toggleDoodle",
  },
  keyboardShortcut: {
    icon: "shortcuts",
    shortcutActionId: "window.showSettings",
  },
  paste: { icon: "paste", shortcutActionId: "edit.paste" },
  crop: { icon: "crop", shortcutActionId: "edit.crop" },
  flipHorizontal: {
    icon: "flip",
    shortcutActionId: "edit.flipHorizontal",
  },
  exit: { icon: "exit", shortcutActionId: "app.quit" },
  copy: { icon: "copy", shortcutActionId: "edit.copy" },
  cut: { icon: "cut", shortcutActionId: "edit.cut" },
  delete: { icon: "delete", shortcutActionId: "edit.delete" },
  exportSwatches: { icon: "swatch" },
  arrangePinterest: { icon: "arrange" },
  arrangeHorizontal: {
    icon: "arrange",
    shortcutActionId: "arrange.horizontal",
  },
  undo: { icon: "undo", shortcutActionId: "edit.undo" },
  redo: { icon: "redo", shortcutActionId: "edit.redo" },
};

export const getMenuActionContentProps = (
  shortcutBindings: ShortcutBindings,
  actionKey: MenuActionKey,
  labels: LocaleMessages["menu"]["actions"],
) => {
  const meta = MENU_ACTION_META[actionKey];
  return {
    icon: meta.icon,
    label: labels[actionKey],
    shortcut: formatMenuShortcut(shortcutBindings, meta.shortcutActionId),
  };
};
