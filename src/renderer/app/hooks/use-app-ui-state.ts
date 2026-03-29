import { useRef, useState } from "react";
import type { CanvasItem } from "@shared/types/project";
import type { CanvasSizePreview, MenuState } from "@renderer/app/types";

export const useAppUiState = () => {
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [lastImportedItemIds, setLastImportedItemIds] = useState<string[]>([]);
  const [clipboardItems, setClipboardItems] = useState<CanvasItem[]>([]);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [canvasSizePreview, setCanvasSizePreview] =
    useState<CanvasSizePreview | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [autoArrangeOnImport, setAutoArrangeOnImport] = useState(true);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [groupsOverlayOpen, setGroupsOverlayOpen] = useState(false);
  const [canvasSizeDialogOpen, setCanvasSizeDialogOpen] = useState(false);
  const [backgroundColorDialogOpen, setBackgroundColorDialogOpen] =
    useState(false);
  const [canvasWidthInput, setCanvasWidthInput] = useState("");
  const [canvasHeightInput, setCanvasHeightInput] = useState("");
  const hasInitializedViewRef = useRef(false);
  const centeredGroupIdsRef = useRef(new Set<string>());
  const previousActiveGroupIdRef = useRef<string | null>(null);
  const lastSavedSignatureRef = useRef<string>("");

  return {
    recentFiles,
    setRecentFiles,
    selectedItemIds,
    setSelectedItemIds,
    lastImportedItemIds,
    setLastImportedItemIds,
    clipboardItems,
    setClipboardItems,
    appInfoOpen,
    setAppInfoOpen,
    canvasSizePreview,
    setCanvasSizePreview,
    snapEnabled,
    setSnapEnabled,
    autoArrangeOnImport,
    setAutoArrangeOnImport,
    menuState,
    setMenuState,
    settingsOpen,
    setSettingsOpen,
    helpOpen,
    setHelpOpen,
    groupsOverlayOpen,
    setGroupsOverlayOpen,
    canvasSizeDialogOpen,
    setCanvasSizeDialogOpen,
    backgroundColorDialogOpen,
    setBackgroundColorDialogOpen,
    canvasWidthInput,
    setCanvasWidthInput,
    canvasHeightInput,
    setCanvasHeightInput,
    hasInitializedViewRef,
    centeredGroupIdsRef,
    previousActiveGroupIdRef,
    lastSavedSignatureRef,
  };
};
