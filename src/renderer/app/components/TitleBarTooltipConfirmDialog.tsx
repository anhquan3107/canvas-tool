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
  confirmLabel = "Got it",
  onConfirm,
  onClose,
}: TitleBarTooltipConfirmDialogProps) => {
  if (!open) {
    return null;
  }

  const tokens = shortcutTokens(shortcut);
  const shortcutLabel = tokens.length > 0 ? tokens.join(" + ") : "No shortcut assigned";
  const descriptionBlocks = description
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div
      className="dialog-scrim titlebar-tooltip-dialog-scrim"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="dialog-card titlebar-tooltip-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${label} shortcut guide`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="titlebar-tooltip-dialog-topbar">
          <span className="titlebar-tooltip-dialog-topbar-label">Tool Guide</span>
        </div>

        <div className="titlebar-tooltip-dialog-body">
          <div className="titlebar-tooltip-dialog-head">
            <h3>{label}</h3>
          </div>

          <div className="titlebar-tooltip-dialog-copy">
            <p className="titlebar-tooltip-dialog-shortcut-line">
              <strong>{shortcutLabel}</strong>
            </p>
            {descriptionBlocks.map((block) => (
              <p key={block}>{block}</p>
            ))}
          </div>

          <div className="titlebar-tooltip-dialog-block">
            <span className="titlebar-tooltip-dialog-label">Keyboard Shortcut</span>
            {tokens.length > 0 ? (
              <div className="titlebar-tooltip-dialog-keycaps">
                {tokens.map((token) => (
                  <kbd key={token} className="titlebar-tooltip-dialog-keycap">
                    {token}
                  </kbd>
                ))}
              </div>
            ) : (
              <span className="titlebar-tooltip-dialog-empty">No shortcut assigned</span>
            )}
          </div>
        </div>

        <div className="titlebar-tooltip-dialog-footer">
          <button
            type="button"
            className="primary-button titlebar-tooltip-dialog-confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
