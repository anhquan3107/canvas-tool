import type { ReferenceGroup } from "@shared/types/project";
import type { ShortcutBindings } from "@shared/shortcuts";
import { TopBarHoverTooltip } from "@renderer/app/components/TopBarHoverTooltip";
import { formatMenuShortcut } from "@renderer/app/components/MenuItemContent";
import {
  TOOL_ORDER,
  getToolTooltipMeta,
  type TitleBarTooltipMeta,
} from "@renderer/app/components/topbar-tool-config";
import { useI18n } from "@renderer/i18n";
import type { ToolMode } from "@renderer/features/tools/types";

const buildHoverLabel = (label: string, shortcut?: string) =>
  shortcut ? `${label} (${shortcut})` : label;

interface TopBarToolsProps {
  activeGroup: ReferenceGroup | null | undefined;
  activeTool: ToolMode | null;
  shortcutBindings: ShortcutBindings;
  runTitleBarAction: (meta: TitleBarTooltipMeta, action: () => void) => void;
  onToolClick: (tool: ToolMode) => void;
  onTaskClick: () => void;
  onCreateGroup: () => void;
}

export const TopBarTools = ({
  activeGroup,
  activeTool,
  shortcutBindings,
  runTitleBarAction,
  onToolClick,
  onTaskClick,
  onCreateGroup,
}: TopBarToolsProps) => {
  const { copy } = useI18n();
  const tooltipMeta = getToolTooltipMeta(copy);

  return (
    <>
      {TOOL_ORDER.map((tool) => (
        <TopBarHoverTooltip
          key={tool}
          label={buildHoverLabel(
            copy.topbar.toolHoverActions[tool],
            formatMenuShortcut(shortcutBindings, tooltipMeta[tool]?.shortcutActionId),
          )}
        >
          <button
            type="button"
            className={`toolbar-button ${
              activeTool === tool ||
              (tool === "blur" && (activeGroup?.filters.blur ?? 0) > 0) ||
              (tool === "bw" && (activeGroup?.filters.grayscale ?? 0) > 0)
                ? "active"
                : ""
            }`}
            onClick={() =>
              runTitleBarAction(
                tooltipMeta[tool] ?? {
                  id: `topbar.tool.${tool}`,
                  label: copy.tools.labels[tool],
                  description: copy.tools.guides[tool],
                },
                () => onToolClick(tool),
              )
            }
          >
            {copy.tools.labels[tool]}
          </button>
        </TopBarHoverTooltip>
      ))}

      <TopBarHoverTooltip
        label={buildHoverLabel(
          copy.topbar.toolHoverActions.task,
          formatMenuShortcut(shortcutBindings, "tasks.add"),
        )}
      >
        <button
          type="button"
          className="toolbar-button"
          onClick={() =>
            runTitleBarAction(
              {
                id: "topbar.task",
                label: copy.topbar.taskGuide.label,
                description: copy.topbar.taskGuide.description,
                shortcutActionId: "tasks.add",
              },
              onTaskClick,
            )
          }
        >
          {copy.tasks.taskButton}
        </button>
      </TopBarHoverTooltip>
      <TopBarHoverTooltip
        label={buildHoverLabel(
          copy.topbar.toolHoverActions.createGroup,
          formatMenuShortcut(shortcutBindings, "groups.create"),
        )}
      >
        <button
          type="button"
          className="toolbar-button"
          onClick={() =>
            runTitleBarAction(
              {
                id: "topbar.createGroup",
                label: copy.topbar.createGroupGuide.label,
                description: copy.topbar.createGroupGuide.description,
                shortcutActionId: "groups.create",
              },
              onCreateGroup,
            )
          }
        >
          {copy.tasks.createGroupButton}
        </button>
      </TopBarHoverTooltip>
    </>
  );
};
