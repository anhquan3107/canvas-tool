import { useRef } from "react";
import { DialogScrim } from "@renderer/ui/DialogScrim";
import { createDialogKeyDownHandler } from "@renderer/ui/dialog-keyboard";
import { useDialogInitialFocus } from "@renderer/ui/use-dialog-initial-focus";
import { useI18n } from "@renderer/i18n";

const shortcutTokens = (shortcut?: string) => {
  if (!shortcut) {
    return [];
  }

  return shortcut
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean);
};

interface TitleBarTooltipConfirmDialogProps {
  open: boolean;
  label: string;
  description: string;
  shortcut?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const TitleBarTooltipConfirmDialog = ({
  open,
  label,
  description,
  shortcut,
  confirmLabel,
  onConfirm,
  onClose,
}: TitleBarTooltipConfirmDialogProps) => {
  const { copy } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useDialogInitialFocus(dialogRef, open);

  if (!open) {
    return null;
  }

  const tokens = shortcutTokens(shortcut);
  const resolvedConfirmLabel = confirmLabel ?? copy.common.gotIt;
  const descriptionBlocks = description
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <DialogScrim
      className="dialog-scrim titlebar-tooltip-dialog-scrim"
      role="presentation"
      onClose={onClose}
    >
      <div
        ref={dialogRef}
        className="dialog-card titlebar-tooltip-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${label} ${copy.topbar.toolGuideAriaSuffix}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={createDialogKeyDownHandler({
          onClose,
          onConfirm,
        })}
        tabIndex={-1}
      >
        <div className="titlebar-tooltip-dialog-topbar">
          <span className="titlebar-tooltip-dialog-topbar-label">
            {copy.confirmActionDialog.title}
          </span>
        </div>

        <div className="titlebar-tooltip-dialog-body">
          <div className="titlebar-tooltip-dialog-head">
            <h3>{label}</h3>
          </div>

          <div className="titlebar-tooltip-dialog-copy">
            {descriptionBlocks.map((block) => (
              <p key={block}>{block}</p>
            ))}
          </div>

          <div className="titlebar-tooltip-dialog-block">
            <span className="titlebar-tooltip-dialog-label">
              {copy.topbar.keyboardShortcut}
            </span>
            {tokens.length > 0 ? (
              <div className="titlebar-tooltip-dialog-keycaps">
                {tokens.map((token) => (
                  <kbd key={token} className="titlebar-tooltip-dialog-keycap">
                    {token}
                  </kbd>
                ))}
              </div>
            ) : (
              <span className="titlebar-tooltip-dialog-empty">
                {copy.topbar.noShortcutAssigned}
              </span>
            )}
          </div>
        </div>

        <div className="titlebar-tooltip-dialog-footer">
          <button
            type="button"
            className="primary-button titlebar-tooltip-dialog-confirm"
            onClick={onConfirm}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </DialogScrim>
  );
};
