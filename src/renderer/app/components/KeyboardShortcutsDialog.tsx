import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutActionId,
  type ShortcutBindings,
  type ShortcutSection,
} from "@shared/shortcuts";
import { keyboardEventToShortcut } from "@renderer/hooks/use-shortcuts";
import { useI18n } from "@renderer/i18n";
import { DialogScrim } from "@renderer/ui/DialogScrim";
import { createDialogKeyDownHandler } from "@renderer/ui/dialog-keyboard";
import { useDialogInitialFocus } from "@renderer/ui/use-dialog-initial-focus";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  bindings: ShortcutBindings;
  conflicts: Partial<Record<ShortcutActionId, ShortcutActionId[]>>;
  onClose: () => void;
  onBindingChange: (actionId: ShortcutActionId, binding: string) => void;
  onResetAction: (actionId: ShortcutActionId) => void;
  onResetAll: () => void;
  onResetTooltips: () => void;
  onSave: () => void;
}

const SECTION_ORDER: ShortcutSection[] = [
  "File",
  "Edit",
  "Canvas / View",
  "Groups / Tasks",
  "Arrange",
  "Tools",
  "Window / App",
];

export const KeyboardShortcutsDialog = ({
  open,
  bindings,
  conflicts,
  onClose,
  onBindingChange,
  onResetAction,
  onResetAll,
  onResetTooltips,
  onSave,
}: KeyboardShortcutsDialogProps) => {
  const { copy } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [capturingActionId, setCapturingActionId] = useState<ShortcutActionId | null>(
    null,
  );

  useDialogInitialFocus(dialogRef, open);

  const sections = useMemo(
    () =>
      SECTION_ORDER.map((section) => ({
        section,
        definitions: SHORTCUT_DEFINITIONS.filter(
          (definition) => definition.section === section,
        ),
      })).filter((entry) => entry.definitions.length > 0),
    [],
  );

  if (!open) {
    return null;
  }

  const handleCaptureKey = (
    actionId: ShortcutActionId,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const binding = keyboardEventToShortcut(event.nativeEvent);
    if (!binding) {
      return;
    }

    onBindingChange(actionId, binding);
    setCapturingActionId(null);
  };

  return (
    <DialogScrim onClose={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="dialog-panel shortcut-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={copy.shortcutDialog.ariaLabel}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={createDialogKeyDownHandler({
          onClose,
          onConfirm: () => void onSave(),
          confirmDisabled: capturingActionId !== null,
        })}
        tabIndex={-1}
      >
        <header className="shortcut-dialog-header">
          <div>
            <h2>{copy.shortcutDialog.title}</h2>
            <p>{copy.shortcutDialog.description}</p>
          </div>
          <button type="button" className="dialog-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="shortcut-dialog-sections">
          {sections.map(({ section, definitions }) => (
            <section key={section} className="shortcut-dialog-section">
              <div className="shortcut-dialog-section-header">
                <strong>{copy.shortcuts.sections[section]}</strong>
              </div>
              <div className="shortcut-dialog-grid">
                {definitions.map((definition) => {
                  const isCapturing = capturingActionId === definition.id;
                  const hasConflict = Boolean(conflicts[definition.id]?.length);

                  return (
                    <div
                      key={definition.id}
                      className={`shortcut-row ${hasConflict ? "conflict" : ""}`}
                    >
                      <div className="shortcut-row-copy">
                        <span>{copy.shortcuts.actions[definition.id]}</span>
                        {definition.hint ? (
                          <small>{copy.shortcuts.hints[definition.id]}</small>
                        ) : null}
                      </div>
                      <div className="shortcut-row-actions">
                        <button
                          type="button"
                          className={`shortcut-binding-chip ${
                            isCapturing ? "capturing" : ""
                          }`}
                          onClick={() =>
                            setCapturingActionId((previous) =>
                              previous === definition.id ? null : definition.id,
                            )
                          }
                          onKeyDown={(event) =>
                            isCapturing
                              ? handleCaptureKey(definition.id, event)
                              : undefined
                          }
                        >
                          {isCapturing ? copy.shortcutDialog.pressKeys : bindings[definition.id]}
                        </button>
                        <button
                          type="button"
                          className="shortcut-reset-button"
                          onClick={() => {
                            onResetAction(definition.id);
                            setCapturingActionId(null);
                          }}
                        >
                          {copy.shortcutDialog.reset}
                        </button>
                      </div>
                      {hasConflict ? (
                        <p className="shortcut-conflict-copy">
                          {copy.shortcutDialog.duplicateBinding}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="shortcut-dialog-footer">
          <div className="shortcut-dialog-footer-tools">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                onResetAll();
                setCapturingActionId(null);
              }}
            >
              {copy.shortcutDialog.resetAll}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setCapturingActionId(null);
                onResetTooltips();
              }}
            >
              {copy.shortcutDialog.resetTooltips}
            </button>
          </div>
          <div className="shortcut-dialog-footer-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              {copy.common.cancel}
            </button>
            <button type="button" className="primary-button" onClick={() => void onSave()}>
              {copy.common.save}
            </button>
          </div>
        </footer>
      </div>
    </DialogScrim>
  );
};
