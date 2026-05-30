import { useEffect } from "react";
import {
  createDialogDomKeyDownHandler,
  type DialogKeyboardOptions,
} from "@renderer/ui/dialog-keyboard";

export const useDialogKeyboardShortcuts = (
  {
    onClose,
    onConfirm,
    confirmDisabled = false,
  }: DialogKeyboardOptions,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = createDialogDomKeyDownHandler({
      onClose,
      onConfirm,
      confirmDisabled,
    });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmDisabled, enabled, onClose, onConfirm]);
};
