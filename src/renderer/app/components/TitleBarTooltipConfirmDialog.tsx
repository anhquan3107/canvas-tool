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
  onConfirm: () => void;
  onClose: () => void;
}

export const TitleBarTooltipConfirmDialog = ({
  open,
  label,
  description,
  shortcut,
  onConfirm,
  onClose,
}: TitleBarTooltipConfirmDialogProps) => {
  if (!open) {
    return null;
  }

  const tokens = shortcutTokens(shortcut);

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
        <div className="titlebar-tooltip-dialog-head">
          <span className="titlebar-tooltip-dialog-eyebrow">Title Bar Guide</span>
          <h3>{label}</h3>
          <p>{description}</p>
        </div>

        <div className="titlebar-tooltip-dialog-grid">
          <div className="titlebar-tooltip-dialog-block">
            <span className="titlebar-tooltip-dialog-label">Function</span>
            <strong className="titlebar-tooltip-dialog-value">{label}</strong>
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
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
