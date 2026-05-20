import type { Project } from "@shared/types/project";

const defaultTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const englishTimestampFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const vietnameseTimestampFormatter = new Intl.DateTimeFormat("vi", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const getTimestampFormatter = (locale?: string) =>
  locale === "vi"
    ? vietnameseTimestampFormatter
    : locale === "en"
      ? englishTimestampFormatter
      : defaultTimestampFormatter;

export const formatTimestamp = (value: string, locale?: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return getTimestampFormatter(locale).format(parsed);
};

export const getProjectDirtySignature = (project: Project) =>
  JSON.stringify({
    title: project.title,
    filePath: project.filePath ?? null,
    activeGroupId: project.activeGroupId,
    groups: project.groups,
    tasks: project.tasks,
  });
