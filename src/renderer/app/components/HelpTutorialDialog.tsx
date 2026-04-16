import { useRef } from "react";
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

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Get Started",
    kicker: "Open, save, and ship your board.",
    features: [
      {
        icon: FolderOpen,
        label: "Open / Save Canvas",
        purpose:
          "Load an existing reference board, save your progress, or save a copy under a new name.",
      },
      {
        icon: MonitorUp,
        label: "Export",
        purpose:
          "Turn the current canvas, image set, tasks, or swatches into shareable output.",
      },
      {
        icon: Keyboard,
        label: "Keyboard Shortcuts",
        purpose:
          "Customize your keybinds so the app matches the way you work.",
        shortcutActionId: "window.showSettings",
      },
    ],
  },
  {
    title: "Shape The Workspace",
    kicker: "Control the board itself.",
    features: [
      {
        icon: ScanSearch,
        label: "Reset View",
        purpose:
          "Restore the current canvas view to a clean centered framing without resizing the board.",
        shortcutActionId: "canvas.fitToWindow",
      },
      {
        icon: ScanSearch,
        label: "Fit Canvas to Content",
        purpose:
          "Resize and refit the working area around your content so everything is easy to see again.",
        shortcutActionId: "canvas.resetView",
      },
      {
        icon: WandSparkles,
        label: "Change Canvas Size",
        purpose:
          "Resize the active group’s board when you need more room or a tighter frame.",
        shortcutActionId: "canvas.changeSize",
      },
      {
        icon: Palette,
        label: "Background Color",
        purpose:
          "Set the canvas and surrounding background colors to match your mood or readability needs.",
      },
      {
        icon: Palette,
        label: "Hide / Show Swatches",
        purpose:
          "Temporarily hide the color swatch chips shown on images so you can review the board more cleanly.",
        shortcutActionId: "canvas.toggleSwatches",
      },
      {
        icon: Lock,
        label: "Lock / Unlock Canvas",
        purpose:
          "Prevent accidental edits while you review, present, or compare references.",
        shortcutActionId: "canvas.toggleLock",
      },
    ],
  },
  {
    title: "Organize Ideas",
    kicker: "Structure references and planning together.",
    features: [
      {
        icon: Rows3,
        label: "Create Group",
        purpose:
          "Split a project into separate boards for subjects, scenes, outfits, or phases.",
      },
      {
        icon: ListTodo,
        label: "Add Task",
        purpose:
          "Track what you still need to gather, decide, or finish alongside the visual board.",
      },
      {
        icon: LayoutGrid,
        label: "Arrange",
        purpose:
          "Automatically line up or reflow images so the board stays readable and tidy.",
      },
    ],
  },
  {
    title: "Visual Tools",
    kicker: "Inspect, annotate, and compare.",
    features: [
      {
        icon: ImagePlus,
        label: "Connect",
        purpose:
          "Open a live capture window for another app or screen and keep it beside your board.",
      },
      {
        icon: PencilLine,
        label: "Doodle",
        purpose:
          "Sketch notes, mark proportions, paint over references, or erase temporary callouts.",
      },
      {
        icon: SlidersHorizontal,
        label: "Blur / B&W Filter",
        purpose:
          "Reduce detail or color noise so you can focus on values, silhouette, and composition.",
      },
      {
        icon: BadgeInfo,
        label: "Zoom Overlay + Ruler",
        purpose:
          "Open an image in focused view, step through references, and add guide lines for measurement.",
      },
    ],
  },
  {
    title: "Fast Interaction",
    kicker: "Use the app fluidly during a real session.",
    features: [
      {
        icon: MousePointer2,
        label: "Right-Click Menu",
        purpose:
          "Access the most common actions quickly without moving back to the top bar.",
      },
      {
        icon: Save,
        label: "Drag, Drop, Paste",
        purpose:
          "Bring in references from files, clipboard images, or links as fast as you find them.",
      },
      {
        icon: BookOpenText,
        label: "Status Bar + Overlays",
        purpose:
          "Keep track of selection count, zoom, canvas size, tasks, groups, and auto-arrange state while working.",
      },
    ],
  },
];

export const HelpTutorialDialog = ({
  shortcutBindings,
  open,
  onClose,
}: HelpTutorialDialogProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);

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
        aria-label="CanvasTool tutorial"
        tabIndex={-1}
      >
        <header className="help-dialog-header">
          <div className="help-dialog-title-block">
            <span className="help-dialog-kicker">Help</span>
            <h2>CanvasTool Feature Guide</h2>
            <p className="help-dialog-lead">
              A quick walkthrough of what each major feature is for, so the app
              feels easier to learn and faster to use.
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label="Close help"
          >
            ×
          </button>
        </header>

        <div className="help-guide-grid">
          {HELP_SECTIONS.map((section) => (
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
