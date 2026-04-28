import { useRef } from "react";
import type { TasksImportResult } from "@shared/types/ipc";
import { useI18n } from "@renderer/i18n";
import { DialogScrim } from "@renderer/ui/DialogScrim";
import { createDialogKeyDownHandler } from "@renderer/ui/dialog-keyboard";
import { useDialogInitialFocus } from "@renderer/ui/use-dialog-initial-focus";

type TaskImportMode = "merge" | "replace" | "skip-duplicates";

interface TaskImportDialogProps {
  preview: TasksImportResult & {
    duplicateCount: number;
    importableCount: number;
  };
  onApply: (mode: TaskImportMode) => void;
  onClose: () => void;
}

const formatExportedAt = (value: string | undefined, locale: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

export const TaskImportDialog = ({
  preview,
  onApply,
  onClose,
}: TaskImportDialogProps) => {
  const { copy, locale } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const fileName = preview.filePath.split(/[\\/]/).pop() ?? preview.filePath;
  const exportedAt = formatExportedAt(preview.exportedAt, locale);
  const visibleTasks = preview.tasks.slice(0, 5);

  useDialogInitialFocus(dialogRef);

  return (
    <DialogScrim onClose={onClose}>
      <div
        ref={dialogRef}
        className="dialog-card task-import-dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={createDialogKeyDownHandler({ onClose })}
        role="dialog"
        aria-modal="true"
        aria-label={copy.tasks.import.ariaLabel}
        tabIndex={-1}
      >
        <div className="dialog-frame-topbar">
          <span className="dialog-frame-topbar-label">{copy.tasks.import.title}</span>
        </div>

        <div className="dialog-frame-body task-import-dialog-body">
          <div className="task-import-dialog-head">
            <div>
              <span className="task-import-dialog-eyebrow">{copy.tasks.import.eyebrow}</span>
            </div>
            <div className="task-import-dialog-filemeta">
              <span>{fileName}</span>
              <span>{preview.format.toUpperCase()}</span>
            </div>
          </div>

          <div className="task-import-dialog-summary">
            <div className="task-import-dialog-stat">
              <strong>{preview.tasks.length}</strong>
              <span>{copy.tasks.import.tasksFound}</span>
            </div>
            <div className="task-import-dialog-stat">
              <strong>{preview.invalidTaskCount}</strong>
              <span>{copy.tasks.import.invalidRows}</span>
            </div>
            <div className="task-import-dialog-stat">
              <strong>{preview.duplicateCount}</strong>
              <span>{copy.tasks.import.duplicates}</span>
            </div>
            <div className="task-import-dialog-stat">
              <strong>{preview.importableCount}</strong>
              <span>{copy.tasks.import.importable}</span>
            </div>
          </div>

          <div className="task-import-dialog-section">
            <p className="task-import-dialog-copy">
              {copy.tasks.import.source}: <strong>{preview.projectTitle}</strong>
              {exportedAt ? ` • ${copy.tasks.import.exportedAt(exportedAt)}` : ""}
            </p>
            <p className="task-import-dialog-note">{copy.tasks.import.note}</p>
          </div>

          <div className="task-import-dialog-section">
            <span className="task-import-dialog-section-label">
              {copy.tasks.import.previewLabel}
            </span>
            <div className="task-import-dialog-list">
              {visibleTasks.length > 0 ? (
                visibleTasks.map((task) => (
                  <div key={`${task.id}-${task.order}`} className="task-import-dialog-row">
                    <strong>{task.title}</strong>
                    <span>{copy.tasks.import.todos(task.todos.length)}</span>
                  </div>
                ))
              ) : (
                <div className="task-import-dialog-empty">
                  {copy.tasks.import.noValidTasks}
                </div>
              )}
            </div>
          </div>

          <div className="task-import-dialog-actions">
            <button
              type="button"
              className="dialog-button"
              onClick={() => onApply("merge")}
              disabled={preview.tasks.length === 0}
            >
              {copy.common.merge}
            </button>
            <button
              type="button"
              className="dialog-button"
              onClick={() => onApply("skip-duplicates")}
              disabled={preview.importableCount === 0}
            >
              {copy.tasks.import.skipDuplicates}
            </button>
            <button
              type="button"
              className="dialog-button dialog-button-danger"
              onClick={() => onApply("replace")}
              disabled={preview.tasks.length === 0}
            >
              {copy.common.replace}
            </button>
            <button type="button" className="dialog-button" onClick={onClose}>
              {copy.common.cancel}
            </button>
          </div>
        </div>
      </div>
    </DialogScrim>
  );
};
