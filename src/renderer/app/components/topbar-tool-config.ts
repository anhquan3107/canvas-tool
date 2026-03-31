import type { ShortcutActionId } from "@shared/shortcuts";
import { TOOL_LABELS, TOOL_ORDER } from "@renderer/features/tools/constants";
import type { ToolMode } from "@renderer/features/tools/types";

export { TOOL_LABELS, TOOL_ORDER };

export type TitleBarTooltipMeta = {
  id: string;
  label: string;
  description: string;
  shortcutActionId?: ShortcutActionId;
};

export type PendingTitleBarAction = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  action: () => void;
};

export const TOOL_TOOLTIP_META: Partial<Record<ToolMode, TitleBarTooltipMeta>> = {
  connect: {
    id: "topbar.tool.connect",
    label: "Connect",
    description:
      "Open the live capture tool so you can pull windows or screens into the board as reference.",
    shortcutActionId: "tools.connect",
  },
  doodle: {
    id: "topbar.tool.doodle",
    label: "Doodle",
    description:
      "Enter freehand annotation mode to sketch, mark up, or trace directly on the canvas.",
    shortcutActionId: "tools.toggleDoodle",
  },
  blur: {
    id: "topbar.tool.blur",
    label: "Blur",
    description:
      "Toggle blur on the active group to soften reference images and reduce detail while you study shape.",
    shortcutActionId: "tools.toggleBlur",
  },
  bw: {
    id: "topbar.tool.bw",
    label: "Black & White",
    description:
      "Switch the active group into grayscale so you can focus on values, contrast, and composition.",
    shortcutActionId: "tools.toggleBlackAndWhite",
  },
  ruler: {
    id: "topbar.tool.ruler",
    label: "Ruler",
    description:
      "Open ruler and measurement tools to check scale, spacing, and proportions on the board.",
  },
};
