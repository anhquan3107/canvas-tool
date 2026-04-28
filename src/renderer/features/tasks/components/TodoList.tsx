import { GripVertical, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import type { Task } from "@shared/types/project";
import { useI18n } from "@renderer/i18n";

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
  const { copy } = useI18n();
  const [newTodoText, setNewTodoText] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [dragTodoId, setDragTodoId] = useState<string | null>(null);
  const newTodoInputRef = useRef<HTMLTextAreaElement | null>(null);

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
    if (newTodoInputRef.current) {
      newTodoInputRef.current.style.height = "48px";
    }
    onShowGuide();
  };

  const autoResizeTextArea = (event: FormEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    const baseHeight = Number(element.dataset.baseHeight ?? "48");
    const maxHeight = Number(element.dataset.maxHeight ?? "96");
    element.style.height = `${baseHeight}px`;
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
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
        <div className="todo-add-field">
          {newTodoText.trim().length === 0 ? (
            <span className="todo-add-placeholder" aria-hidden="true">
              {copy.tasks.todo.addPlaceholder}
            </span>
          ) : null}
          <textarea
            ref={newTodoInputRef}
            aria-label={copy.tasks.todo.addAria}
            data-base-height="48"
            data-max-height="96"
            value={newTodoText}
            onChange={(event) => setNewTodoText(event.target.value)}
            onInput={autoResizeTextArea}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey) &&
                !event.shiftKey
              ) {
                event.preventDefault();
                submitNewTodo();
              }
            }}
            rows={1}
          />
        </div>
        <button type="submit">{copy.tasks.todo.add}</button>
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
              <textarea
                autoFocus
                className="todo-text-input"
                data-base-height="22"
                data-max-height="88"
                value={todo.text}
                onChange={(event) =>
                  onRenameTodo(task.id, todo.id, event.target.value)
                }
                onInput={autoResizeTextArea}
                onBlur={() => setEditingTodoId(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.shiftKey) {
                    return;
                  }

                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    setEditingTodoId(null);
                  }
                }}
                rows={1}
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
              aria-label={copy.tasks.todo.deleteAria(todo.text)}
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
};
