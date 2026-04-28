import type { Dispatch, SetStateAction } from "react";
import {
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "@shared/project-defaults";
import type { ReferenceGroup } from "@shared/types/project";
import { BackgroundColorDialog } from "@renderer/app/components/BackgroundColorDialog";
import { CanvasSizeDialog } from "@renderer/app/components/CanvasSizeDialog";
import { ConfirmActionDialog } from "@renderer/app/components/ConfirmActionDialog";
import { ConfirmCloseDialog } from "@renderer/app/components/ConfirmCloseDialog";
import { HelpTutorialDialog } from "@renderer/app/components/HelpTutorialDialog";
import { KeyboardShortcutsDialog } from "@renderer/app/components/KeyboardShortcutsDialog";
import { TitleBarTooltipConfirmDialog } from "@renderer/app/components/TitleBarTooltipConfirmDialog";
import type { ToastState } from "@renderer/hooks/use-toast";
import { useI18n } from "@renderer/i18n";
import { ConnectDialog } from "@renderer/features/connect/components/ConnectDialog";
import type { CaptureQuality, CaptureSource } from "@renderer/features/connect/types";
import { GroupDialog } from "@renderer/features/groups/components/GroupDialog";
import { TaskDialog } from "@renderer/features/tasks/components/TaskDialog";
import type { TaskDateRange } from "@renderer/features/tasks/types";
import type { FeatureGuideState } from "@renderer/app/hooks/use-app-feature-guide";
import type { PendingDeletion } from "@renderer/app/hooks/use-app-deletion";
import type { ShortcutActionId, ShortcutBindings } from "@shared/shortcuts";

interface AppDialogsProps {
  activeGroup: ReferenceGroup | undefined;
  backgroundColorDialogOpen: boolean;
  backgroundColorPreview: {
    canvasColor: string;
    backgroundColor: string;
    windowOpacity: number;
  } | null;
  canvasHeightInput: string;
  canvasSizeDialogOpen: boolean;
  canvasWidthInput: string;
  captureQuality: CaptureQuality;
  captureSources: CaptureSource[];
  closeGroupDialog: () => void;
  closeShortcutDialog: () => void;
  confirmCloseOpen: boolean;
  connectDialogOpen: boolean;
  draftGroupName: string;
  draftTaskTitle: string;
  editingGroup: { id: string; currentName: string } | null;
  editingTaskId: string | null;
  taskDialogMode: "create" | "edit" | "rename";
  featureGuide: FeatureGuideState | null;
  groupDialogOpen: boolean;
  handleConfirmCanvasSizeDialog: () => void;
  handleConfirmConnect: () => void;
  handleConfirmDeletion: () => void;
  handleCreateGroup: () => void;
  handleDiscardAndClose: () => void;
  handleSaveAndClose: () => Promise<unknown>;
  handleSubmitTask: () => void;
  helpOpen: boolean;
  loadingCaptureSources: boolean;
  pendingDeletion: PendingDeletion;
  projectFileName: string;
  resetAllShortcutDraftBindings: () => void;
  resetShortcutDraftBinding: (actionId: ShortcutActionId) => void;
  resetTitleBarTooltips: () => Promise<unknown>;
  saveShortcutBindings: () => Promise<unknown>;
  selectedSourceId: string | null;
  setCanvasHeightInput: Dispatch<SetStateAction<string>>;
  setCanvasSizeDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCanvasWidthInput: Dispatch<SetStateAction<string>>;
  setCaptureQuality: (quality: CaptureQuality) => void;
  setConnectDialogOpen: Dispatch<SetStateAction<boolean>>;
  setDraftGroupName: Dispatch<SetStateAction<string>>;
  setDraftTaskTitle: Dispatch<SetStateAction<string>>;
  setFeatureGuide: Dispatch<SetStateAction<FeatureGuideState | null>>;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  setPendingDeletion: Dispatch<SetStateAction<PendingDeletion>>;
  setSelectedSourceId: (sourceId: string) => void;
  setTaskDates: Dispatch<SetStateAction<TaskDateRange>>;
  setTaskDialogOpen: Dispatch<SetStateAction<boolean>>;
  shortcutConflicts: Partial<Record<ShortcutActionId, ShortcutActionId[]>>;
  shortcutDialogOpen: boolean;
  shortcutBindings: ShortcutBindings;
  shortcutDraftBindings: ShortcutBindings;
  taskDates: TaskDateRange;
  taskDialogOpen: boolean;
  taskDuration: number;
  toast: ToastState | null;
  updateShortcutDraftBinding: (actionId: ShortcutActionId, binding: string) => void;
  onBackgroundColorDialogClose: () => void;
  onBackgroundColorPreviewChange: (colors: {
    canvasColor: string;
    backgroundColor: string;
    windowOpacity: number;
  }) => void;
  onBackgroundColorConfirm: (colors: {
    canvasColor: string;
    backgroundColor: string;
    windowOpacity: number;
  }) => void;
  onConfirmCloseCancel: () => void;
  windowOpacity: number;
}

export const AppDialogs = ({
  activeGroup,
  backgroundColorDialogOpen,
  backgroundColorPreview,
  canvasHeightInput,
  canvasSizeDialogOpen,
  canvasWidthInput,
  captureQuality,
  captureSources,
  closeGroupDialog,
  closeShortcutDialog,
  confirmCloseOpen,
  connectDialogOpen,
  draftGroupName,
  draftTaskTitle,
  editingGroup,
  editingTaskId,
  taskDialogMode,
  featureGuide,
  groupDialogOpen,
  handleConfirmCanvasSizeDialog,
  handleConfirmConnect,
  handleConfirmDeletion,
  handleCreateGroup,
  handleDiscardAndClose,
  handleSaveAndClose,
  handleSubmitTask,
  helpOpen,
  loadingCaptureSources,
  pendingDeletion,
  projectFileName,
  resetAllShortcutDraftBindings,
  resetShortcutDraftBinding,
  resetTitleBarTooltips,
  saveShortcutBindings,
  selectedSourceId,
  setCanvasHeightInput,
  setCanvasSizeDialogOpen,
  setCanvasWidthInput,
  setCaptureQuality,
  setConnectDialogOpen,
  setDraftGroupName,
  setDraftTaskTitle,
  setFeatureGuide,
  setHelpOpen,
  setPendingDeletion,
  setSelectedSourceId,
  setTaskDates,
  setTaskDialogOpen,
  shortcutConflicts,
  shortcutDialogOpen,
  shortcutBindings,
  shortcutDraftBindings,
  taskDates,
  taskDialogOpen,
  taskDuration,
  toast,
  updateShortcutDraftBinding,
  onBackgroundColorDialogClose,
  onBackgroundColorPreviewChange,
  onBackgroundColorConfirm,
  onConfirmCloseCancel,
  windowOpacity,
}: AppDialogsProps) => {
  const { copy } = useI18n();

  return (
    <>
    <ConfirmActionDialog
      open={Boolean(pendingDeletion)}
      title={
        pendingDeletion?.kind === "group"
          ? copy.dialogs.deleteGroupTitle
          : copy.dialogs.deleteTaskTitle
      }
      message={
        pendingDeletion?.kind === "group"
          ? copy.dialogs.deleteGroupMessage(pendingDeletion.label)
          : pendingDeletion
            ? copy.dialogs.deleteTaskMessage(pendingDeletion.label)
            : ""
      }
      confirmLabel={
        pendingDeletion?.kind === "group"
          ? copy.dialogs.deleteGroupConfirm
          : copy.dialogs.deleteTaskConfirm
      }
      onConfirm={handleConfirmDeletion}
      onCancel={() => setPendingDeletion(null)}
    />

    <TitleBarTooltipConfirmDialog
      open={featureGuide !== null}
      label={featureGuide?.label ?? ""}
      description={featureGuide?.description ?? ""}
      shortcut={featureGuide?.shortcut}
      confirmLabel={copy.common.gotIt}
      onClose={() => setFeatureGuide(null)}
      onConfirm={() => setFeatureGuide(null)}
    />

    <TaskDialog
      open={taskDialogOpen}
      mode={taskDialogMode}
      draftTaskTitle={draftTaskTitle}
      taskDates={taskDates}
      taskDuration={taskDuration}
      onClose={() => setTaskDialogOpen(false)}
      onSubmitTask={handleSubmitTask}
      onDraftTaskTitleChange={setDraftTaskTitle}
      onTaskDatesChange={setTaskDates}
    />

    <GroupDialog
      open={groupDialogOpen}
      draftGroupName={draftGroupName}
      mode={editingGroup ? "rename" : "create"}
      onClose={closeGroupDialog}
      onCreateGroup={handleCreateGroup}
      onDraftGroupNameChange={setDraftGroupName}
    />

    <ConnectDialog
      open={connectDialogOpen}
      loading={loadingCaptureSources}
      sources={captureSources}
      selectedSourceId={selectedSourceId}
      quality={captureQuality}
      onClose={() => setConnectDialogOpen(false)}
      onSelectSource={setSelectedSourceId}
      onQualityChange={setCaptureQuality}
      onConfirm={handleConfirmConnect}
    />

    <CanvasSizeDialog
      open={canvasSizeDialogOpen}
      widthValue={canvasWidthInput}
      heightValue={canvasHeightInput}
      onClose={() => setCanvasSizeDialogOpen(false)}
      onConfirm={handleConfirmCanvasSizeDialog}
      onWidthChange={setCanvasWidthInput}
      onHeightChange={setCanvasHeightInput}
    />

    <BackgroundColorDialog
      open={backgroundColorDialogOpen}
      canvasColor={
        backgroundColorPreview?.canvasColor ??
        activeGroup?.canvasColor ??
        DEFAULT_GROUP_CANVAS_COLOR
      }
      backgroundColor={
        backgroundColorPreview?.backgroundColor ??
        activeGroup?.backgroundColor ??
        DEFAULT_GROUP_BACKGROUND_COLOR
      }
      windowOpacity={backgroundColorPreview?.windowOpacity ?? windowOpacity}
      onClose={onBackgroundColorDialogClose}
      onPreviewChange={onBackgroundColorPreviewChange}
      onConfirm={onBackgroundColorConfirm}
    />

    <KeyboardShortcutsDialog
      open={shortcutDialogOpen}
      bindings={shortcutDraftBindings}
      conflicts={shortcutConflicts}
      onClose={closeShortcutDialog}
      onBindingChange={updateShortcutDraftBinding}
      onResetAction={resetShortcutDraftBinding}
      onResetAll={resetAllShortcutDraftBindings}
      onResetTooltips={() => void resetTitleBarTooltips()}
      onSave={() => void saveShortcutBindings()}
    />

    <HelpTutorialDialog
      open={helpOpen}
      shortcutBindings={shortcutBindings}
      onClose={() => setHelpOpen(false)}
    />

    <ConfirmCloseDialog
      open={confirmCloseOpen}
      fileName={projectFileName}
      onSave={() => void handleSaveAndClose()}
      onDiscard={handleDiscardAndClose}
      onCancel={onConfirmCloseCancel}
    />

    {toast ? (
      <div
        className={`app-toast app-toast-${toast.kind} ${
          typeof toast.progress === "number" ? "app-toast-progress" : ""
        }`}
      >
        <div className="app-toast-message">{toast.message}</div>
        {typeof toast.progress === "number" ? (
          <div className="app-toast-progress-track" aria-hidden="true">
            <div
              className="app-toast-progress-fill"
              style={{ width: `${toast.progress}%` }}
            />
          </div>
        ) : null}
      </div>
    ) : null}
    </>
  );
};
