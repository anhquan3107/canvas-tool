import { useMemo, useState } from "react";
import type { Task } from "@shared/types/project";

interface TodoListProps {
  task: Task;
  onAddTodo: (taskId: string, text: string) => void;
  onToggleTodo: (taskId: string, todoId: string) => void;
  onRenameTodo: (taskId: string, todoId: string, text: string) => void;
  onReorderTodo: (
    taskId: string,
    sourceIndex: number,
    targetIndex: number,
  ) => void;
}

export const TodoList = ({
  task,
  onAddTodo,
  onToggleTodo,
  onRenameTodo,
  onReorderTodo,
}: TodoListProps) => {
  const [newTodoText, setNewTodoText] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [dragTodoId, setDragTodoId] = useState<string | null>(null);

  const sortedTodos = useMemo(
    () => [...task.todos].sort((left, right) => left.order - right.order),
    [task.todos],
  );

  return (
    <section className="task-card">
      <ol className="todo-list">
        {sortedTodos.map((todo, index) => (
          <li
            key={todo.id}
            className="todo-item"
            draggable
            onDragStart={() => {
              setDragTodoId(todo.id);
            }}
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
              const targetIndex = index;

              if (sourceIndex >= 0 && targetIndex >= 0) {
                onReorderTodo(task.id, sourceIndex, targetIndex);
              }

              setDragTodoId(null);
            }}
          >
            <span className="todo-index">{index + 1}</span>

            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => onToggleTodo(task.id, todo.id)}
            />

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
                {todo.text}
              </button>
            )}
          </li>
        ))}
      </ol>

      <form
        className="todo-add"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = newTodoText.trim();
          if (!trimmed) {
            return;
          }

          onAddTodo(task.id, trimmed);
          setNewTodoText("");
        }}
      >
        <input
          value={newTodoText}
          onChange={(event) => setNewTodoText(event.target.value)}
          placeholder="Add a new task... (Ctrl+Enter to save)"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              const trimmed = newTodoText.trim();
              if (!trimmed) {
                return;
              }

              onAddTodo(task.id, trimmed);
              setNewTodoText("");
            }
          }}
        />
        <button type="submit">Add</button>
      </form>
    </section>
  );
};
