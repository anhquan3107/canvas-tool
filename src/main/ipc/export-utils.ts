import type { SwatchExportRequest } from "../../shared/types/ipc";
import type { Task } from "../../shared/types/project";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const formatTaskDateTime = (value?: string) => {
  if (!value) {
    return "No date";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

const getTaskRemainingLabel = (endDate?: string) => {
  if (!endDate) {
    return "No deadline";
  }

  const deadline = new Date(endDate);
  if (Number.isNaN(deadline.valueOf())) {
    return "No deadline";
  }

  deadline.setHours(23, 59, 59, 999);
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) {
    return "0h";
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days <= 0) {
    return `${hours}h`;
  }

  return `${days}d ${hours}h`;
};

const getTaskStatus = (task: Task) => {
  const activeCount = task.todos.filter((todo) => !todo.completed).length;

  if (task.endDate) {
    const deadline = new Date(task.endDate);
    if (!Number.isNaN(deadline.valueOf())) {
      deadline.setHours(23, 59, 59, 999);
      if (deadline.getTime() < Date.now() && activeCount > 0) {
        return "overdue" as const;
      }
    }
  }

  if (task.todos.length > 0 && activeCount === 0) {
    return "completed" as const;
  }

  return "active" as const;
};

export const renderTasksHtml = (projectTitle: string, tasks: Task[]) => {
  const orderedTasks = [...tasks].sort(
    (left, right) => left.order - right.order,
  );
  const completedCount = orderedTasks.filter(
    (task) => getTaskStatus(task) === "completed",
  ).length;
  const activeCount = orderedTasks.filter(
    (task) => getTaskStatus(task) === "active",
  ).length;
  const overdueCount = orderedTasks.filter(
    (task) => getTaskStatus(task) === "overdue",
  ).length;
  const body = orderedTasks
    .map((task, index) => {
      const orderedTodos = [...task.todos].sort(
        (left, right) => left.order - right.order,
      );
      const taskStatus = getTaskStatus(task);
      const remainingTodos = orderedTodos.filter(
        (todo) => !todo.completed,
      ).length;
      const doneTodos = orderedTodos.length - remainingTodos;
      const statusLabel =
        taskStatus === "completed"
          ? "Completed"
          : taskStatus === "overdue"
            ? "Overdue"
            : "Active";
      const todosHtml =
        orderedTodos.length === 0
          ? '<p class="empty">No todo items</p>'
          : `<ul class="todo-list">${orderedTodos
              .map(
                (todo) =>
                  `<li class="todo-row ${todo.completed ? "done" : "open"}"><span class="todo-check">${todo.completed ? "✓" : ""}</span><span>${escapeHtml(todo.text)}</span></li>`,
              )
              .join("")}</ul>`;

      return `<section class="task-card">
  <h2>Task #${index + 1}: ${escapeHtml(task.title)}</h2>
  <div class="status-pill ${taskStatus}">${statusLabel}</div>
  <div class="task-meta">
    <span>Start: ${escapeHtml(formatTaskDateTime(task.startDate))}</span>
    <span>End: ${escapeHtml(formatTaskDateTime(task.endDate))}</span>
    <span>Remaining: ${escapeHtml(getTaskRemainingLabel(task.endDate))}</span>
  </div>
  <div class="todo-panel">
    <div class="todo-panel-title">Todo List (${remainingTodos} active • ${doneTodos} done)</div>
    ${todosHtml}
  </div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(projectTitle)} Tasks</title>
  <style>
    :root {
      color-scheme: light;
    }
    body { margin: 0; padding: 28px; background: linear-gradient(180deg, #f8f8fb 0%, #eef1f7 100%); color: #2b3444; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    h1 { margin: 0; font-size: 28px; }
    .header { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 24px; }
    .summary { display: flex; gap: 12px; flex-wrap: wrap; }
    .summary-chip { padding: 8px 14px; border-radius: 999px; background: rgba(255,255,255,0.86); box-shadow: 0 8px 24px rgba(88, 102, 122, 0.08); color: #617086; font-size: 13px; }
    .summary-chip strong { color: #2b3444; }
    .task-grid { display: grid; gap: 18px; }
    .task-card { padding: 22px; border-radius: 20px; border: 1px solid rgba(145, 162, 186, 0.2); background: rgba(255,255,255,0.9); box-shadow: 0 12px 36px rgba(96, 116, 149, 0.12); }
    .task-card h2 { margin: 0 0 14px; font-size: 18px; }
    .status-pill { display: flex; align-items: center; gap: 8px; width: min(100%, 320px); padding: 8px 14px; border-radius: 999px; font-weight: 600; font-size: 13px; margin-bottom: 14px; }
    .status-pill.active { background: #dff3fb; color: #2c6f8c; }
    .status-pill.completed { background: #e2f6e9; color: #2f7f53; }
    .status-pill.overdue { background: #ffe5e5; color: #9d4242; }
    .task-meta { display: flex; flex-wrap: wrap; gap: 18px; padding: 12px 0 18px; color: #677388; font-size: 13px; }
    .todo-panel { border-radius: 16px; overflow: hidden; border: 1px solid rgba(216, 223, 235, 0.9); background: #fcfdff; }
    .todo-panel-title { padding: 14px 18px; font-weight: 700; font-size: 15px; background: linear-gradient(180deg, #f9fbff 0%, #f2f5fb 100%); border-bottom: 1px solid rgba(216, 223, 235, 0.9); }
    .todo-list { margin: 0; padding: 10px 18px 18px; list-style: none; display: grid; gap: 8px; }
    .todo-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(230, 234, 241, 0.9); }
    .todo-row:last-child { border-bottom: none; }
    .todo-check { width: 18px; height: 18px; border-radius: 5px; border: 2px solid #6fb7ff; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; color: #2474d7; flex: 0 0 auto; }
    .todo-row.done { color: #90a0b5; text-decoration: line-through; }
    .todo-row.done .todo-check { background: #dff0ff; }
    .empty { margin: 0; padding: 24px 18px 28px; color: #9ca7b9; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(projectTitle)} Tasks</h1>
    <div class="summary">
      <div class="summary-chip"><strong>${completedCount}</strong> Completed</div>
      <div class="summary-chip"><strong>${activeCount}</strong> Active</div>
      <div class="summary-chip"><strong>${overdueCount}</strong> Overdue</div>
    </div>
  </div>
  <div class="task-grid">${body || '<p class="empty">No tasks available.</p>'}</div>
</body>
</html>`;
};

export const createAcoBuffer = (swatches: SwatchExportRequest["swatches"]) => {
  if (swatches.length === 0) {
    throw new Error("No swatches available to export.");
  }

  const buffer = Buffer.alloc(4 + swatches.length * 10);
  buffer.writeUInt16BE(1, 0);
  buffer.writeUInt16BE(swatches.length, 2);

  swatches.forEach((swatch, index) => {
    const normalized = swatch.colorHex.replace("#", "").trim();
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      throw new Error("Swatch color must be a 6-digit hex value.");
    }

    const red = Number.parseInt(normalized.slice(0, 2), 16) * 257;
    const green = Number.parseInt(normalized.slice(2, 4), 16) * 257;
    const blue = Number.parseInt(normalized.slice(4, 6), 16) * 257;
    const offset = 4 + index * 10;

    buffer.writeUInt16BE(0, offset);
    buffer.writeUInt16BE(red, offset + 2);
    buffer.writeUInt16BE(green, offset + 4);
    buffer.writeUInt16BE(blue, offset + 6);
    buffer.writeUInt16BE(0, offset + 8);
  });

  return buffer;
};
