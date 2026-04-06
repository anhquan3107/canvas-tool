import { useCallback, type Dispatch, type SetStateAction } from "react";

interface UseAppDialogActionsOptions {
  clearTransientUi: () => void;
  openShortcutDialog: () => void;
  shortcutDialogOpen: boolean;
  setAppInfoOpen: Dispatch<SetStateAction<boolean>>;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
}

export const useAppDialogActions = ({
  clearTransientUi,
  openShortcutDialog,
  shortcutDialogOpen,
  setAppInfoOpen,
  setHelpOpen,
  setSettingsOpen,
}: UseAppDialogActionsOptions) => {
  const handleBrandClick = useCallback(() => {
    setAppInfoOpen((previous) => !previous);
  }, [setAppInfoOpen]);

  const handleToggleSettings = useCallback(() => {
    setSettingsOpen((previous) => !previous);
  }, [setSettingsOpen]);

  const handleShowHelp = useCallback(() => {
    setSettingsOpen(false);
    setHelpOpen((previous) => !previous);
  }, [setHelpOpen, setSettingsOpen]);

  const handleShowShortcutsShortcut = useCallback(() => {
    const shouldOpenShortcutDialog = !shortcutDialogOpen;

    clearTransientUi();

    if (shouldOpenShortcutDialog) {
      openShortcutDialog();
    }
  }, [clearTransientUi, openShortcutDialog, shortcutDialogOpen]);

  return {
    handleBrandClick,
    handleToggleSettings,
    handleShowHelp,
    handleShowShortcutsShortcut,
  };
};
