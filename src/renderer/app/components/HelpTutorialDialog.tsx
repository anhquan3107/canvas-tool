import { useMemo, useRef } from "react";
import {
  BadgeInfo,
  BookOpenText,
  FolderOpen,
  ImagePlus,
  Keyboard,
  LayoutGrid,
  ListTodo,
  Lock,
  MonitorUp,
  MousePointer2,
  Palette,
  PencilLine,
  Rows3,
  Save,
  ScanSearch,
  SlidersHorizontal,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import type { ShortcutActionId, ShortcutBindings } from "@shared/shortcuts";
import { formatMenuShortcut } from "@renderer/app/components/MenuItemContent";
import { useI18n } from "@renderer/i18n";
import { DialogScrim } from "@renderer/ui/DialogScrim";
import { createDialogKeyDownHandler } from "@renderer/ui/dialog-keyboard";
import { useDialogInitialFocus } from "@renderer/ui/use-dialog-initial-focus";

interface HelpFeature {
  icon: LucideIcon;
  label: string;
  purpose: string;
  shortcutActionId?: ShortcutActionId;
}

interface HelpSection {
  title: string;
  kicker: string;
  features: HelpFeature[];
}

interface HelpTutorialDialogProps {
  shortcutBindings: ShortcutBindings;
  open: boolean;
  onClose: () => void;
}

export const HelpTutorialDialog = ({
  shortcutBindings,
  open,
  onClose,
}: HelpTutorialDialogProps) => {
  const { copy } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const sections = useMemo<HelpSection[]>(
    () => [
      {
        title: copy.helpDialog.sections.getStarted.title,
        kicker: copy.helpDialog.sections.getStarted.kicker,
        features: [
          {
            icon: FolderOpen,
            label: copy.helpDialog.sections.getStarted.openSaveTitle,
            purpose: copy.helpDialog.sections.getStarted.openSavePurpose,
          },
          {
            icon: MonitorUp,
            label: copy.helpDialog.sections.getStarted.exportTitle,
            purpose: copy.helpDialog.sections.getStarted.exportPurpose,
          },
          {
            icon: Keyboard,
            label: copy.helpDialog.sections.getStarted.shortcutsTitle,
            purpose: copy.helpDialog.sections.getStarted.shortcutsPurpose,
            shortcutActionId: "window.showSettings",
          },
        ],
      },
      {
        title: copy.helpDialog.sections.workspace.title,
        kicker: copy.helpDialog.sections.workspace.kicker,
        features: [
          {
            icon: ScanSearch,
            label: copy.helpDialog.sections.workspace.resetViewTitle,
            purpose: copy.helpDialog.sections.workspace.resetViewPurpose,
            shortcutActionId: "canvas.fitToWindow",
          },
          {
            icon: ScanSearch,
            label: copy.helpDialog.sections.workspace.fitToContentTitle,
            purpose: copy.helpDialog.sections.workspace.fitToContentPurpose,
            shortcutActionId: "canvas.resetView",
          },
          {
            icon: WandSparkles,
            label: copy.helpDialog.sections.workspace.canvasSizeTitle,
            purpose: copy.helpDialog.sections.workspace.canvasSizePurpose,
            shortcutActionId: "canvas.changeSize",
          },
          {
            icon: Palette,
            label: copy.helpDialog.sections.workspace.backgroundTitle,
            purpose: copy.helpDialog.sections.workspace.backgroundPurpose,
          },
          {
            icon: Palette,
            label: copy.helpDialog.sections.workspace.swatchesTitle,
            purpose: copy.helpDialog.sections.workspace.swatchesPurpose,
            shortcutActionId: "canvas.toggleSwatches",
          },
          {
            icon: Lock,
            label: copy.helpDialog.sections.workspace.lockTitle,
            purpose: copy.helpDialog.sections.workspace.lockPurpose,
            shortcutActionId: "canvas.toggleLock",
          },
        ],
      },
      {
        title: copy.helpDialog.sections.organization.title,
        kicker: copy.helpDialog.sections.organization.kicker,
        features: [
          {
            icon: Rows3,
            label: copy.helpDialog.sections.organization.groupTitle,
            purpose: copy.helpDialog.sections.organization.groupPurpose,
          },
          {
            icon: ListTodo,
            label: copy.helpDialog.sections.organization.taskTitle,
            purpose: copy.helpDialog.sections.organization.taskPurpose,
          },
          {
            icon: LayoutGrid,
            label: copy.helpDialog.sections.organization.arrangeTitle,
            purpose: copy.helpDialog.sections.organization.arrangePurpose,
          },
        ],
      },
      {
        title: copy.helpDialog.sections.visualTools.title,
        kicker: copy.helpDialog.sections.visualTools.kicker,
        features: [
          {
            icon: ImagePlus,
            label: copy.helpDialog.sections.visualTools.connectTitle,
            purpose: copy.helpDialog.sections.visualTools.connectPurpose,
          },
          {
            icon: PencilLine,
            label: copy.helpDialog.sections.visualTools.doodleTitle,
            purpose: copy.helpDialog.sections.visualTools.doodlePurpose,
          },
          {
            icon: SlidersHorizontal,
            label: copy.helpDialog.sections.visualTools.filterTitle,
            purpose: copy.helpDialog.sections.visualTools.filterPurpose,
          },
          {
            icon: BadgeInfo,
            label: copy.helpDialog.sections.visualTools.zoomTitle,
            purpose: copy.helpDialog.sections.visualTools.zoomPurpose,
          },
        ],
      },
      {
        title: copy.helpDialog.sections.interaction.title,
        kicker: copy.helpDialog.sections.interaction.kicker,
        features: [
          {
            icon: MousePointer2,
            label: copy.helpDialog.sections.interaction.contextMenuTitle,
            purpose: copy.helpDialog.sections.interaction.contextMenuPurpose,
          },
          {
            icon: Save,
            label: copy.helpDialog.sections.interaction.importTitle,
            purpose: copy.helpDialog.sections.interaction.importPurpose,
          },
          {
            icon: BookOpenText,
            label: copy.helpDialog.sections.interaction.statusTitle,
            purpose: copy.helpDialog.sections.interaction.statusPurpose,
          },
        ],
      },
    ],
    [copy],
  );

  useDialogInitialFocus(dialogRef, open);

  if (!open) {
    return null;
  }

  return (
    <DialogScrim onClose={onClose}>
      <div
        ref={dialogRef}
        className="help-dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={createDialogKeyDownHandler({ onClose })}
        role="dialog"
        aria-modal="true"
        aria-label={copy.helpDialog.ariaLabel}
        tabIndex={-1}
      >
        <header className="help-dialog-header">
          <div className="help-dialog-title-block">
            <span className="help-dialog-kicker">{copy.helpDialog.kicker}</span>
            <h2>{copy.helpDialog.title}</h2>
            <p className="help-dialog-lead">{copy.helpDialog.lead}</p>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label={copy.helpDialog.closeHelp}
          >
            ×
          </button>
        </header>

        <div className="help-guide-grid">
          {sections.map((section) => (
            <section key={section.title} className="help-section-card">
              <div className="help-section-header">
                <strong>{section.title}</strong>
                <span>{section.kicker}</span>
              </div>

              <div className="help-feature-list">
                {section.features.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <article key={feature.label} className="help-feature-item">
                      <div className="help-feature-icon">
                        <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
                      </div>
                      <div className="help-feature-copy">
                        <h3>
                          {feature.label}
                          {feature.shortcutActionId ? (
                            <span className="help-feature-shortcut">
                              {formatMenuShortcut(
                                shortcutBindings,
                                feature.shortcutActionId,
                              )}
                            </span>
                          ) : null}
                        </h3>
                        <p>{feature.purpose}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </DialogScrim>
  );
};
