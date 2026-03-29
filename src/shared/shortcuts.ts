export type ShortcutSection =
  | "File"
  | "Edit"
  | "Canvas / View"
  | "Groups / Tasks"
  | "Arrange"
  | "Tools"
  | "Window / App";

export type ShortcutActionId =
  | "file.open"
  | "file.save"
  | "file.saveAs"
  | "export.canvasImage"
  | "export.groupImages"
  | "export.allTasks"
  | "edit.undo"
  | "edit.redo"
  | "edit.cut"
  | "edit.copy"
  | "edit.paste"
  | "edit.delete"
  | "canvas.resetView"
  | "canvas.changeSize"
  | "canvas.toggleLock"
  | "canvas.clearTransientUi"
  | "canvas.panHand"
  | "groups.create"
  | "tasks.add"
  | "arrange.auto"
  | "arrange.horizontal"
  | "arrange.toggleSnap"
  | "arrange.toggleAutoArrangeOnImport"
  | "tools.connect"
  | "tools.toggleDoodle"
  | "tools.doodleBrush"
  | "tools.doodleEraser"
  | "tools.toggleBlur"
  | "tools.toggleBlackAndWhite"
  | "window.toggleAlwaysOnTop"
  | "app.quit"
  | "window.closeAuxiliary";

export interface ShortcutDefinition {
  id: ShortcutActionId;
  section: ShortcutSection;
  label: string;
  defaultBinding: string;
  hint?: string;
}

export type ShortcutBindings = Record<ShortcutActionId, string>;

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  { id: "file.open", section: "File", label: "Open", defaultBinding: "Ctrl+O" },
  { id: "file.save", section: "File", label: "Save Canvas", defaultBinding: "Ctrl+S" },
  {
    id: "file.saveAs",
    section: "File",
    label: "Save Canvas As",
    defaultBinding: "Ctrl+Shift+S",
  },
  {
    id: "export.canvasImage",
    section: "File",
    label: "Export Canvas to Image",
    defaultBinding: "Ctrl+E",
  },
  {
    id: "export.groupImages",
    section: "File",
    label: "Export Images to Folder",
    defaultBinding: "Ctrl+Shift+E",
  },
  {
    id: "export.allTasks",
    section: "File",
    label: "Export All Tasks",
    defaultBinding: "Ctrl+Shift+T",
  },
  { id: "edit.undo", section: "Edit", label: "Undo", defaultBinding: "Ctrl+Z" },
  {
    id: "edit.redo",
    section: "Edit",
    label: "Redo",
    defaultBinding: "Ctrl+Shift+Z",
  },
  { id: "edit.cut", section: "Edit", label: "Cut", defaultBinding: "Ctrl+X" },
  { id: "edit.copy", section: "Edit", label: "Copy", defaultBinding: "Ctrl+C" },
  { id: "edit.paste", section: "Edit", label: "Paste", defaultBinding: "Ctrl+V" },
  { id: "edit.delete", section: "Edit", label: "Delete Selected", defaultBinding: "Delete" },
  {
    id: "canvas.resetView",
    section: "Canvas / View",
    label: "Reset View",
    defaultBinding: "Ctrl+Shift+F",
  },
  {
    id: "canvas.changeSize",
    section: "Canvas / View",
    label: "Change Canvas Size",
    defaultBinding: "Ctrl+Shift+C",
  },
  {
    id: "canvas.toggleLock",
    section: "Canvas / View",
    label: "Lock / Unlock Canvas",
    defaultBinding: "Ctrl+L",
  },
  {
    id: "canvas.panHand",
    section: "Canvas / View",
    label: "Temporary Pan Hand",
    defaultBinding: "Space",
    hint: "Hold while dragging on the canvas",
  },
  {
    id: "canvas.clearTransientUi",
    section: "Canvas / View",
    label: "Close Overlays / Clear Transient UI",
    defaultBinding: "Escape",
  },
  {
    id: "groups.create",
    section: "Groups / Tasks",
    label: "Create Group",
    defaultBinding: "Ctrl+G",
  },
  {
    id: "tasks.add",
    section: "Groups / Tasks",
    label: "Add Task",
    defaultBinding: "Ctrl+T",
  },
  {
    id: "arrange.auto",
    section: "Arrange",
    label: "Auto Arrange",
    defaultBinding: "Ctrl+Alt+A",
  },
  {
    id: "arrange.horizontal",
    section: "Arrange",
    label: "Arrange Horizontal",
    defaultBinding: "Ctrl+Alt+H",
  },
  {
    id: "arrange.toggleSnap",
    section: "Arrange",
    label: "Toggle Snap",
    defaultBinding: "Ctrl+;",
  },
  {
    id: "arrange.toggleAutoArrangeOnImport",
    section: "Arrange",
    label: "Toggle Auto Arrange on Import",
    defaultBinding: "Ctrl+Shift+A",
  },
  {
    id: "tools.connect",
    section: "Tools",
    label: "Connect",
    defaultBinding: "Ctrl+K",
  },
  {
    id: "tools.toggleDoodle",
    section: "Tools",
    label: "Toggle Doodle Mode",
    defaultBinding: "Ctrl+D",
  },
  {
    id: "tools.doodleBrush",
    section: "Tools",
    label: "Brush (inside Doodle)",
    defaultBinding: "B",
  },
  {
    id: "tools.doodleEraser",
    section: "Tools",
    label: "Eraser (inside Doodle)",
    defaultBinding: "E",
  },
  {
    id: "tools.toggleBlur",
    section: "Tools",
    label: "Blur",
    defaultBinding: "Ctrl+B",
  },
  {
    id: "tools.toggleBlackAndWhite",
    section: "Tools",
    label: "B&W",
    defaultBinding: "Ctrl+Y",
  },
  {
    id: "window.toggleAlwaysOnTop",
    section: "Window / App",
    label: "Always on Top",
    defaultBinding: "Ctrl+Shift+P",
  },
  {
    id: "app.quit",
    section: "Window / App",
    label: "Quit App",
    defaultBinding: "Ctrl+Q",
  },
  {
    id: "window.closeAuxiliary",
    section: "Window / App",
    label: "Close Current Auxiliary Window",
    defaultBinding: "Ctrl+W",
  },
];

export const DEFAULT_SHORTCUT_BINDINGS = Object.fromEntries(
  SHORTCUT_DEFINITIONS.map((definition) => [definition.id, definition.defaultBinding]),
) as ShortcutBindings;

export const resolveShortcutBindings = (
  candidate?: Partial<Record<ShortcutActionId, string>>,
) => {
  const nextBindings = { ...DEFAULT_SHORTCUT_BINDINGS };

  if (!candidate) {
    return nextBindings;
  }

  SHORTCUT_DEFINITIONS.forEach((definition) => {
    const nextValue = candidate[definition.id];
    if (typeof nextValue === "string" && nextValue.trim().length > 0) {
      nextBindings[definition.id] = nextValue.trim();
    }
  });

  return nextBindings;
};
