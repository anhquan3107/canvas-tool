import type { KeyboardEventHandler } from "react";

interface DialogKeyboardOptions {
  onClose: () => void;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
}

const isTextEntryInputType = (inputType: string) =>
  [
    "text",
    "search",
    "url",
    "tel",
    "email",
    "password",
    "number",
    "date",
    "datetime-local",
    "month",
    "time",
    "week",
  ].includes(inputType);

const shouldHandleEnterConfirm = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return true;
  }

  if (target.closest("[data-dialog-enter-ignore='true']")) {
    return false;
  }

  const textarea = target.closest("textarea");
  if (textarea) {
    return false;
  }

  const contentEditable = target.closest("[contenteditable='true']");
  if (contentEditable) {
    return false;
  }

  const interactiveTarget = target.closest("button, a[href], summary, select");
  if (interactiveTarget) {
    return false;
  }

  const input = target.closest("input");
  if (!(input instanceof HTMLInputElement)) {
    return true;
  }

  if (isTextEntryInputType(input.type)) {
    return true;
  }

  return false;
};

export const createDialogKeyDownHandler = ({
  onClose,
  onConfirm,
  confirmDisabled = false,
}: DialogKeyboardOptions): KeyboardEventHandler<HTMLElement> => {
  return (event) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (
      event.key !== "Enter" &&
      event.key !== "NumpadEnter"
    ) {
      return;
    }

    if (
      !onConfirm ||
      confirmDisabled ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !shouldHandleEnterConfirm(event.target)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onConfirm();
  };
};
