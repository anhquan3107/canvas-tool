import type { ShortcutActionId, ShortcutBindings } from "@shared/shortcuts";
import {
  ClipboardPaste,
  Copy,
  Expand,
  FolderOpen,
  Keyboard,
  LayoutGrid,
  ListTodo,
  Lock,
  LogOut,
  MonitorUp,
  Palette,
  PencilLine,
  Redo2,
  Rows3,
  Save,
  SaveAll,
  Scissors,
  SlidersHorizontal,
  SwatchBook,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";

export type MenuIconId =
  | "open"
  | "save"
  | "saveAs"
  | "export"
  | "resetView"
  | "canvasSize"
  | "group"
  | "task"
  | "paste"
  | "arrange"
  | "background"
  | "filter"
  | "doodle"
  | "lock"
  | "undo"
  | "redo"
  | "exit"
  | "copy"
  | "cut"
  | "delete"
  | "swatch"
  | "shortcuts";

interface MenuItemContentProps {
  icon: MenuIconId;
  label: string;
  shortcut?: string;
  submenu?: boolean;
}

const isMacPlatform = () =>
  /mac/i.test(
    (() => {
      if (typeof navigator === "undefined") {
        return "";
      }

      const navigatorWithUAData = navigator as Navigator & {
        userAgentData?: { platform?: string };
      };

      return navigatorWithUAData.userAgentData?.platform ?? navigator.platform ?? "";
    })(),
  );

const shortcutTokenLabel = (token: string) => {
  const isMac = isMacPlatform();

  switch (token) {
    case "Ctrl":
      return isMac ? "Cmd" : "Ctrl";
    case "Alt":
      return isMac ? "Opt" : "Alt";
    case "Shift":
      return "Shift";
    case "Delete":
      return isMac ? "Del" : "Delete";
    case "Escape":
      return "Esc";
    case "Return":
      return "Enter";
    default:
      return token;
  }
};

export const formatMenuShortcut = (
  bindings: ShortcutBindings,
  actionId?: ShortcutActionId,
) => {
  if (!actionId) {
    return undefined;
  }

  const binding = bindings[actionId];
  if (!binding) {
    return undefined;
  }

  return binding
    .split("+")
    .map((token) => shortcutTokenLabel(token))
    .join("+");
};

const MENU_ICONS: Record<MenuIconId, LucideIcon> = {
  open: FolderOpen,
  save: Save,
  saveAs: SaveAll,
  export: MonitorUp,
  resetView: MonitorUp,
  canvasSize: Expand,
  group: Rows3,
  task: ListTodo,
  paste: ClipboardPaste,
  arrange: LayoutGrid,
  background: Palette,
  filter: SlidersHorizontal,
  doodle: PencilLine,
  lock: Lock,
  undo: Undo2,
  redo: Redo2,
  exit: LogOut,
  copy: Copy,
  cut: Scissors,
  delete: Trash2,
  swatch: SwatchBook,
  shortcuts: Keyboard,
};

const MenuIcon = ({ icon }: { icon: MenuIconId }) => {
  const Icon = MENU_ICONS[icon];
  return <Icon aria-hidden="true" size={14} strokeWidth={1.8} />;
};

export const MenuItemContent = ({
  icon,
  label,
  shortcut,
  submenu = false,
}: MenuItemContentProps) => (
  <span className="menu-item-content">
    <span className="menu-item-leading">
      <span className="menu-item-icon">
        <MenuIcon icon={icon} />
      </span>
      <span className="menu-item-label">{label}</span>
    </span>
    <span className="menu-item-trailing">
      {shortcut ? <span className="menu-item-shortcut">{shortcut}</span> : null}
      {submenu ? <span className="menu-item-chevron">›</span> : null}
    </span>
  </span>
);
