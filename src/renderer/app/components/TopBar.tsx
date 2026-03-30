import { useState } from "react";
import { Settings } from "lucide-react";
import type { ReferenceGroup } from "@shared/types/project";
import type { ShortcutActionId, ShortcutBindings } from "@shared/shortcuts";
import { TOOL_LABELS, TOOL_ORDER } from "@renderer/features/tools/constants";
import type { ToolMode } from "@renderer/features/tools/types";
import {
  MenuItemContent,
  formatMenuShortcut,
} from "@renderer/app/components/MenuItemContent";
import { TitleBarTooltipConfirmDialog } from "@renderer/app/components/TitleBarTooltipConfirmDialog";

type TitleBarTooltipMeta = {
  id: string;
  label: string;
  description: string;
  shortcutActionId?: ShortcutActionId;
};

type PendingTitleBarAction = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  action: () => void;
};

const TOOL_TOOLTIP_META: Partial<Record<ToolMode, TitleBarTooltipMeta>> = {
  connect: {
    id: "topbar.tool.connect",
    label: "Connect",
    description:
      "Open the live capture tool so you can pull windows or screens into the board as reference.",
    shortcutActionId: "tools.connect",
  },
  doodle: {
    id: "topbar.tool.doodle",
    label: "Doodle",
    description:
      "Enter freehand annotation mode to sketch, mark up, or trace directly on the canvas.",
    shortcutActionId: "tools.toggleDoodle",
  },
  blur: {
    id: "topbar.tool.blur",
    label: "Blur",
    description:
      "Toggle blur on the active group to soften reference images and reduce detail while you study shape.",
    shortcutActionId: "tools.toggleBlur",
  },
  bw: {
    id: "topbar.tool.bw",
    label: "Black & White",
    description:
      "Switch the active group into grayscale so you can focus on values, contrast, and composition.",
    shortcutActionId: "tools.toggleBlackAndWhite",
  },
  ruler: {
    id: "topbar.tool.ruler",
    label: "Ruler",
    description:
      "Open ruler and measurement tools to check scale, spacing, and proportions on the board.",
  },
};

interface TopBarProps {
  activeGroup: ReferenceGroup | null | undefined;
  activeTool: ToolMode | null;
  shortcutBindings: ShortcutBindings;
  seenTitleBarTooltips: string[];
  settingsOpen: boolean;
  helpOpen: boolean;
  selectedCount: number;
  canCropSelected: boolean;
  canPaste: boolean;
  canExportSelectedTask: boolean;
  canExportAnyTask: boolean;
  canDeleteActiveGroup: boolean;
  canvasLocked: boolean;
  windowMaximized: boolean;
  windowAlwaysOnTop: boolean;
  onBrandClick: () => void;
  onToggleSettings: () => void;
  onShowHelp: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onExportCanvasImage: () => void;
  onExportGroupImages: () => void;
  onExportSelectedTaskHtml: () => void;
  onExportAllTasksHtml: () => void;
  onChangeCanvasSize: () => void;
  onToggleCanvasLock: () => void;
  onToolClick: (tool: ToolMode) => void;
  onAutoArrange: () => void;
  onToggleBlur: () => void;
  onToggleBlackAndWhite: () => void;
  onActivateDoodle: () => void;
  onShowBackgroundColor: () => void;
  onResetView: () => void;
  onTaskClick: () => void;
  onCreateGroup: () => void;
  onDeleteCurrentGroup: () => void;
  onShowShortcuts: () => void;
  onPaste: () => void;
  onCropSelected: () => void;
  onFlipSelectedHorizontally: () => void;
  onExit: () => void;
  onMinimize: () => void;
  onToggleAlwaysOnTop: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
  onMarkTitleBarTooltipSeen: (tooltipId: string) => void;
}

