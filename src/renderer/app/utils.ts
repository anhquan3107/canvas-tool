import type { Project } from "@shared/types/project";

export const formatTimestamp = (value: string, locale?: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

export const getProjectDirtySignature = (project: Project) =>
  JSON.stringify({
    title: project.title,
    filePath: project.filePath ?? null,
    activeGroupId: project.activeGroupId,
    groups: project.groups,
    tasks: project.tasks,
  });
