import { startTransition } from "react";
import type { Task } from "@shared/types/project";
import { TodoList } from "@renderer/features/tasks/components/TodoList";

interface TaskOverlayProps {
  tasks: Task[];
  activeTask: Task;
  activeTaskTodoCount: number;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
  onAddTodo: (taskId: string, text: string) => void;
  onToggleTodo: (taskId: string, todoId: string) => void;
  onRenameTodo: (taskId: string, todoId: string, text: string) => void;
  onReorderTodo: (
    taskId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void;
}

export const TaskOverlay = ({
  tasks,
  activeTask,
  activeTaskTodoCount,
  onClose,
  onSelectTask,
  onAddTodo,
  onToggleTodo,
  onRenameTodo,
  onReorderTodo,
}: TaskOverlayProps) => (
  <section className="overlay-panel task-overlay-panel">
    <div className="overlay-panel-header">
      <span>Main Task</span>
      <button type="button" className="overlay-close" onClick={onClose}>
        ×
      </button>
    </div>

    <div className="task-stack">
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          className={`task-chip ${task.id === activeTask.id ? "active" : ""}`}
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

    <section className="task-drawer">
      <div className="task-drawer-header">
        <span>{activeTask.title}</span>
        <strong>{activeTaskTodoCount} items</strong>
      </div>
      <TodoList
        task={activeTask}
        onAddTodo={onAddTodo}
        onToggleTodo={onToggleTodo}
        onRenameTodo={onRenameTodo}
        onReorderTodo={onReorderTodo}
      />
    </section>
  </section>
);
