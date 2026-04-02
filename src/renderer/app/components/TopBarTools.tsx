import type { ReferenceGroup } from "@shared/types/project";
import type { ShortcutBindings } from "@shared/shortcuts";
import { TopBarHoverTooltip } from "@renderer/app/components/TopBarHoverTooltip";
import { formatMenuShortcut } from "@renderer/app/components/MenuItemContent";
import {
  TOOL_LABELS,
  TOOL_ORDER,
  TOOL_TOOLTIP_META,
  type TitleBarTooltipMeta,
} from "@renderer/app/components/topbar-tool-config";
import type { ToolMode } from "@renderer/features/tools/types";

const buildHoverLabel = (label: string, shortcut?: string) =>
  shortcut ? `${label} (${shortcut})` : label;

const TOOL_HOVER_ACTION_LABELS: Record<ToolMode, string> = {
  connect: "Connect reference windows",
  doodle: "Draw on the canvas",
  blur: "Toggle blur filter",
  bw: "Toggle black and white",
  ruler: "Show ruler grid",
};

interface TopBarToolsProps {
  activeGroup: ReferenceGroup | null | undefined;
  activeTool: ToolMode | null;
  shortcutBindings: ShortcutBindings;
  runTitleBarAction: (meta: TitleBarTooltipMeta, action: () => void) => void;
  onToolClick: (tool: ToolMode) => void;
  onResetView: () => void;
  onTaskClick: () => void;
  onCreateGroup: () => void;
}

export const TopBarTools = ({
  activeGroup,
  activeTool,
  shortcutBindings,
  runTitleBarAction,
  onToolClick,
  onResetView,
  onTaskClick,
  onCreateGroup,
}: TopBarToolsProps) => (
  <>
    {TOOL_ORDER.map((tool) => (
      <TopBarHoverTooltip
        key={tool}
        label={buildHoverLabel(
          TOOL_HOVER_ACTION_LABELS[tool],
          formatMenuShortcut(shortcutBindings, TOOL_TOOLTIP_META[tool]?.shortcutActionId),
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
              TOOL_TOOLTIP_META[tool] ?? {
                id: `topbar.tool.${tool}`,
                label: TOOL_LABELS[tool],
                description: `Open the ${TOOL_LABELS[tool]} tool from the title bar.`,
              },
              () => onToolClick(tool),
            )
          }
        >
          {TOOL_LABELS[tool]}
        </button>
      </TopBarHoverTooltip>
    ))}

    <TopBarHoverTooltip
      label={buildHoverLabel(
        "Reset the canvas view",
        formatMenuShortcut(shortcutBindings, "canvas.resetView"),
      )}
    >
      <button
        type="button"
        className="toolbar-button"
        onClick={() =>
          runTitleBarAction(
            {
              id: "topbar.resetView",
              label: "Reset View",
              description:
                "Return the canvas camera to its default framing so the board is easy to navigate again.",
              shortcutActionId: "canvas.resetView",
            },
            onResetView,
          )
        }
      >
        Reset View
      </button>
    </TopBarHoverTooltip>
    <TopBarHoverTooltip
      label={buildHoverLabel("Manage tasks", formatMenuShortcut(shortcutBindings, "tasks.add"))}
    >
      <button
        type="button"
        className="toolbar-button"
        onClick={() =>
          runTitleBarAction(
            {
              id: "topbar.task",
              label: "Deadline Management",
              description:
                "Create and manage task deadlines.\n\nSet start and end dates for your tasks. Tasks are displayed at the top-left of the canvas. Click on task will slide todo list panel and simultaneously activate canvas you have linked.\n\nColor coding:\n• Green: 11+ days remaining\n• Orange: 4-10 days remaining\n• Red: 1-3 days remaining\n\nRight-click on tasks to:\n• Change date\n• Mark as done\n• Create new task\n• Remove task\n• Link to canvas/group\n\nRight-click on any empty area and select Add Task.\n\nExport → Export tasks to save all your tasks (including todo lists) as HTML.\n\nPerfect for printing or sharing your work list with others.",
              shortcutActionId: "tasks.add",
            },
            onTaskClick,
          )
        }
      >
        Task
      </button>
    </TopBarHoverTooltip>
    <TopBarHoverTooltip
      label={buildHoverLabel(
        "Create a new group",
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
              label: "Create Group",
              description:
                "Create a new reference group so you can organize images, filters, and layout separately.",
              shortcutActionId: "groups.create",
            },
            onCreateGroup,
          )
        }
      >
        Create Group
      </button>
    </TopBarHoverTooltip>
  </>
);
