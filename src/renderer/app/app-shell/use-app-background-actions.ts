import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { ReferenceGroup } from "@shared/types/project";

type PushToast = (kind: "success" | "error" | "info", message: string) => void;

type MenuState = {
  x: number;
  y: number;
} | null;

export type BackgroundColorPreviewState = {
  canvasColor: string;
  backgroundColor: string;
  windowOpacity: number;
};

interface UseAppBackgroundActionsOptions {
  activeGroup: ReferenceGroup | undefined;
  canvasHeightInput: string;
  canvasWidthInput: string;
  changeCanvasColors: (canvasColor: string, backgroundColor: string) => void;
  changeCanvasSize: (width: number, height: number) => void;
  pushToast: PushToast;
  setBackgroundColorDialogOpen: Dispatch<SetStateAction<boolean>>;
  setBackgroundColorPreview: Dispatch<
    SetStateAction<BackgroundColorPreviewState | null>
  >;
  setCanvasHeightInput: Dispatch<SetStateAction<string>>;
  setCanvasSizeDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCanvasWidthInput: Dispatch<SetStateAction<string>>;
  setMenuState: Dispatch<SetStateAction<MenuState>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setSwatchesHidden: Dispatch<SetStateAction<boolean>>;
  setWindowOpacity: Dispatch<SetStateAction<number | null>>;
  windowOpacity: number | null;
}

const clampWindowOpacity = (value: number) => Math.min(1, Math.max(0.05, value));

export const useAppBackgroundActions = ({
  activeGroup,
  canvasHeightInput,
  canvasWidthInput,
  changeCanvasColors,
  changeCanvasSize,
  pushToast,
  setBackgroundColorDialogOpen,
  setBackgroundColorPreview,
  setCanvasHeightInput,
  setCanvasSizeDialogOpen,
  setCanvasWidthInput,
  setMenuState,
  setSettingsOpen,
  setSwatchesHidden,
  setWindowOpacity,
  windowOpacity,
}: UseAppBackgroundActionsOptions) => {
  const handleOpenCanvasSizeDialog = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    setMenuState(null);
    setCanvasWidthInput(String(activeGroup.canvasSize.width));
    setCanvasHeightInput(String(activeGroup.canvasSize.height));
    setCanvasSizeDialogOpen(true);
  }, [
    activeGroup,
    setCanvasHeightInput,
    setCanvasSizeDialogOpen,
    setCanvasWidthInput,
    setMenuState,
  ]);

  const handleConfirmCanvasSizeDialog = useCallback(() => {
    const nextWidth = Number(canvasWidthInput);
    const nextHeight = Number(canvasHeightInput);

    if (
      !Number.isFinite(nextWidth) ||
      !Number.isFinite(nextHeight) ||
      nextWidth <= 0 ||
      nextHeight <= 0
    ) {
      pushToast("error", "Enter valid canvas width and height.");
      return;
    }

    changeCanvasSize(nextWidth, nextHeight);
    setCanvasSizeDialogOpen(false);
  }, [
    canvasHeightInput,
    canvasWidthInput,
    changeCanvasSize,
    pushToast,
    setCanvasSizeDialogOpen,
  ]);

  const handleOpenBackgroundColorDialog = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    setMenuState(null);
    setSettingsOpen(false);
    setBackgroundColorPreview({
      canvasColor: activeGroup.canvasColor,
      backgroundColor: activeGroup.backgroundColor,
      windowOpacity: windowOpacity ?? 1,
    });
    setBackgroundColorDialogOpen(true);
  }, [
    activeGroup,
    setBackgroundColorDialogOpen,
    setBackgroundColorPreview,
    setMenuState,
    setSettingsOpen,
    windowOpacity,
  ]);

  const handleCloseBackgroundColorDialog = useCallback(() => {
    setBackgroundColorPreview(null);
    setBackgroundColorDialogOpen(false);
  }, [setBackgroundColorDialogOpen, setBackgroundColorPreview]);

  const handleConfirmBackgroundColorDialog = useCallback(
    (colors: BackgroundColorPreviewState) => {
      const nextWindowOpacity = clampWindowOpacity(colors.windowOpacity);

      setBackgroundColorPreview(null);
      setWindowOpacity(nextWindowOpacity);
      changeCanvasColors(colors.canvasColor, colors.backgroundColor);
      setBackgroundColorDialogOpen(false);
      void window.desktopApi.window
        .setOpacity({
          opacity: nextWindowOpacity,
          persist: true,
        })
        .catch(() => null);
    },
    [
      changeCanvasColors,
      setBackgroundColorDialogOpen,
      setBackgroundColorPreview,
      setWindowOpacity,
    ],
  );

  const handleToggleSwatches = useCallback(() => {
    setSwatchesHidden((previous) => !previous);
  }, [setSwatchesHidden]);

  return {
    handleOpenCanvasSizeDialog,
    handleConfirmCanvasSizeDialog,
    handleOpenBackgroundColorDialog,
    handleCloseBackgroundColorDialog,
    handleConfirmBackgroundColorDialog,
    handleToggleSwatches,
  };
};
