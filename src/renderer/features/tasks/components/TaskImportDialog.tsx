import type { TasksImportResult } from "@shared/types/ipc";
import { DialogScrim } from "@renderer/ui/DialogScrim";

type TaskImportMode = "merge" | "replace" | "skip-duplicates";

interface TaskImportDialogProps {
  preview: TasksImportResult & {
    duplicateCount: number;
    importableCount: number;
  };
  onApply: (mode: TaskImportMode) => void;
  onClose: () => void;
}

const formatExportedAt = (value?: string) => {
  if (!value) {
    return null;
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

export const TaskImportDialog = ({
  preview,
  onApply,
  onClose,
}: TaskImportDialogProps) => {
  const fileName = preview.filePath.split(/[\\/]/).pop() ?? preview.filePath;
  const exportedAt = formatExportedAt(preview.exportedAt);
  const visibleTasks = preview.tasks.slice(0, 5);

  return (
    <DialogScrim onClose={onClose}>
      <div
        className="dialog-card task-import-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Review Imported Tasks"
      >
        <div className="dialog-frame-topbar">
          <span className="dialog-frame-topbar-label">Review Imported Tasks</span>
        </div>

        <div className="dialog-frame-body task-import-dialog-body">
          <div className="task-import-dialog-head">
            <div>
              <span className="task-import-dialog-eyebrow">Import Tasks</span>
            </div>
            <div className="task-import-dialog-filemeta">
              <span>{fileName}</span>
              <span>{preview.format.toUpperCase()}</span>
            </div>
          </div>

          <div className="task-import-dialog-summary">
            <div className="task-import-dialog-stat">
              <strong>{preview.tasks.length}</strong>
              <span>Tasks found</span>
            </div>
            <div className="task-import-dialog-stat">
              <strong>{preview.invalidTaskCount}</strong>
              <span>Invalid rows</span>
            </div>
            <div className="task-import-dialog-stat">
              <strong>{preview.duplicateCount}</strong>
              <span>Duplicates</span>
            </div>
            <div className="task-import-dialog-stat">
              <strong>{preview.importableCount}</strong>
              <span>Importable</span>
            </div>
          </div>

          <div className="task-import-dialog-section">
            <p className="task-import-dialog-copy">
              Source: <strong>{preview.projectTitle}</strong>
              {exportedAt ? ` • Exported ${exportedAt}` : ""}
            </p>
            <p className="task-import-dialog-note">
              Merge adds all imported tasks. Replace clears current tasks first. Skip
              Duplicates only imports tasks that do not already exist in this project.
            </p>
          </div>

          <div className="task-import-dialog-section">
            <span className="task-import-dialog-section-label">Task preview</span>
            <div className="task-import-dialog-list">
              {visibleTasks.length > 0 ? (
                visibleTasks.map((task) => (
                  <div key={`${task.id}-${task.order}`} className="task-import-dialog-row">
                    <strong>{task.title}</strong>
                    <span>{task.todos.length} todos</span>
                  </div>
                ))
              ) : (
                <div className="task-import-dialog-empty">No valid tasks found in this file.</div>
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
              Merge
            </button>
            <button
              type="button"
              className="dialog-button"
              onClick={() => onApply("skip-duplicates")}
              disabled={preview.importableCount === 0}
            >
              Skip Duplicates
            </button>
            <button
              type="button"
              className="dialog-button dialog-button-danger"
              onClick={() => onApply("replace")}
              disabled={preview.tasks.length === 0}
            >
              Replace
            </button>
            <button type="button" className="dialog-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </DialogScrim>
  );
};
