import { Pin } from "lucide-react";
import type { ReferenceGroup, Task } from "@shared/types/project";
import { TodoList } from "@renderer/features/tasks/components/TodoList";
import {
  formatDateLabel,
  getTaskDeadlineTone,
  getTaskRemainingLabel,
  isTaskComplete,
} from "@renderer/features/tasks/utils";

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
  linkedGroupName,
  groups,
  open,
  pinned,
  onReveal,
  onTogglePinned,
  onDeleteTask,
  onChangeTaskDates,
  onCompleteTask,
  onLinkTaskToGroup,
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
  const taskComplete = isTaskComplete(task.todos);
  const taskTone = getTaskDeadlineTone(task.endDate);

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
          <div className="task-detail-submeta">
            <span
              className={`task-detail-deadline-tone task-detail-deadline-tone-${taskTone}`}
            >
              {taskComplete ? "Completed" : getTaskRemainingLabel(task.endDate)}
            </span>
            <span>
              {task.startDate ? formatDateLabel(task.startDate) : "No start date"}
            </span>
            <span>→</span>
            <span>{task.endDate ? formatDateLabel(task.endDate) : "No end date"}</span>
          </div>
          <div className="task-detail-link-row">
            <label htmlFor={`task-link-${task.id}`}>Linked canvas</label>
            <select
              id={`task-link-${task.id}`}
              value={task.linkedGroupId ?? ""}
              onChange={(event) =>
                onLinkTaskToGroup(task.id, event.target.value || undefined)
              }
            >
              <option value="">None</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            {linkedGroupName ? (
              <span className="task-detail-linked-name">{linkedGroupName}</span>
            ) : null}
          </div>
          <div className="task-detail-toolbar">
            <button type="button" onClick={onChangeTaskDates}>
              Change Date
            </button>
            <button
              type="button"
              onClick={() => onCompleteTask(task.id, !taskComplete)}
            >
              {taskComplete ? "Mark Active" : "Mark Done"}
            </button>
            <button
              type="button"
              className="task-detail-delete"
              onClick={onDeleteTask}
            >
              Remove Task
            </button>
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
