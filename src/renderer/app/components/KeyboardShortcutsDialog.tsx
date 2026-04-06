import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutActionId,
  type ShortcutBindings,
  type ShortcutSection,
} from "@shared/shortcuts";
import { keyboardEventToShortcut } from "@renderer/hooks/use-shortcuts";
import { DialogScrim } from "@renderer/ui/DialogScrim";

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
  const [capturingActionId, setCapturingActionId] = useState<ShortcutActionId | null>(
    null,
  );

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
        className="dialog-panel shortcut-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shortcut-dialog-header">
          <div>
            <h2>Keyboard Shortcut</h2>
            <p>Adjust the bindings and save them into the application settings.</p>
          </div>
          <button type="button" className="dialog-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="shortcut-dialog-sections">
          {sections.map(({ section, definitions }) => (
            <section key={section} className="shortcut-dialog-section">
              <div className="shortcut-dialog-section-header">
                <strong>{section}</strong>
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
                        <span>{definition.label}</span>
                        {definition.hint ? <small>{definition.hint}</small> : null}
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
                          {isCapturing ? "Press keys..." : bindings[definition.id]}
                        </button>
                        <button
                          type="button"
                          className="shortcut-reset-button"
                          onClick={() => {
                            onResetAction(definition.id);
                            setCapturingActionId(null);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                      {hasConflict ? (
                        <p className="shortcut-conflict-copy">
                          Duplicate binding. Pick a unique shortcut before saving.
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
              Reset All
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setCapturingActionId(null);
                onResetTooltips();
              }}
            >
              Reset Tooltips
            </button>
          </div>
          <div className="shortcut-dialog-footer-actions">
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={() => void onSave()}>
              Save
            </button>
          </div>
        </footer>
      </div>
    </DialogScrim>
  );
};
