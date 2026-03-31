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
      "This is not a screen recording feature.\n\nThis feature helps you manage the overall composition of your artwork, check overall light and shadow values.\n\nBy default, you can select Photoshop windows. Uncheck the box and enter the name of other drawing software windows to connect.\n\nYou can connect multiple windows simultaneously. Each window you capture will be a separate window.\n\nAfter connecting, you can apply filters to that window:\nCtrl+B: Blur\nCtrl+Y: Convert to B&W\n\nYou can change quality as desired:\nLow\nMedium\nHigh",
    shortcutActionId: "tools.connect",
  },
  doodle: {
    id: "topbar.tool.doodle",
    label: "Doodle",
    description:
      "Toggle doodle.\nB: Brush.\nE: Eraser.\n[: Decrease brush/eraser size.\n]: Increase brush/eraser size.\nCtrl+Z: Undo.\nCtrl+Shift+Z: Redo.\nDel: Clear all.\nEscape: Exit doodle.\n\nRight-click to save canvas with doodles as image.",
    shortcutActionId: "tools.toggleDoodle",
  },
  blur: {
    id: "topbar.tool.blur",
    label: "Blur",
    description:
      "Toggle blur filter.\n\nWhen blur filter is enabled, a slider appears at bottom-right corner to adjust intensity.\n\nBlur filter applies to ALL images in the canvas. Cannot apply blur to individual images.\n\nUseful for checking overall composition and focus.",
    shortcutActionId: "tools.toggleBlur",
  },
  bw: {
    id: "topbar.tool.bw",
    label: "Black & White",
    description:
      "Toggle B&W filter.\n\nB&W filter applies to ALL images in the canvas. Cannot apply B&W to individual images.\n\nUseful for checking value relationships and overall contrast in your artwork.",
    shortcutActionId: "tools.toggleBlackAndWhite",
  },
  ruler: {
    id: "topbar.tool.ruler",
    label: "Ruler",
    description:
      "Toggle grid ruler overlay.\n\nRuler only applies to a single image. Cannot enable ruler when targeting a group of images.\n\nUseful for precise measurements and alignment in your artwork. The ruler settings dialog allows you to customize grid lines and colors.",
    shortcutActionId: "tools.toggleRuler",
  },
};
