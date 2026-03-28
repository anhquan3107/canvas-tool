import { startTransition } from "react";
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
}

export const TaskOverlay = ({
  tasks,
  primaryTask,
  selectedTaskId,
  expanded,
  onToggleExpanded,
  onSelectTask,
}: TaskOverlayProps) => {
  const remainingTasks = tasks.filter((task) => task.id !== primaryTask.id);
  const showingDetails = selectedTaskId === primaryTask.id;

  return (
    <section className="task-overlay-shell">
      <button
        type="button"
        className="task-summary-card"
        onClick={() =>
          startTransition(() => {
            onSelectTask(primaryTask.id);
          })
        }
      >
        <span className="task-summary-dot" />
        <div className="task-summary-copy">
          <strong>{primaryTask.title}</strong>
          {showingDetails ? (
            <span>{formatTaskDateRange(primaryTask.startDate, primaryTask.endDate)}</span>
          ) : null}
        </div>
        {showingDetails ? (
          <span className="task-summary-remaining">
            {getTaskRemainingLabel(primaryTask.endDate)}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        className={`task-overlay-toggle ${expanded ? "open" : ""}`}
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-label={expanded ? "Hide tasks" : "Show tasks"}
      >
        {expanded ? "▴" : "▾"}
      </button>

      {expanded && remainingTasks.length > 0 ? (
        <div className="task-list-popover">
          {remainingTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className="task-list-item"
              onClick={() =>
                startTransition(() => {
                  onSelectTask(task.id);
                })
              }
            >
              <span className="task-chip-dot" />
              <span>{task.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
};
