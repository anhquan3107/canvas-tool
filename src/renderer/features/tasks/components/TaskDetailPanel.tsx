import { Pin } from "lucide-react";
import type { Task } from "@shared/types/project";
import { TodoList } from "@renderer/features/tasks/components/TodoList";
import {
  formatDateLabel,
  getTaskRemainingLabel,
} from "@renderer/features/tasks/utils";

interface TaskDetailPanelProps {
  task: Task;
  open: boolean;
  pinned: boolean;
  onReveal: () => void;
  onTogglePinned: () => void;
  onDeleteTask: () => void;
  onInteract: () => void;
  onAddTodo: (taskId: string, text: string) => void;
  onToggleTodo: (taskId: string, todoId: string) => void;
  onRenameTodo: (taskId: string, todoId: string, text: string) => void;
  onReorderTodo: (
    taskId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void;
}

export const TaskDetailPanel = ({
  task,
  open,
  pinned,
  onReveal,
  onTogglePinned,
  onDeleteTask,
  onInteract,
  onAddTodo,
  onToggleTodo,
  onRenameTodo,
  onReorderTodo,
}: TaskDetailPanelProps) => {
  const doneCount = task.todos.filter((todo) => todo.completed).length;
  const activeCount = task.todos.length - doneCount;

  return (
    <div
      className={`task-detail-shell ${open ? "open" : ""}`}
      onPointerEnter={onInteract}
      onPointerDown={onInteract}
      onFocusCapture={onInteract}
      onKeyDownCapture={onInteract}
    >
      <div
        className="task-detail-hover-zone"
        onPointerEnter={() => {
          if (!open) {
            onReveal();
          }
        }}
        aria-hidden="true"
      />

      <aside
        className={`task-detail-panel overlay-panel ${open ? "open" : "closed"}`}
        aria-hidden={!open}
      >
        <header className="task-detail-header">
          <div className="task-detail-title-row">
            <strong>{task.title}</strong>
            <div className="task-detail-actions">
              <button
                type="button"
                className={`task-detail-pin-button ${pinned ? "active" : ""}`}
                onClick={onTogglePinned}
                aria-pressed={pinned}
                aria-label={pinned ? "Unpin task panel" : "Pin task panel"}
                title={pinned ? "Unpin task panel" : "Pin task panel"}
              >
                <Pin size={15} strokeWidth={1.85} />
              </button>
              <button
                type="button"
                className="task-detail-delete"
                onClick={onDeleteTask}
              >
                Delete
              </button>
            </div>
          </div>
          <div className="task-detail-meta">
            <span>{activeCount} active</span>
            <span>{doneCount} done</span>
          </div>
          <div className="task-detail-deadline">
            <span>
              {task.startDate ? formatDateLabel(task.startDate) : "No start date"}
            </span>
            <span>{task.endDate ? formatDateLabel(task.endDate) : "No end date"}</span>
          </div>
          <div className="task-detail-remaining">
            {getTaskRemainingLabel(task.endDate)}
          </div>
        </header>

        <TodoList
          task={task}
          onAddTodo={onAddTodo}
          onToggleTodo={onToggleTodo}
          onRenameTodo={onRenameTodo}
          onReorderTodo={onReorderTodo}
        />
      </aside>
    </div>
  );
};
