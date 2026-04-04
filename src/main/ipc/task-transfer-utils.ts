import path from "node:path";
import type {
  TaskTransferTask,
  TasksImportResult,
} from "../../shared/types/ipc";
import type { Task } from "../../shared/types/project";

const TASK_TRANSFER_FORMAT = "canvas-tool-task-export";
const TASK_TRANSFER_VERSION = 1;
const TASK_TRANSFER_SCRIPT_ID = "canvas-tool-task-export";

type TaskTransferPackage = {
  format: typeof TASK_TRANSFER_FORMAT;
  version: typeof TASK_TRANSFER_VERSION;
  projectTitle: string;
  exportedAt: string;
  tasks: TaskTransferTask[];
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const encodeJsonForHtmlScript = (value: unknown) =>
  JSON.stringify(value, null, 2)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e");

const normalizeTodo = (
  value: unknown,
  index: number,
): Task["todos"][number] | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.text !== "string" || record.text.trim().length === 0) {
    return null;
  }

  return {
    id:
      typeof record.id === "string" && record.id.trim().length > 0
        ? record.id
        : `imported-todo-${index + 1}`,
    text: record.text,
    completed: typeof record.completed === "boolean" ? record.completed : false,
    order:
      typeof record.order === "number" && Number.isFinite(record.order)
        ? record.order
        : index,
  };
};

const normalizeTask = (
  value: unknown,
  index: number,
): TaskTransferTask | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string" || record.title.trim().length === 0) {
    return null;
  }

  const todos = Array.isArray(record.todos)
    ? record.todos
        .map((todo, todoIndex) => normalizeTodo(todo, todoIndex))
        .filter((todo): todo is Task["todos"][number] => todo !== null)
        .sort((left, right) => left.order - right.order)
        .map((todo, todoIndex) => ({ ...todo, order: todoIndex }))
    : [];

  return {
    id:
      typeof record.id === "string" && record.id.trim().length > 0
        ? record.id
        : `imported-task-${index + 1}`,
    title: record.title,
    order:
      typeof record.order === "number" && Number.isFinite(record.order)
        ? record.order
        : index,
    completed:
      typeof record.completed === "boolean" ? record.completed : undefined,
    startDate: typeof record.startDate === "string" ? record.startDate : undefined,
    endDate: typeof record.endDate === "string" ? record.endDate : undefined,
    linkedGroupId:
      typeof record.linkedGroupId === "string" ? record.linkedGroupId : undefined,
    linkedGroupName:
      typeof record.linkedGroupName === "string"
        ? record.linkedGroupName
        : undefined,
    todos,
  };
};

const buildTaskTransferPackage = (
  projectTitle: string,
  tasks: TaskTransferTask[],
): TaskTransferPackage => ({
  format: TASK_TRANSFER_FORMAT,
  version: TASK_TRANSFER_VERSION,
  projectTitle,
  exportedAt: new Date().toISOString(),
  tasks: [...tasks].sort((left, right) => left.order - right.order),
});

const parseTaskTransferPackage = (
  rawValue: unknown,
  format: "html" | "txt",
  filePath: string,
): TasksImportResult => {
  if (!rawValue || typeof rawValue !== "object") {
    throw new Error("Task import file is not a valid CanvasTool export.");
  }

  const record = rawValue as Record<string, unknown>;
  if (
    record.format !== TASK_TRANSFER_FORMAT ||
    record.version !== TASK_TRANSFER_VERSION
  ) {
    throw new Error("Task import file version is not supported.");
  }

  if (!Array.isArray(record.tasks)) {
    throw new Error("Task import file does not contain any task data.");
  }

  let invalidTaskCount = 0;
  const tasks = record.tasks
    .map((task, index) => {
      const normalized = normalizeTask(task, index);
      if (!normalized) {
        invalidTaskCount += 1;
      }
      return normalized;
    })
    .filter((task): task is TaskTransferTask => task !== null);

  return {
    filePath,
    format,
    projectTitle:
      typeof record.projectTitle === "string" && record.projectTitle.trim().length > 0
        ? record.projectTitle
        : path.basename(filePath, path.extname(filePath)),
    exportedAt:
      typeof record.exportedAt === "string" ? record.exportedAt : undefined,
    tasks,
    invalidTaskCount,
  };
};

const getTaskStatus = (task: TaskTransferTask) => {
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

export const renderTasksHtml = (
  projectTitle: string,
  tasks: TaskTransferTask[],
) => {
  const taskPackage = buildTaskTransferPackage(projectTitle, tasks);
  const orderedTasks = [...taskPackage.tasks].sort(
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
      const remainingTodos = orderedTodos.filter((todo) => !todo.completed).length;
      const doneTodos = orderedTodos.length - remainingTodos;
      const statusLabel =
        taskStatus === "completed"
          ? "Completed"
          : taskStatus === "overdue"
            ? "Overdue"
            : "Active";
      const groupHtml = task.linkedGroupName
        ? `<span>Group: ${escapeHtml(task.linkedGroupName)}</span>`
        : "";
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
    ${groupHtml}
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
  <script type="application/json" id="${TASK_TRANSFER_SCRIPT_ID}">${encodeJsonForHtmlScript(taskPackage)}</script>
</body>
</html>`;
};

export const renderTasksTxt = (
  projectTitle: string,
  tasks: TaskTransferTask[],
) => JSON.stringify(buildTaskTransferPackage(projectTitle, tasks), null, 2);

export const parseImportedTasks = (
  filePath: string,
  contents: string,
): TasksImportResult => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") {
    const match = contents.match(
      new RegExp(
        `<script[^>]*id=["']${TASK_TRANSFER_SCRIPT_ID}["'][^>]*>([\\s\\S]*?)<\\/script>`,
        "i",
      ),
    );
    if (!match) {
      throw new Error("HTML file does not contain embedded CanvasTool task data.");
    }

    return parseTaskTransferPackage(JSON.parse(match[1]), "html", filePath);
  }

  if (extension !== ".txt") {
    throw new Error("Task import only supports HTML or TXT files.");
  }

  return parseTaskTransferPackage(JSON.parse(contents), "txt", filePath);
};
