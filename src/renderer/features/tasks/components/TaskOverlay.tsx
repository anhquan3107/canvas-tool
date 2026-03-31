import { startTransition, useEffect, useMemo, useState } from "react";
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
  onDeleteTask: (taskId: string) => void;
  onChangeTaskDates: (taskId: string) => void;
  onCompleteTask: (taskId: string, completed: boolean) => void;
  onLinkTaskToGroup: (taskId: string, groupId?: string) => void;
}

const TASK_MENU_WIDTH = 164;
const TASK_MENU_MARGIN = 12;

const getTaskToneClass = (task: Task) => {
  if (isTaskComplete(task.todos)) {
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

    return (
      <button
        key={task.id}
        type="button"
        className={[
          compact ? "task-summary-card" : "task-list-item",
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
          <small>{formatTaskDateRange(task.startDate, task.endDate)}</small>
          {linkedName ? <em>{linkedName}</em> : null}
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

      {renderPopover ? (
        <div
          className={`task-list-popover ${expanded ? "open" : "closing"}`}
          aria-hidden={!expanded}
        >
          {tasks.map((task) => renderTaskButton(task))}
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
            onClick={() => {
              onChangeTaskDates(selectedMenuTask.id);
              setMenuState(null);
            }}
          >
            Change Date
          </button>
          <button
            type="button"
            onClick={() => {
              onCompleteTask(selectedMenuTask.id, !isTaskComplete(selectedMenuTask.todos));
              setMenuState(null);
            }}
          >
            {isTaskComplete(selectedMenuTask.todos) ? "Mark Active" : "Mark as Done"}
          </button>
          <button
            type="button"
            onClick={() => {
              onCreateTask();
              setMenuState(null);
            }}
          >
            Create New Task
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              onDeleteTask(selectedMenuTask.id);
              setMenuState(null);
            }}
          >
            Remove Task
          </button>
          <div className="task-context-menu-divider" />
          <div className="task-context-menu-section-label">Link to canvas/group</div>
          <button
            type="button"
            onClick={() => {
              onLinkTaskToGroup(selectedMenuTask.id, undefined);
              setMenuState(null);
            }}
          >
            None
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => {
                onLinkTaskToGroup(selectedMenuTask.id, group.id);
                setMenuState(null);
              }}
            >
              {group.name}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
};
