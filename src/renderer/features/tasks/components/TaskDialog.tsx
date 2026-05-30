import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, Dispatch, FormEvent, SetStateAction } from "react";
import { DialogFrame } from "@renderer/ui/DialogFrame";
import { useI18n } from "@renderer/i18n";
import type { TaskDateRange } from "@renderer/features/tasks/types";
import {
  clampTaskTitle,
  formatDateLabel,
  TASK_TITLE_MAX_LENGTH,
} from "@renderer/features/tasks/utils";

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

type TaskDialogContentProps = Omit<TaskDialogProps, "open">;

const openDatePicker = (input: HTMLInputElement | null) => {
  if (!input) {
    return;
  }

  input.focus();
  if ("showPicker" in input && typeof input.showPicker === "function") {
    input.showPicker();
  }
};

const wouldOverflowTitleLimit = (
  input: HTMLInputElement,
  incomingText: string,
) => {
  const selectionStart = input.selectionStart ?? input.value.length;
  const selectionEnd = input.selectionEnd ?? input.value.length;
  const nextLength =
    input.value.length - (selectionEnd - selectionStart) + incomingText.length;

  return nextLength > TASK_TITLE_MAX_LENGTH;
};

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
    <TaskDialogContent
      mode={mode}
      draftTaskTitle={draftTaskTitle}
      taskDates={taskDates}
      taskDuration={taskDuration}
      onClose={onClose}
      onSubmitTask={onSubmitTask}
      onDraftTaskTitleChange={onDraftTaskTitleChange}
      onTaskDatesChange={onTaskDatesChange}
    />
  );
};

const TaskDialogContent = ({
  mode = "create",
  draftTaskTitle,
  taskDates,
  taskDuration,
  onClose,
  onSubmitTask,
  onDraftTaskTitleChange,
  onTaskDatesChange,
}: TaskDialogContentProps) => {
  const { copy, locale } = useI18n();
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const [showTitleLimitWarning, setShowTitleLimitWarning] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      titleInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleTitleBeforeInput = (event: FormEvent<HTMLInputElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    const input = event.currentTarget;
    const incomingText = nativeEvent.data ?? "";

    if (!incomingText) {
      return;
    }

    setShowTitleLimitWarning(wouldOverflowTitleLimit(input, incomingText));
  };

  const handleTitlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    setShowTitleLimitWarning(
      wouldOverflowTitleLimit(
        event.currentTarget,
        event.clipboardData.getData("text"),
      ),
    );
  };

  const handleTitleChange = (value: string) => {
    setShowTitleLimitWarning(false);
    onDraftTaskTitleChange(clampTaskTitle(value));
  };

  return (
    <DialogFrame
      className="task-deadline-dialog"
      title={
        mode === "rename"
          ? copy.tasks.dialog.renameTitle
          : mode === "edit"
            ? copy.tasks.dialog.editTitle
            : copy.tasks.dialog.createTitle
      }
      onClose={onClose}
      onConfirm={onSubmitTask}
    >
      <div className={`task-dialog-shell task-dialog-mode-${mode}`}>
        <div className="dialog-field task-dialog-field">
          <label htmlFor="task-title">{copy.tasks.dialog.titleLabel}</label>
          <input
            ref={titleInputRef}
            id="task-title"
            value={draftTaskTitle}
            maxLength={TASK_TITLE_MAX_LENGTH}
            onBeforeInput={handleTitleBeforeInput}
            onPaste={handleTitlePaste}
            onChange={(event) => handleTitleChange(event.target.value)}
          />
          {showTitleLimitWarning ? (
            <p className="task-dialog-title-warning">
              {copy.tasks.dialog.titleLimitWarning}
            </p>
          ) : null}
        </div>

        {mode !== "rename" ? (
          <>
            <div className="dialog-grid task-dialog-grid">
              <div className="dialog-field task-dialog-field">
                <label htmlFor="task-start">{copy.tasks.dialog.startDate}</label>
                <div
                  className="task-dialog-date-input-shell"
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
                  {formatDateLabel(taskDates.startDate, locale)}
                </span>
              </div>

              <div className="dialog-field task-dialog-field">
                <label htmlFor="task-end">{copy.tasks.dialog.endDate}</label>
                <div
                  className="task-dialog-date-input-shell"
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
                  {formatDateLabel(taskDates.endDate, locale)}
                </span>
              </div>
            </div>

            <p className="dialog-duration task-dialog-duration">
              {copy.tasks.dialog.duration(taskDuration)}
            </p>
          </>
        ) : null}

        <div className="dialog-actions task-dialog-actions">
          <button
            type="button"
            className="dialog-button primary"
            onClick={onSubmitTask}
          >
            {mode === "edit" || mode === "rename" ? copy.common.save : copy.common.ok}
          </button>
          <button type="button" className="dialog-button" onClick={onClose}>
            {copy.common.cancel}
          </button>
        </div>
      </div>
    </DialogFrame>
  );
};
