import { startTransition, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Copy,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { ReferenceGroup, Task } from "@shared/types/project";
import {
  formatTaskDateRange,
  getTaskDeadlineTone,
  getTaskRemainingLabel,
  isTaskComplete,
} from "@renderer/features/tasks/utils";

interface TaskOverlayProps {
  tasks: Task[];
  groups: ReferenceGroup[];
  primaryTask: Task;
  selectedTaskId: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelectTask: (taskId: string) => void;
  onInteract: () => void;
  onCreateTask: () => void;
  onRenameTask: (taskId: string) => void;
  onDuplicateTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onChangeTaskDates: (taskId: string) => void;
  onCompleteTask: (taskId: string, completed: boolean) => void;
  onLinkTaskToGroup: (taskId: string, groupId?: string) => void;
}

const TASK_MENU_WIDTH = 164;
const TASK_MENU_MARGIN = 12;

const getTaskToneClass = (task: Task) => {
  if (isTaskComplete(task)) {
    return "task-tone-complete";
  }

  return `task-tone-${getTaskDeadlineTone(task.endDate)}`;
};

export const TaskOverlay = ({
  tasks,
  groups,
  primaryTask,
  selectedTaskId,
  expanded,
  onToggleExpanded,
  onSelectTask,
  onInteract,
  onCreateTask,
  onRenameTask,
  onDuplicateTask,
  onDeleteTask,
  onChangeTaskDates,
  onCompleteTask,
  onLinkTaskToGroup,
}: TaskOverlayProps) => {
  const [renderPopover, setRenderPopover] = useState(expanded);
  const [menuState, setMenuState] = useState<{
    taskId: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (expanded) {
      setRenderPopover(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRenderPopover(false);
      setMenuState(null);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [expanded]);

  useEffect(() => {
    if (!menuState) {
      return;
    }

    const closeMenu = () => setMenuState(null);
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("blur", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("blur", closeMenu);
    };
  }, [menuState]);

  const linkedGroups = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  const orderedDisplayTasks = useMemo(() => {
    if (!primaryTask) {
      return tasks;
    }

    return [
      primaryTask,
      ...tasks.filter((task) => task.id !== primaryTask.id),
    ];
  }, [primaryTask, tasks]);

  const openTaskMenu = (event: React.MouseEvent, taskId: string) => {
    event.preventDefault();
    event.stopPropagation();
    onInteract();

    const maxLeft = Math.max(
      TASK_MENU_MARGIN,
      window.innerWidth - TASK_MENU_WIDTH - TASK_MENU_MARGIN,
    );

    setMenuState({
      taskId,
      x: Math.min(event.clientX, maxLeft),
      y: Math.min(event.clientY, window.innerHeight - 240),
    });
  };

  const renderTaskButton = (task: Task, compact = false) => {
    const toneClass = getTaskToneClass(task);
    const linkedName = task.linkedGroupId
      ? linkedGroups.get(task.linkedGroupId) ?? null
      : null;
    const compactExpanded = compact && task.id === selectedTaskId;
    const taskCompleted = isTaskComplete(task);
    const remainingLabel = taskCompleted
      ? "Task Completed"
      : getTaskRemainingLabel(task.endDate);

    return (
      <button
        key={task.id}
        type="button"
        className={[
          compact ? "task-summary-card" : "task-list-item",
          compact && !expanded ? "task-summary-card-primary" : "",
          compact && expanded ? "task-summary-card-stack" : "",
          compactExpanded ? "task-summary-card-expanded" : "",
          task.id === selectedTaskId ? "task-list-item-active" : "",
          toneClass,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          onInteract();
          startTransition(() => {
            onSelectTask(task.id);
          });
        }}
        onContextMenu={(event) => openTaskMenu(event, task.id)}
      >
        <span className={`task-chip-dot ${toneClass}`} />
        <span className={compact ? "task-summary-copy" : "task-list-item-copy"}>
          <strong>{task.title}</strong>
          {!compact ? (
            <>
              <small>{formatTaskDateRange(task.startDate, task.endDate)}</small>
              {linkedName ? <em>{linkedName}</em> : null}
            </>
          ) : compactExpanded ? (
            <span className="task-summary-meta">
              <small>{formatTaskDateRange(task.startDate, task.endDate)}</small>
              <em className={taskCompleted ? "task-summary-meta-complete" : ""}>
                {taskCompleted ? <Check size={12} strokeWidth={2.4} /> : null}
                {remainingLabel}
              </em>
            </span>
          ) : null}
        </span>
      </button>
    );
  };

  const selectedMenuTask = tasks.find((task) => task.id === menuState?.taskId) ?? null;

  return (
    <section
      className={`task-overlay-shell ${expanded ? "task-overlay-shell-open" : ""}`}
      onPointerEnter={onInteract}
      onPointerDown={onInteract}
      onFocusCapture={onInteract}
    >
      <div className="task-summary-row">
        {renderTaskButton(primaryTask, true)}
        {tasks.length > 1 ? (
          <div
            className={[
              "task-summary-toggle-row",
              expanded ? "task-summary-toggle-row-hidden" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              type="button"
              className={`task-overlay-toggle ${expanded ? "open" : ""}`}
              onClick={() => {
                onInteract();
                onToggleExpanded();
              }}
              aria-expanded={expanded}
              aria-label={expanded ? "Hide tasks" : "Show tasks"}
            >
              {expanded ? "▴" : "▾"}
            </button>
          </div>
        ) : null}
      </div>

      {renderPopover ? (
        <div
          className={`task-list-popover ${expanded ? "open" : "closing"}`}
          aria-hidden={!expanded}
        >
          {orderedDisplayTasks
            .filter((task) => task.id !== primaryTask.id)
            .map((task) => renderTaskButton(task, true))}
        </div>
      ) : null}

      {menuState && selectedMenuTask ? (
        <div
          className="task-context-menu"
          style={{ left: `${menuState.x}px`, top: `${menuState.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            className="task-context-menu-item"
            onClick={() => {
              onRenameTask(selectedMenuTask.id);
              setMenuState(null);
            }}
          >
            <Pencil size={14} />
            <span>Rename</span>
          </button>
          <button
            type="button"
            className="task-context-menu-item"
            onClick={() => {
              onChangeTaskDates(selectedMenuTask.id);
              setMenuState(null);
            }}
          >
            <CalendarDays size={14} />
            <span>Change Date</span>
          </button>
          <button
            type="button"
            className="task-context-menu-item"
            onClick={() => {
              onCompleteTask(selectedMenuTask.id, !isTaskComplete(selectedMenuTask));
              setMenuState(null);
            }}
          >
            <Check size={14} />
            <span>{isTaskComplete(selectedMenuTask) ? "Mark Active" : "Task Done"}</span>
          </button>
          <div className="task-context-menu-divider" />
          <button
            type="button"
            className="task-context-menu-item"
            onClick={() => {
              onDuplicateTask(selectedMenuTask.id);
              setMenuState(null);
            }}
          >
            <Copy size={14} />
            <span>Duplicate Task</span>
          </button>
          <button
            type="button"
            className="task-context-menu-item"
            onClick={() => {
              onCreateTask();
              setMenuState(null);
            }}
          >
            <Plus size={14} />
            <span>New Task</span>
          </button>
          <button
            type="button"
            className="task-context-menu-item danger"
            onClick={() => {
              onDeleteTask(selectedMenuTask.id);
              setMenuState(null);
            }}
          >
            <Trash2 size={14} />
            <span>Remove Task</span>
          </button>
          <div className="task-context-menu-divider" />
          <div className="task-context-menu-section-label">Link to canvas/group</div>
          <button
            type="button"
            className="task-context-menu-item"
            onClick={() => {
              onLinkTaskToGroup(selectedMenuTask.id, undefined);
              setMenuState(null);
            }}
          >
            <Link2 size={14} />
            <span>None</span>
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className="task-context-menu-item"
              onClick={() => {
                onLinkTaskToGroup(selectedMenuTask.id, group.id);
                setMenuState(null);
              }}
            >
              <Link2 size={14} />
              <span>{group.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
};
