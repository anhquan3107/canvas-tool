const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
