import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { BackgroundColorPreviewState } from "./use-app-background-actions";

type MenuState = {
  x: number;
  y: number;
} | null;

type CropSession = {
  itemId: string;
  rect: { left: number; top: number; right: number; bottom: number };
} | null;

type ShellRightClickGesture = {
  active: boolean;
  moved: boolean;
  startX: number;
  startY: number;
};

interface UseAppMenuActionsOptions {
  backgroundColorDialogOpen: boolean;
  canvasSizeDialogOpen: boolean;
  closeShortcutDialog: () => void;
  closeZoomOverlay: () => void;
  groupDialogOpen: boolean;
  helpOpen: boolean;
  menuState: MenuState;
  settingsOpen: boolean;
  taskDialogOpen: boolean;
  setAppInfoOpen: Dispatch<SetStateAction<boolean>>;
  setBackgroundColorDialogOpen: Dispatch<SetStateAction<boolean>>;
  setBackgroundColorPreview: Dispatch<
    SetStateAction<BackgroundColorPreviewState | null>
  >;
  setCanvasSizeDialogOpen: Dispatch<SetStateAction<boolean>>;
  setConnectDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCropSession: Dispatch<SetStateAction<CropSession>>;
  setGroupDialogOpen: Dispatch<SetStateAction<boolean>>;
  setGroupsOverlayOpen: Dispatch<SetStateAction<boolean>>;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  setMenuState: Dispatch<SetStateAction<MenuState>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setTaskDetailOpen: Dispatch<SetStateAction<boolean>>;
  setTaskDialogOpen: Dispatch<SetStateAction<boolean>>;
}

const SHELL_RIGHT_CLICK_DRAG_THRESHOLD = 5;

const isTypingElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
};

const shouldIgnoreShellRightClickTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (isTypingElement(target)) {
    return true;
  }

  return Boolean(
    target.closest(
      ".app-topbar, .topbar-settings-shell, .group-overlay-shell, .task-overlay-shell, [data-window-no-drag='true']",
    ),
  );
};

export const useAppMenuActions = ({
  backgroundColorDialogOpen,
  canvasSizeDialogOpen,
  closeShortcutDialog,
  closeZoomOverlay,
  groupDialogOpen,
  helpOpen,
  menuState,
  settingsOpen,
  taskDialogOpen,
  setAppInfoOpen,
  setBackgroundColorDialogOpen,
  setBackgroundColorPreview,
  setCanvasSizeDialogOpen,
  setConnectDialogOpen,
  setCropSession,
  setGroupDialogOpen,
  setGroupsOverlayOpen,
  setHelpOpen,
  setMenuState,
  setSettingsOpen,
  setTaskDetailOpen,
  setTaskDialogOpen,
}: UseAppMenuActionsOptions) => {
  const shellRightClickGestureRef = useRef<ShellRightClickGesture>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
  });

  const clearTransientUi = useCallback(() => {
    setMenuState(null);
    setTaskDialogOpen(false);
    setGroupDialogOpen(false);
    setSettingsOpen(false);
    setHelpOpen(false);
    setCanvasSizeDialogOpen(false);
    setBackgroundColorDialogOpen(false);
    setBackgroundColorPreview(null);
    setAppInfoOpen(false);
    setTaskDetailOpen(false);
    setConnectDialogOpen(false);
    setGroupsOverlayOpen(false);
    setCropSession(null);
    closeShortcutDialog();
    closeZoomOverlay();
  }, [
    closeShortcutDialog,
    closeZoomOverlay,
    setAppInfoOpen,
    setBackgroundColorDialogOpen,
    setBackgroundColorPreview,
    setCanvasSizeDialogOpen,
    setConnectDialogOpen,
    setCropSession,
    setGroupDialogOpen,
    setGroupsOverlayOpen,
    setHelpOpen,
    setMenuState,
    setSettingsOpen,
    setTaskDetailOpen,
    setTaskDialogOpen,
  ]);

  useEffect(() => {
    if (
      !menuState &&
      !taskDialogOpen &&
      !groupDialogOpen &&
      !settingsOpen &&
      !helpOpen &&
      !canvasSizeDialogOpen &&
      !backgroundColorDialogOpen
    ) {
      return;
    }

    const handlePointer = (event: PointerEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(".topbar-settings-shell")
      ) {
        return;
      }

      setMenuState(null);
      setSettingsOpen(false);
    };

    window.addEventListener("pointerdown", handlePointer);

    return () => {
      window.removeEventListener("pointerdown", handlePointer);
    };
  }, [
    backgroundColorDialogOpen,
    canvasSizeDialogOpen,
    groupDialogOpen,
    helpOpen,
    menuState,
    settingsOpen,
    taskDialogOpen,
    setMenuState,
    setSettingsOpen,
  ]);

  useEffect(() => {
    const resetShellRightClickGesture = () => {
      shellRightClickGestureRef.current = {
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
      };
    };

    window.addEventListener("blur", resetShellRightClickGesture);
    return () => {
      window.removeEventListener("blur", resetShellRightClickGesture);
    };
  }, []);

  const handleShellPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 2) {
        return;
      }

      if (shouldIgnoreShellRightClickTarget(event.target)) {
        shellRightClickGestureRef.current = {
          active: false,
          moved: false,
          startX: 0,
          startY: 0,
        };
        return;
      }

      shellRightClickGestureRef.current = {
        active: true,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
      };
    },
    [],
  );

  const handleShellPointerMoveCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = shellRightClickGestureRef.current;
      if (!gesture.active || (event.buttons & 2) === 0 || gesture.moved) {
        return;
      }

      if (
        Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >=
        SHELL_RIGHT_CLICK_DRAG_THRESHOLD
      ) {
        gesture.moved = true;
      }
    },
    [],
  );

  const handleShellPointerUpCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 2) {
        return;
      }

      const gesture = shellRightClickGestureRef.current;
      const shouldOpenMenu =
        gesture.active &&
        !gesture.moved &&
        !event.defaultPrevented &&
        !shouldIgnoreShellRightClickTarget(event.target);

      shellRightClickGestureRef.current = {
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
      };

      if (!shouldOpenMenu) {
        return;
      }

      event.preventDefault();
      setMenuState({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [setMenuState],
  );

  const handleShellContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const wasDefaultPrevented = event.defaultPrevented;
      event.preventDefault();

      if (
        wasDefaultPrevented ||
        shouldIgnoreShellRightClickTarget(event.target)
      ) {
        return;
      }

      shellRightClickGestureRef.current = {
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
      };

      setMenuState({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [setMenuState],
  );

  return {
    clearTransientUi,
    handleShellPointerDownCapture,
    handleShellPointerMoveCapture,
    handleShellPointerUpCapture,
    handleShellContextMenu,
  };
};
