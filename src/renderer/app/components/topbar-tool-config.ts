import type { ShortcutActionId } from "@shared/shortcuts";
import { TOOL_ORDER } from "@renderer/features/tools/constants";
import type { LocaleMessages } from "@renderer/i18n";
import type { ToolMode } from "@renderer/features/tools/types";

export { TOOL_ORDER };

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

export const getToolTooltipMeta = (
  copy: LocaleMessages,
): Partial<Record<ToolMode, TitleBarTooltipMeta>> => ({
  connect: {
    id: "topbar.tool.connect",
    label: copy.tools.labels.connect,
    description: copy.tools.guides.connect,
    shortcutActionId: "tools.connect",
  },
  doodle: {
    id: "topbar.tool.doodle",
    label: copy.tools.labels.doodle,
    description: copy.tools.guides.doodle,
    shortcutActionId: "tools.toggleDoodle",
  },
  blur: {
    id: "topbar.tool.blur",
    label: copy.tools.labels.blur,
    description: copy.tools.guides.blur,
    shortcutActionId: "tools.toggleBlur",
  },
  bw: {
    id: "topbar.tool.bw",
    label: copy.tools.labels.bw,
    description: copy.tools.guides.bw,
    shortcutActionId: "tools.toggleBlackAndWhite",
  },
  ruler: {
    id: "topbar.tool.ruler",
    label: copy.tools.labels.ruler,
    description: copy.tools.guides.ruler,
    shortcutActionId: "tools.toggleRuler",
  },
});
