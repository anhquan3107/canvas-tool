import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
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
import { useI18n } from "@renderer/i18n";
import {
  clampTaskTitle,
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
  onHoverChange: (hovered: boolean) => void;
  onFocusWithinChange: (focused: boolean) => void;
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
const TASK_META_HIDE_DURATION_MS = 640;
type TaskMenuState = {
  taskId: string;
  x: number;
  y: number;
};

const getTaskToneClass = (task: Task) => {
  if (isTaskComplete(task)) {
    return "task-tone-complete";
  }

  return `task-tone-${getTaskDeadlineTone(task.endDate)}`;
};

const getDisplayTaskTitle = (title: string) => {
  const normalized = title.trim();
  return clampTaskTitle(normalized);
};

interface TaskButtonProps {
  task: Task;
  compact: boolean;
  selectedTaskId: string | null;
  expanded: boolean;
  primaryTaskId: string;
  taskCount: number;
  renderPrimaryMeta: boolean;
  linkedName: string | null;
  onInteract: () => void;
  onToggleExpanded: () => void;
  onSelectTask: (taskId: string) => void;
  onOpenTaskMenu: (event: MouseEvent, taskId: string) => void;
}

const TaskButton = ({
  task,
  compact,
  selectedTaskId,
  expanded,
  primaryTaskId,
  taskCount,
  renderPrimaryMeta,
  linkedName,
  onInteract,
  onToggleExpanded,
  onSelectTask,
  onOpenTaskMenu,
}: TaskButtonProps) => {
  const { copy, locale } = useI18n();
  const toneClass = getTaskToneClass(task);
  const compactExpanded = compact && task.id === selectedTaskId;
  const displayTitle = getDisplayTaskTitle(task.title);
  const showCompactMeta = compact && task.id === selectedTaskId;
  const shouldExpandListOnClick =
    compact && task.id === primaryTaskId && taskCount > 1 && !expanded;
  const taskCompleted = isTaskComplete(task);
  const remainingLabel = taskCompleted
    ? copy.tasks.overlay.taskCompleted
    : getTaskRemainingLabel(task.endDate, locale);

  return (
    <button
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
        if (shouldExpandListOnClick) {
          onToggleExpanded();
        }
        onSelectTask(task.id);
      }}
      onContextMenu={(event) => onOpenTaskMenu(event, task.id)}
      title={task.title}
    >
      <span className={`task-chip-dot ${toneClass}`} />
      <span className={compact ? "task-summary-copy" : "task-list-item-copy"}>
        <strong>{displayTitle}</strong>
        {!compact ? (
          <>
            <small>
              {formatTaskDateRange(
                task.startDate,
                task.endDate,
                locale,
                copy.tasks.dates.noDeadline,
              )}
            </small>
            {linkedName ? <em>{linkedName}</em> : null}
          </>
        ) : showCompactMeta ? (
          <span
            className={`task-summary-meta ${renderPrimaryMeta ? "shown" : "hidden"}`}
            aria-hidden={!renderPrimaryMeta}
          >
            <small>
              {formatTaskDateRange(
                task.startDate,
                task.endDate,
                locale,
                copy.tasks.dates.noDeadline,
              )}
            </small>
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

export const TaskOverlay = (props: TaskOverlayProps) => useTaskOverlay(props);

const useTaskOverlay = ({
  tasks,
  groups,
  primaryTask,
  selectedTaskId,
  expanded,
  onToggleExpanded,
  onSelectTask,
  onInteract,
  onHoverChange,
  onFocusWithinChange,
  onCreateTask,
  onRenameTask,
  onDuplicateTask,
  onDeleteTask,
  onChangeTaskDates,
  onCompleteTask,
  onLinkTaskToGroup,
}: TaskOverlayProps) => {
  const { copy, locale } = useI18n();
  const shellRef = useRef<HTMLElement | null>(null);
  const [renderPrimaryMeta, setRenderPrimaryMeta] = useState(Boolean(selectedTaskId));
  const [overlayState, setOverlayState] = useState<{
    renderPopover: boolean;
    menuState: TaskMenuState | null;
  }>(() => ({
    renderPopover: expanded,
    menuState: null,
  }));
  const { renderPopover, menuState } = overlayState;

  const setMenuState = useCallback((menuState: TaskMenuState | null) => {
    setOverlayState((current) => ({
      ...current,
      menuState,
    }));
  }, []);

  useEffect(() => {
    if (expanded) {
      setOverlayState((current) =>
        current.renderPopover ? current : { ...current, renderPopover: true },
      );
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOverlayState((current) => ({
        ...current,
        renderPopover: false,
        menuState: null,
      }));
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    if (selectedTaskId) {
      setRenderPrimaryMeta(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRenderPrimaryMeta(false);
    }, TASK_META_HIDE_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedTaskId]);

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
  }, [menuState, setMenuState]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const syncState = () => {
      onHoverChange(shell.matches(":hover"));
      onFocusWithinChange(shell.contains(document.activeElement));
    };

    syncState();
    const frameId = window.requestAnimationFrame(syncState);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    expanded,
    onFocusWithinChange,
    onHoverChange,
    primaryTask.id,
    renderPopover,
    selectedTaskId,
    tasks.length,
  ]);

  useEffect(() => {
    return () => {
      onHoverChange(false);
      onFocusWithinChange(false);
    };
  }, [onFocusWithinChange, onHoverChange]);

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

  const openTaskMenu = (event: MouseEvent, taskId: string) => {
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

  const selectedMenuTask = tasks.find((task) => task.id === menuState?.taskId) ?? null;
  const getLinkedGroupName = (task: Task) =>
    task.linkedGroupId ? linkedGroups.get(task.linkedGroupId) ?? null : null;

  return (
    <section
      ref={shellRef}
      className={`task-overlay-shell ${expanded ? "task-overlay-shell-open" : ""}`}
      onPointerEnter={() => {
        onHoverChange(true);
        onInteract();
      }}
      onPointerMove={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      onPointerDown={() => {
        onHoverChange(true);
        onInteract();
      }}
      onFocusCapture={() => {
        onFocusWithinChange(true);
        onInteract();
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onFocusWithinChange(false);
        }
      }}
    >
      <div className="task-summary-row">
        <TaskButton
          task={primaryTask}
          compact
          selectedTaskId={selectedTaskId}
          expanded={expanded}
          primaryTaskId={primaryTask.id}
          taskCount={tasks.length}
          renderPrimaryMeta={renderPrimaryMeta}
          linkedName={getLinkedGroupName(primaryTask)}
          onInteract={onInteract}
          onToggleExpanded={onToggleExpanded}
          onSelectTask={onSelectTask}
          onOpenTaskMenu={openTaskMenu}
        />
        {tasks.length > 1 ? (
          <div
            className={[
              "task-summary-toggle-row",
              renderPopover ? "task-summary-toggle-row-hidden" : "",
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
              aria-label={expanded ? copy.tasks.overlay.hideTasks : copy.tasks.overlay.showTasks}
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
          {orderedDisplayTasks.flatMap((task) =>
            task.id === primaryTask.id
              ? []
              : [
                  <TaskButton
                    key={task.id}
                    task={task}
                    compact
                    selectedTaskId={selectedTaskId}
                    expanded={expanded}
                    primaryTaskId={primaryTask.id}
                    taskCount={tasks.length}
                    renderPrimaryMeta={renderPrimaryMeta}
                    linkedName={getLinkedGroupName(task)}
                    onInteract={onInteract}
                    onToggleExpanded={onToggleExpanded}
                    onSelectTask={onSelectTask}
                    onOpenTaskMenu={openTaskMenu}
                  />,
                ],
          )}
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
            <span>{copy.tasks.overlay.rename}</span>
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
            <span>{copy.tasks.overlay.changeDate}</span>
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
            <span>
              {isTaskComplete(selectedMenuTask)
                ? copy.tasks.overlay.markActive
                : copy.tasks.overlay.taskDone}
            </span>
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
            <span>{copy.tasks.overlay.duplicateTask}</span>
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
            <span>{copy.tasks.overlay.newTask}</span>
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
            <span>{copy.tasks.overlay.removeTask}</span>
          </button>
          <div className="task-context-menu-divider" />
          <div className="task-context-menu-section-label">
            {copy.tasks.overlay.linkToGroup}
          </div>
          <button
            type="button"
            className="task-context-menu-item"
            onClick={() => {
              onLinkTaskToGroup(selectedMenuTask.id, undefined);
              setMenuState(null);
            }}
          >
            <Link2 size={14} />
            <span>{copy.common.none}</span>
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
