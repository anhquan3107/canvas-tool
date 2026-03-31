import type { Dispatch, SetStateAction } from "react";
import { DialogFrame } from "@renderer/ui/DialogFrame";
import type { TaskDateRange } from "@renderer/features/tasks/types";
import { formatDateLabel } from "@renderer/features/tasks/utils";

interface TaskDialogProps {
  open: boolean;
  mode?: "create" | "edit";
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
  if (!open) {
    return null;
  }

  return (
    <DialogFrame
      title={mode === "edit" ? "Edit Task Deadline" : "Set Deadline"}
      onClose={onClose}
    >
      <div className="dialog-field">
        <label htmlFor="task-title">Task Title:</label>
        <input
          id="task-title"
          value={draftTaskTitle}
          onChange={(event) => onDraftTaskTitleChange(event.target.value)}
        />
      </div>

      <div className="dialog-grid">
        <div className="dialog-field">
          <label htmlFor="task-start">Start Date:</label>
          <input
            id="task-start"
            type="date"
            value={taskDates.startDate}
            onChange={(event) =>
              onTaskDatesChange((previous) => ({
                ...previous,
                startDate: event.target.value,
              }))
            }
          />
          <span className="dialog-date-preview">
            {formatDateLabel(taskDates.startDate)}
          </span>
        </div>

        <div className="dialog-field">
          <label htmlFor="task-end">End Date:</label>
          <input
            id="task-end"
            type="date"
            value={taskDates.endDate}
            onChange={(event) =>
              onTaskDatesChange((previous) => ({
                ...previous,
                endDate: event.target.value,
              }))
            }
          />
          <span className="dialog-date-preview">
            {formatDateLabel(taskDates.endDate)}
          </span>
        </div>
      </div>

      <p className="dialog-duration">Duration: {taskDuration} day(s)</p>

      <div className="dialog-actions">
        <button
          type="button"
          className="dialog-button primary"
          onClick={onSubmitTask}
        >
          {mode === "edit" ? "Save" : "OK"}
        </button>
        <button type="button" className="dialog-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </DialogFrame>
  );
};
