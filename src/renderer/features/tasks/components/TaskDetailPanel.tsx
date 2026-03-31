import { Pin } from "lucide-react";
import type { ReferenceGroup, Task } from "@shared/types/project";
import { TodoList } from "@renderer/features/tasks/components/TodoList";

interface TaskDetailPanelProps {
  task: Task;
  linkedGroupName?: string | null;
  groups: ReferenceGroup[];
  open: boolean;
  pinned: boolean;
  onReveal: () => void;
  onTogglePinned: () => void;
  onDeleteTask: () => void;
  onChangeTaskDates: () => void;
  onCompleteTask: (taskId: string, completed: boolean) => void;
  onLinkTaskToGroup: (taskId: string, groupId?: string) => void;
  onInteract: () => void;
  onAddTodo: (taskId: string, text: string) => void;
  onRemoveTodo: (taskId: string, todoId: string) => void;
  onToggleTodo: (taskId: string, todoId: string) => void;
  onRenameTodo: (taskId: string, todoId: string, text: string) => void;
  onReorderTodo: (
    taskId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void;
  onShowTodoGuide: () => void;
}

export const TaskDetailPanel = ({
  task,
  open,
  pinned,
  onReveal,
  onTogglePinned,
  onInteract,
  onAddTodo,
  onRemoveTodo,
  onToggleTodo,
  onRenameTodo,
  onReorderTodo,
  onShowTodoGuide,
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
            <div className="task-detail-title-block">
              <strong>{task.title}</strong>
              <div className="task-detail-meta">
                <span>{activeCount} active</span>
                <span>•</span>
                <span>{doneCount} done</span>
              </div>
            </div>
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
            </div>
          </div>
        </header>

        <TodoList
          task={task}
          onAddTodo={onAddTodo}
          onRemoveTodo={onRemoveTodo}
          onToggleTodo={onToggleTodo}
          onRenameTodo={onRenameTodo}
          onReorderTodo={onReorderTodo}
          onShowGuide={onShowTodoGuide}
        />
      </aside>
    </div>
  );
};
