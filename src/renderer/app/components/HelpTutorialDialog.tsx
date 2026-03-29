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

interface HelpFeature {
  icon: LucideIcon;
  label: string;
  purpose: string;
}

interface HelpSection {
  title: string;
  kicker: string;
  features: HelpFeature[];
}

interface HelpTutorialDialogProps {
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
          "Recenter and refit the working area so your content is easy to see again.",
      },
      {
        icon: WandSparkles,
        label: "Change Canvas Size",
        purpose:
          "Resize the active group’s board when you need more room or a tighter frame.",
      },
      {
        icon: Palette,
        label: "Background Color",
        purpose:
          "Set the canvas and surrounding background colors to match your mood or readability needs.",
      },
      {
        icon: Lock,
        label: "Lock Canvas",
        purpose:
          "Prevent accidental edits while you review, present, or compare references.",
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
  open,
  onClose,
}: HelpTutorialDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div
        className="help-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="CanvasTool tutorial"
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
                        <h3>{feature.label}</h3>
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
    </div>
  );
};
