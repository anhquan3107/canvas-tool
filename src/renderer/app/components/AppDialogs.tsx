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
  setBackgroundColorDialogOpen: Dispatch<SetStateAction<boolean>>;
  setBackgroundColorPreview: Dispatch<
    SetStateAction<{
      canvasColor: string;
      backgroundColor: string;
    } | null>
  >;
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
  shortcutDraftBindings: ShortcutBindings;
  taskDates: TaskDateRange;
  taskDialogOpen: boolean;
  taskDuration: number;
  toast: { kind: "success" | "error" | "info"; message: string } | null;
  updateShortcutDraftBinding: (actionId: ShortcutActionId, binding: string) => void;
  changeCanvasColors: (canvasColor: string, backgroundColor: string) => void;
  onConfirmCloseCancel: () => void;
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
  setBackgroundColorDialogOpen,
  setBackgroundColorPreview,
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
  shortcutDraftBindings,
  taskDates,
  taskDialogOpen,
  taskDuration,
  toast,
  updateShortcutDraftBinding,
  changeCanvasColors,
  onConfirmCloseCancel,
}: AppDialogsProps) => (
  <>
    <ConfirmActionDialog
      open={Boolean(pendingDeletion)}
      title={
        pendingDeletion?.kind === "group"
          ? "Delete Group?"
          : "Delete Task?"
      }
      message={
        pendingDeletion?.kind === "group"
          ? `Delete ${pendingDeletion.label}? This will remove the entire group and everything inside it.`
          : pendingDeletion
            ? `Delete ${pendingDeletion.label}? This task and all its todos will be removed.`
            : ""
      }
      confirmLabel={pendingDeletion?.kind === "group" ? "Delete Group" : "Delete Task"}
      onConfirm={handleConfirmDeletion}
      onCancel={() => setPendingDeletion(null)}
    />

    <TitleBarTooltipConfirmDialog
      open={featureGuide !== null}
      label={featureGuide?.label ?? ""}
      description={featureGuide?.description ?? ""}
      shortcut={featureGuide?.shortcut}
      confirmLabel="Got it!"
      onClose={() => setFeatureGuide(null)}
      onConfirm={() => setFeatureGuide(null)}
    />

    <TaskDialog
      open={taskDialogOpen}
      mode={editingTaskId ? "edit" : "create"}
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
      onClose={() => {
        setBackgroundColorPreview(null);
        setBackgroundColorDialogOpen(false);
      }}
      onPreviewChange={setBackgroundColorPreview}
      onConfirm={(colors) => {
        setBackgroundColorPreview(null);
        changeCanvasColors(colors.canvasColor, colors.backgroundColor);
        setBackgroundColorDialogOpen(false);
      }}
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

    <HelpTutorialDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

    <ConfirmCloseDialog
      open={confirmCloseOpen}
      fileName={projectFileName}
      onSave={() => void handleSaveAndClose()}
      onDiscard={handleDiscardAndClose}
      onCancel={onConfirmCloseCancel}
    />

    {toast ? (
      <div className={`app-toast app-toast-${toast.kind}`}>
        {toast.message}
      </div>
    ) : null}
  </>
);
