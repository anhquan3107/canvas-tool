import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { DialogFrame } from "@renderer/ui/DialogFrame";
import type { TaskDateRange } from "@renderer/features/tasks/types";
import { formatDateLabel } from "@renderer/features/tasks/utils";

interface TaskDialogProps {
  open: boolean;
  mode?: "create" | "edit" | "rename";
  draftTaskTitle: string;
  taskDates: TaskDateRange;
  taskDuration: number;
  onClose: () => void;
  onSubmitTask: () => void;
  onDraftTaskTitleChange: Dispatch<SetStateAction<string>>;
  onTaskDatesChange: Dispatch<SetStateAction<TaskDateRange>>;
}

export const TaskDialog = ({
  open,
  mode = "create",
  draftTaskTitle,
  taskDates,
  taskDuration,
  onClose,
  onSubmitTask,
  onDraftTaskTitleChange,
  onTaskDatesChange,
}: TaskDialogProps) => {
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) {
      return;
    }

    input.focus();
    if ("showPicker" in input && typeof input.showPicker === "function") {
      input.showPicker();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <DialogFrame
      className="task-deadline-dialog"
      title={
        mode === "rename"
          ? "Rename Task"
          : mode === "edit"
            ? "Edit Task Deadline"
            : "Set Deadline"
      }
      onClose={onClose}
    >
      <div className={`task-dialog-shell task-dialog-mode-${mode}`}>
        <div className="dialog-field task-dialog-field">
          <label htmlFor="task-title">Task Title:</label>
          <input
            id="task-title"
            value={draftTaskTitle}
            onChange={(event) => onDraftTaskTitleChange(event.target.value)}
          />
        </div>

        {mode !== "rename" ? (
          <>
            <div className="dialog-grid task-dialog-grid">
              <div className="dialog-field task-dialog-field">
                <label htmlFor="task-start">Start Date:</label>
                <div
                  className="task-dialog-date-input-shell"
                  onClick={() => openDatePicker(startDateInputRef.current)}
                >
                  <input
                    ref={startDateInputRef}
                    id="task-start"
                    className="task-dialog-date-input"
                    type="date"
                    value={taskDates.startDate}
                    onFocus={() => openDatePicker(startDateInputRef.current)}
                    onChange={(event) =>
                      onTaskDatesChange((previous) => ({
                        ...previous,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <span className="dialog-date-preview">
                  {formatDateLabel(taskDates.startDate)}
                </span>
              </div>

              <div className="dialog-field task-dialog-field">
                <label htmlFor="task-end">End Date:</label>
                <div
                  className="task-dialog-date-input-shell"
                  onClick={() => openDatePicker(endDateInputRef.current)}
                >
                  <input
                    ref={endDateInputRef}
                    id="task-end"
                    className="task-dialog-date-input"
                    type="date"
                    value={taskDates.endDate}
                    onFocus={() => openDatePicker(endDateInputRef.current)}
                    onChange={(event) =>
                      onTaskDatesChange((previous) => ({
                        ...previous,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <span className="dialog-date-preview">
                  {formatDateLabel(taskDates.endDate)}
                </span>
              </div>
            </div>

            <p className="dialog-duration task-dialog-duration">
              Duration: {taskDuration} day(s)
            </p>
          </>
        ) : null}

        <div className="dialog-actions task-dialog-actions">
          <button
            type="button"
            className="dialog-button primary"
            onClick={onSubmitTask}
          >
            {mode === "edit" || mode === "rename" ? "Save" : "OK"}
          </button>
          <button type="button" className="dialog-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </DialogFrame>
  );
};