export const TopBar = ({
  activeGroup,
  activeTool,
  shortcutBindings,
  seenTitleBarTooltips,
  settingsOpen,
  helpOpen,
  selectedCount,
  canCropSelected,
  canPaste,
  canExportSelectedTask,
  canExportAnyTask,
  canDeleteActiveGroup,
  canvasLocked,
  windowMaximized,
  windowAlwaysOnTop,
  onBrandClick,
  onToggleSettings,
  onShowHelp,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onExportCanvasImage,
  onExportGroupImages,
  onExportSelectedTaskHtml,
  onExportAllTasksHtml,
  onChangeCanvasSize,
  onToggleCanvasLock,
  onToolClick,
  onAutoArrange,
  onToggleBlur,
  onToggleBlackAndWhite,
  onActivateDoodle,
  onShowBackgroundColor,
  onResetView,
  onTaskClick,
  onCreateGroup,
  onDeleteCurrentGroup,
  onShowShortcuts,
  onPaste,
  onCropSelected,
  onFlipSelectedHorizontally,
  onExit,
  onMinimize,
  onToggleAlwaysOnTop,
  onToggleMaximize,
  onCloseWindow,
  onMarkTitleBarTooltipSeen,
}: TopBarProps) => {
  const [exportOpen, setExportOpen] = useState(false);
  const [taskExportOpen, setTaskExportOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingTitleBarAction, setPendingTitleBarAction] =
    useState<PendingTitleBarAction | null>(null);

  const runTitleBarAction = (meta: TitleBarTooltipMeta, action: () => void) => {
    if (seenTitleBarTooltips.includes(meta.id)) {
      action();
      return;
    }

    onMarkTitleBarTooltipSeen(meta.id);
    setPendingTitleBarAction({
      id: meta.id,
      label: meta.label,
      description: meta.description,
      shortcut: formatMenuShortcut(shortcutBindings, meta.shortcutActionId),
      action,
    });
  };

  return (
    <>
      <header className="app-topbar">
        <div className="app-drag-region">
          <button
            type="button"
            className="topbar-brand"
            onClick={() =>
              runTitleBarAction(
                {
                  id: "topbar.brand",
                  label: "CanvasTool Info",
                  description:
                    "Open app information and project details from the title bar brand area.",
                },
                onBrandClick,
              )
            }
          >
            CanvasTool
          </button>

          <nav className="topbar-actions">
            <div
              className="topbar-settings-shell"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={`toolbar-button ${settingsOpen ? "active" : ""}`}
                onClick={() =>
                  runTitleBarAction(
                    {
                      id: "topbar.settings",
                      label: "Open Settings Menu",
                      description:
                        "Open the main command menu for file actions, export, arrange, filters, shortcuts, and app-level tools.",
                    },
                    onToggleSettings,
                  )
                }
              >
                Setting
              </button>

              {settingsOpen ? (
                <div className="topbar-settings-menu">
                  <button type="button" onClick={onOpenProject}>
                    <MenuItemContent
                      icon="open"
                      label="Open"
                      shortcut={formatMenuShortcut(shortcutBindings, "file.open")}
                    />
                  </button>
                  <button type="button" onClick={onSaveProject}>
                    <MenuItemContent
                      icon="save"
                      label="Save Canvas"
                      shortcut={formatMenuShortcut(shortcutBindings, "file.save")}
                    />
                  </button>
                  <button type="button" onClick={onSaveProjectAs}>
                    <MenuItemContent
                      icon="saveAs"
                      label="Save Canvas As..."
                      shortcut={formatMenuShortcut(shortcutBindings, "file.saveAs")}
                    />
                  </button>
                  <div
                    className="topbar-settings-submenu"
                    onPointerEnter={() => setExportOpen(true)}
                    onPointerLeave={() => {
                      setExportOpen(false);
                      setTaskExportOpen(false);
                    }}
                  >
                    <button
                      type="button"
                      className="topbar-settings-submenu-trigger"
                      onClick={() => setExportOpen((open) => !open)}
                    >
                      <MenuItemContent icon="export" label="Export" submenu />
                    </button>
                    {exportOpen ? (
                      <div className="topbar-settings-menu topbar-settings-submenu-panel">
                        <button type="button" onClick={onExportCanvasImage}>
                          <MenuItemContent
                            icon="export"
                            label="Export Canvas to Images"
                            shortcut={formatMenuShortcut(
                              shortcutBindings,
                              "export.canvasImage",
                            )}
                          />
                        </button>
                        <button type="button" onClick={onExportGroupImages}>
                          <MenuItemContent
                            icon="export"
                            label="Export Every Image to Folder"
                            shortcut={formatMenuShortcut(
                              shortcutBindings,
                              "export.groupImages",
                            )}
                          />
                        </button>
                        <div
                          className="topbar-settings-submenu"
                          onPointerEnter={() => setTaskExportOpen(true)}
                          onPointerLeave={() => setTaskExportOpen(false)}
                        >
                          <button
                            type="button"
                            className="topbar-settings-submenu-trigger"
                            onClick={() => setTaskExportOpen((open) => !open)}
                          >
                            <MenuItemContent
                              icon="task"
                              label="Export Tasks"
                              submenu
                            />
                          </button>
                          {taskExportOpen ? (
                            <div className="topbar-settings-menu topbar-settings-submenu-panel">
                              <button
                                type="button"
                                onClick={onExportSelectedTaskHtml}
                                disabled={!canExportSelectedTask}
                              >
                                <MenuItemContent
                                  icon="task"
                                  label="Export Selected Task to HTML"
                                />
                              </button>
                              <button
                                type="button"
                                onClick={onExportAllTasksHtml}
                                disabled={!canExportAnyTask}
                              >
                                <MenuItemContent
                                  icon="task"
                                  label="Export All Tasks to HTML"
                                  shortcut={formatMenuShortcut(
                                    shortcutBindings,
                                    "export.allTasks",
                                  )}
                                />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="topbar-settings-divider" />
                  <button type="button" onClick={onResetView}>
                    <MenuItemContent
                      icon="resetView"
                      label="Reset View"
                      shortcut={formatMenuShortcut(
                        shortcutBindings,
                        "canvas.resetView",
                      )}
                    />
                  </button>
                  <button type="button" onClick={onChangeCanvasSize}>
                    <MenuItemContent
                      icon="canvasSize"
                      label="Change Canvas Size..."
                      shortcut={formatMenuShortcut(
                        shortcutBindings,
                        "canvas.changeSize",
                      )}
                    />
                  </button>
                  <button type="button" onClick={onToggleCanvasLock}>
                    <MenuItemContent
                      icon="lock"
                      label={canvasLocked ? "Unlock Canvas" : "Lock Canvas"}
                      shortcut={formatMenuShortcut(
                        shortcutBindings,
                        "canvas.toggleLock",
                      )}
                    />
                  </button>

                  <div className="topbar-settings-divider" />
                  <button type="button" onClick={onCreateGroup}>
                    <MenuItemContent
                      icon="group"
                      label="Create Group"
                      shortcut={formatMenuShortcut(
                        shortcutBindings,
                        "groups.create",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteCurrentGroup}
                    disabled={!canDeleteActiveGroup}
                  >
                    <MenuItemContent icon="delete" label="Delete Current Group" />
                  </button>
                  <button type="button" onClick={onTaskClick}>
                    <MenuItemContent
                      icon="task"
                      label="Add Task"
                      shortcut={formatMenuShortcut(shortcutBindings, "tasks.add")}
                    />
                  </button>

                  <div className="topbar-settings-divider" />
                  <div
                    className="topbar-settings-submenu"
                    onPointerEnter={() => setArrangeOpen(true)}
                    onPointerLeave={() => setArrangeOpen(false)}
                  >
                    <button
                      type="button"
                      className="topbar-settings-submenu-trigger"
                      onClick={() => setArrangeOpen((open) => !open)}
                    >
                      <MenuItemContent icon="arrange" label="Arrange" submenu />
                    </button>
                    {arrangeOpen ? (
                      <div className="topbar-settings-menu topbar-settings-submenu-panel">
                        <button type="button" onClick={onAutoArrange}>
                          <MenuItemContent
                            icon="arrange"
                            label="Auto Arrange"
                            shortcut={formatMenuShortcut(
                              shortcutBindings,
                              "arrange.auto",
                            )}
                          />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="topbar-settings-divider" />
                  <button type="button" onClick={onShowBackgroundColor}>
                    <MenuItemContent
                      icon="background"
                      label="Change Background Color"
                    />
                  </button>
                  <div
                    className="topbar-settings-submenu"
                    onPointerEnter={() => setFilterOpen(true)}
                    onPointerLeave={() => setFilterOpen(false)}
                  >
                    <button
                      type="button"
                      className="topbar-settings-submenu-trigger"
                      onClick={() => setFilterOpen((open) => !open)}
                    >
                      <MenuItemContent icon="filter" label="Filter" submenu />
                    </button>
                    {filterOpen ? (
                      <div className="topbar-settings-menu topbar-settings-submenu-panel">
                        <button type="button" onClick={onToggleBlackAndWhite}>
                          <MenuItemContent
                            icon="filter"
                            label="B&W"
                            shortcut={formatMenuShortcut(
                              shortcutBindings,
                              "tools.toggleBlackAndWhite",
                            )}
                          />
                        </button>
                        <button type="button" onClick={onToggleBlur}>
                          <MenuItemContent
                            icon="filter"
                            label="Blur"
                            shortcut={formatMenuShortcut(
                              shortcutBindings,
                              "tools.toggleBlur",
                            )}
                          />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="topbar-settings-divider" />
                  <button type="button" onClick={onActivateDoodle}>
                    <MenuItemContent
                      icon="doodle"
                      label="Doodle"
                      shortcut={formatMenuShortcut(
                        shortcutBindings,
                        "tools.toggleDoodle",
                      )}
                    />
                  </button>

                  <div className="topbar-settings-divider" />
                  <button type="button" onClick={onShowShortcuts}>
                    <MenuItemContent icon="shortcuts" label="Keyboard Shortcut" />
                  </button>
                  <button type="button" disabled={!canPaste} onClick={onPaste}>
                    <MenuItemContent
                      icon="paste"
                      label="Paste"
                      shortcut={formatMenuShortcut(shortcutBindings, "edit.paste")}
                    />
                  </button>

                  {selectedCount > 0 ? (
                    <>
                      <div className="topbar-settings-divider" />
                      <button
                        type="button"
                        onClick={onCropSelected}
                        disabled={!canCropSelected}
                      >
                        <MenuItemContent
                          icon="crop"
                          label="Crop"
                          shortcut={formatMenuShortcut(shortcutBindings, "edit.crop")}
                        />
                      </button>
                      <button type="button" onClick={onFlipSelectedHorizontally}>
                        <MenuItemContent
                          icon="flip"
                          label="Flip Horizontal"
                          shortcut={formatMenuShortcut(
                            shortcutBindings,
                            "edit.flipHorizontal",
                          )}
                        />
                      </button>
                    </>
                  ) : null}

                  <div className="topbar-settings-divider" />
                  <button type="button" onClick={onExit}>
                    <MenuItemContent
                      icon="exit"
                      label="Exit"
                      shortcut={formatMenuShortcut(shortcutBindings, "app.quit")}
                    />
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={`toolbar-button ${helpOpen ? "active" : ""}`}
              onClick={() =>
                runTitleBarAction(
                  {
                    id: "topbar.help",
                    label: "Open Help Tutorial",
                    description:
                      "Open the built-in tutorial that explains the main workflow, tools, and features of the app.",
                  },
                  onShowHelp,
                )
              }
            >
              Help
            </button>

            {TOOL_ORDER.map((tool) => (
              <button
                key={tool}
                type="button"
                className={`toolbar-button ${
                  activeTool === tool ||
                  (tool === "blur" && (activeGroup?.filters.blur ?? 0) > 0) ||
                  (tool === "bw" && (activeGroup?.filters.grayscale ?? 0) > 0)
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  runTitleBarAction(
                    TOOL_TOOLTIP_META[tool] ?? {
                      id: `topbar.tool.${tool}`,
                      label: TOOL_LABELS[tool],
                      description: `Open the ${TOOL_LABELS[tool]} tool from the title bar.`,
                    },
                    () => onToolClick(tool),
                  )
                }
              >
                {TOOL_LABELS[tool]}
              </button>
            ))}

            <button
              type="button"
              className="toolbar-button"
              onClick={() =>
                runTitleBarAction(
                  {
                    id: "topbar.resetView",
                    label: "Reset View",
                    description:
                      "Return the canvas camera to its default framing so the board is easy to navigate again.",
                    shortcutActionId: "canvas.resetView",
                  },
                  onResetView,
                )
              }
            >
              Reset View
            </button>
            <button
              type="button"
              className="toolbar-button"
              onClick={() =>
                runTitleBarAction(
                  {
                    id: "topbar.task",
                    label: "Add Task",
                    description:
                      "Open the task panel so you can add or manage planning notes and todos for the project.",
                    shortcutActionId: "tasks.add",
                  },
                  onTaskClick,
                )
              }
            >
              Task
            </button>
            <button
              type="button"
              className="toolbar-button"
              onClick={() =>
                runTitleBarAction(
                  {
                    id: "topbar.createGroup",
                    label: "Create Group",
                    description:
                      "Create a new reference group so you can organize images, filters, and layout separately.",
                    shortcutActionId: "groups.create",
                  },
                  onCreateGroup,
                )
              }
            >
              Create Group
            </button>
          </nav>
        </div>

        <div className="window-cluster">
          <span className="locale-indicator">ENG</span>
          <button
            type="button"
            className="chrome-chip"
            onClick={() =>
              runTitleBarAction(
                {
                  id: "topbar.shortcuts",
                  label: "Open Keyboard Shortcuts",
                  description:
                    "Open shortcut settings to view, customize, and reset the app's keyboard bindings.",
                },
                onShowShortcuts,
              )
            }
            aria-label="Keyboard shortcuts"
          >
            <Settings size={13} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            className={`window-button ${windowAlwaysOnTop ? "active" : ""}`}
            onClick={() =>
              runTitleBarAction(
                {
                  id: "topbar.alwaysOnTop",
                  label: "Always on Top",
                  description:
                    "Keep the app floating above other windows so your reference board stays visible while you work.",
                  shortcutActionId: "window.toggleAlwaysOnTop",
                },
                onToggleAlwaysOnTop,
              )
            }
            aria-label="Toggle always on top"
          >
            ⇪
          </button>
          <button
            type="button"
            className="window-button"
            onClick={() =>
              runTitleBarAction(
                {
                  id: "topbar.minimize",
                  label: "Minimize Window",
                  description:
                    "Send the app to the dock or taskbar without closing your current project.",
                },
                onMinimize,
              )
            }
          >
            -
          </button>
          <button
            type="button"
            className="window-button"
            onClick={() =>
              runTitleBarAction(
                {
                  id: "topbar.maximize",
                  label: windowMaximized ? "Restore Window" : "Maximize Window",
                  description: windowMaximized
                    ? "Return the app window to its previous size."
                    : "Expand the app window to take up more screen space.",
                },
                onToggleMaximize,
              )
            }
          >
            {windowMaximized ? "❐" : "□"}
          </button>
          <button
            type="button"
            className="window-button close"
            onClick={() =>
              runTitleBarAction(
                {
                  id: "topbar.close",
                  label: "Close Window",
                  description:
                    "Close the current app window and trigger the normal save-check flow if there are unsaved changes.",
                },
                onCloseWindow,
              )
            }
          >
            ×
          </button>
        </div>
      </header>

      <TitleBarTooltipConfirmDialog
        open={pendingTitleBarAction !== null}
        label={pendingTitleBarAction?.label ?? ""}
        description={pendingTitleBarAction?.description ?? ""}
        shortcut={pendingTitleBarAction?.shortcut}
        onClose={() => setPendingTitleBarAction(null)}
        onConfirm={() => {
          if (!pendingTitleBarAction) {
            return;
          }

          const nextAction = pendingTitleBarAction.action;
          setPendingTitleBarAction(null);
          nextAction();
        }}
      />
    </>
  );
};
