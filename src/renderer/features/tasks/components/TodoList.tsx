import { GripVertical, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Task } from "@shared/types/project";

interface TodoListProps {
  task: Task;
  onAddTodo: (taskId: string, text: string) => void;
  onRemoveTodo: (taskId: string, todoId: string) => void;
  onToggleTodo: (taskId: string, todoId: string) => void;
  onRenameTodo: (taskId: string, todoId: string, text: string) => void;
  onReorderTodo: (
    taskId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void;
  onShowGuide: () => void;
}

export const TodoList = ({
  task,
  onAddTodo,
  onRemoveTodo,
  onToggleTodo,
  onRenameTodo,
  onReorderTodo,
  onShowGuide,
}: TodoListProps) => {
  const [newTodoText, setNewTodoText] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [dragTodoId, setDragTodoId] = useState<string | null>(null);

  const sortedTodos = useMemo(
    () => [...task.todos].sort((left, right) => left.order - right.order),
    [task.todos],
  );

  const submitNewTodo = () => {
    const trimmed = newTodoText.trim();
    if (!trimmed) {
      return;
    }

    onAddTodo(task.id, trimmed);
    setNewTodoText("");
    onShowGuide();
  };

  return (
    <section className="todo-panel-card">
      <form
        className="todo-add"
        onSubmit={(event) => {
          event.preventDefault();
          submitNewTodo();
        }}
      >
        <input
          value={newTodoText}
          onChange={(event) => setNewTodoText(event.target.value)}
          placeholder="Add a new task... (Ctrl+Enter to save)"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submitNewTodo();
            }
          }}
        />
        <button type="submit">Add</button>
      </form>

      <ol className="todo-list">
        {sortedTodos.map((todo, index) => (
          <li
            key={todo.id}
            className={`todo-item ${todo.completed ? "todo-item-completed" : ""}`}
            draggable
            onDragStart={() => {
              setDragTodoId(todo.id);
            }}
            onDragEnd={() => setDragTodoId(null)}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={() => {
              if (!dragTodoId || dragTodoId === todo.id) {
                return;
              }

              const sourceIndex = sortedTodos.findIndex(
                (entry) => entry.id === dragTodoId,
              );
              if (sourceIndex >= 0) {
                onReorderTodo(task.id, sourceIndex, index);
              }

              setDragTodoId(null);
            }}
          >
            <span className="todo-drag-handle" aria-hidden="true">
              <GripVertical size={14} strokeWidth={1.7} />
            </span>

            <label className="todo-checkbox">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => onToggleTodo(task.id, todo.id)}
              />
              <span className="todo-checkbox-ui" aria-hidden="true" />
            </label>

            {editingTodoId === todo.id ? (
              <input
                autoFocus
                className="todo-text-input"
                value={todo.text}
                onChange={(event) =>
                  onRenameTodo(task.id, todo.id, event.target.value)
                }
                onBlur={() => setEditingTodoId(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setEditingTodoId(null);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className={`todo-text ${todo.completed ? "todo-complete" : ""}`}
                onDoubleClick={() => setEditingTodoId(todo.id)}
              >
                <span className="todo-index">{index + 1}.</span>
                <span>{todo.text}</span>
              </button>
            )}

            <button
              type="button"
              className="todo-delete"
              onClick={() => onRemoveTodo(task.id, todo.id)}
              aria-label={`Delete ${todo.text}`}
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
};
