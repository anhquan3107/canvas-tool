import { startTransition, useEffect, useState } from "react";
import type { Task } from "@shared/types/project";
import {
  formatTaskDateRange,
  getTaskRemainingLabel,
} from "@renderer/features/tasks/utils";

interface TaskOverlayProps {
  tasks: Task[];
  primaryTask: Task;
  selectedTaskId: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelectTask: (taskId: string) => void;
  onInteract: () => void;
}

export const TaskOverlay = ({
  tasks,
  primaryTask,
  selectedTaskId,
  expanded,
  onToggleExpanded,
  onSelectTask,
  onInteract,
}: TaskOverlayProps) => {
  const showingDetails = selectedTaskId === primaryTask.id;
  const [renderPopover, setRenderPopover] = useState(expanded);
  const primaryTaskDateRange = formatTaskDateRange(
    primaryTask.startDate,
    primaryTask.endDate,
  );
  const primaryTaskRemainingLabel = getTaskRemainingLabel(primaryTask.endDate);
  const showSeparateRemainingLabel =
    primaryTaskDateRange !== primaryTaskRemainingLabel;

  useEffect(() => {
    if (expanded) {
      setRenderPopover(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRenderPopover(false);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [expanded]);

  return (
    <section
      className={`task-overlay-shell ${expanded ? "task-overlay-shell-open" : ""}`}
      onPointerEnter={onInteract}
      onPointerDown={onInteract}
      onFocusCapture={onInteract}
    >
      <div className="task-summary-row">
        <button
          type="button"
          className="task-summary-card"
          onClick={() => {
            onInteract();
            startTransition(() => {
              onSelectTask(primaryTask.id);
            });
          }}
        >
          <span className="task-summary-dot" />
          <div className="task-summary-copy">
            <strong>{primaryTask.title}</strong>
          </div>
        </button>

        <div
          className={
            showingDetails
              ? "task-summary-detail-bubble task-summary-detail-bubble-visible"
              : "task-summary-detail-bubble"
          }
          aria-hidden={!showingDetails}
        >
          <span>{primaryTaskDateRange}</span>
          {showSeparateRemainingLabel ? (
            <strong>{primaryTaskRemainingLabel}</strong>
          ) : null}
        </div>

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
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={
                task.id === selectedTaskId
                  ? "task-list-item task-list-item-active"
                  : "task-list-item"
              }
              onClick={() => {
                onInteract();
                startTransition(() => {
                  onSelectTask(task.id);
                });
              }}
            >
              <span className="task-chip-dot" />
              <span className="task-list-item-copy">
                <strong>{task.title}</strong>
                <small>{formatTaskDateRange(task.startDate, task.endDate)}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
};
