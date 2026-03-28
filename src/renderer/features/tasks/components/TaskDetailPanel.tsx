import type { Task } from "@shared/types/project";
import { TodoList } from "@renderer/features/tasks/components/TodoList";
import {
  formatDateLabel,
  getTaskRemainingLabel,
} from "@renderer/features/tasks/utils";

interface TaskDetailPanelProps {
  task: Task;
  open: boolean;
  onToggleOpen: () => void;
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
  onToggleOpen,
  onAddTodo,
  onToggleTodo,
  onRenameTodo,
  onReorderTodo,
}: TaskDetailPanelProps) => {
  const doneCount = task.todos.filter((todo) => todo.completed).length;
  const activeCount = task.todos.length - doneCount;

  return (
    <div className={`task-detail-shell ${open ? "open" : ""}`}>
      <button
        type="button"
        className="task-detail-handle"
        onClick={onToggleOpen}
        aria-label={open ? "Hide task panel" : "Show task panel"}
      >
        {open ? "›" : "‹"}
      </button>

      {open ? (
        <aside className="task-detail-panel overlay-panel">
          <header className="task-detail-header">
            <div className="task-detail-title-row">
              <strong>{task.title}</strong>
              <span className="task-detail-pin">⌁</span>
            </div>
            <div className="task-detail-meta">
              <span>{activeCount} active</span>
              <span>{doneCount} done</span>
            </div>
            <div className="task-detail-deadline">
              <span>
                {task.startDate ? formatDateLabel(task.startDate) : "No start date"}
              </span>
              <span>→</span>
              <span>
                {task.endDate ? formatDateLabel(task.endDate) : "No end date"}
              </span>
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
      ) : null}
    </div>
  );
};
