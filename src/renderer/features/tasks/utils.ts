const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const TASK_TITLE_MAX_LENGTH = 100;

export const clampTaskTitle = (value: string) =>
  value.slice(0, TASK_TITLE_MAX_LENGTH);

export const sanitizeTaskTitle = (value: string) =>
  clampTaskTitle(value.trim());

const toDateAtEndOfDay = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }

  parsed.setHours(23, 59, 59, 999);
  return parsed;
};

export const getTaskRemainingDays = (endDate?: string) => {
  if (!endDate) {
    return null;
  }

  const deadline = toDateAtEndOfDay(endDate);
  if (!deadline) {
    return null;
  }

  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const formatDateLabel = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

export const createDefaultTaskDates = () => {
  const start = new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
};

export const getDayCount = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return 0;
  }

  const diff = Math.max(0, end.getTime() - start.getTime());
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

export const formatTaskDateRange = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) {
    return "No deadline";
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return "No deadline";
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

export const getTaskRemainingLabel = (endDate?: string) => {
  if (!endDate) {
    return "No deadline";
  }

  const deadline = toDateAtEndOfDay(endDate);
  if (!deadline) {
    return "No deadline";
  }

  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) {
    return "Deadline reached";
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days <= 0) {
    return `${hours}h remaining`;
  }

  return `${days}d ${hours}h remaining`;
};

export const isTaskComplete = (
  taskOrTodos: { completed?: boolean; todos: Array<{ completed: boolean }> } | Array<{ completed: boolean }>,
) => {
  if (Array.isArray(taskOrTodos)) {
    return taskOrTodos.length > 0 && taskOrTodos.every((todo) => todo.completed);
  }

  return (
    taskOrTodos.completed === true ||
    (taskOrTodos.todos.length > 0 &&
      taskOrTodos.todos.every((todo) => todo.completed))
  );
};

export const getTaskDeadlineTone = (endDate?: string) => {
  const remainingDays = getTaskRemainingDays(endDate);

  if (remainingDays === null) {
    return "neutral" as const;
  }

  if (remainingDays >= 11) {
    return "green" as const;
  }

  if (remainingDays >= 4) {
    return "orange" as const;
  }

  return "red" as const;
};
