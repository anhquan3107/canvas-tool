import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Task } from "@shared/types/project";

const TASK_IDLE_TIMEOUT_MS = 5000;
const TASK_SELECTION_HIDE_DURATION_MS = 640;

interface UseTaskDetailPanelOptions {
  primaryTask: Task | null;
  selectedTask: Task | null;
  selectedTaskId: string | null;
  taskListExpanded: boolean;
  setTaskListExpanded: Dispatch<SetStateAction<boolean>>;
  taskCreationPreviewActive: boolean;
  setTaskCreationPreviewActive: Dispatch<SetStateAction<boolean>>;
  pendingTaskSelectionDismissal: boolean;
  setPendingTaskSelectionDismissal: Dispatch<SetStateAction<boolean>>;
  setSelectedTaskId: Dispatch<SetStateAction<string | null>>;
}

export const useTaskDetailPanel = ({
  primaryTask,
  selectedTask,
  selectedTaskId,
  taskListExpanded,
  setTaskListExpanded,
  taskCreationPreviewActive,
  setTaskCreationPreviewActive,
  pendingTaskSelectionDismissal,
  setPendingTaskSelectionDismissal,
  setSelectedTaskId,
}: UseTaskDetailPanelOptions) => {
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskDetailPinned, setTaskDetailPinned] = useState(false);
  const [taskOverlayActivityVersion, setTaskOverlayActivityVersion] = useState(0);
  const [taskDetailActivityVersion, setTaskDetailActivityVersion] = useState(0);
  const [taskOverlayHoveredTaskId, setTaskOverlayHoveredTaskId] =
    useState<string | null>(null);
  const [taskDetailHoveredTaskId, setTaskDetailHoveredTaskId] =
    useState<string | null>(null);
  const [taskDetailFocusedTaskId, setTaskDetailFocusedTaskId] =
    useState<string | null>(null);
  const collapseAfterDeadlineTimerRef = useRef<number | null>(null);
  const primaryTaskId = primaryTask?.id ?? null;
  const selectedTaskStableId = selectedTask?.id ?? null;
  const taskOverlayHovered =
    taskOverlayHoveredTaskId !== null && taskOverlayHoveredTaskId === primaryTaskId;
  const taskDetailHovered =
    taskDetailHoveredTaskId !== null && taskDetailHoveredTaskId === selectedTaskStableId;
  const taskDetailFocused =
    taskDetailFocusedTaskId !== null && taskDetailFocusedTaskId === selectedTaskStableId;

  const registerTaskOverlayInteraction = useCallback(() => {
    setTaskOverlayActivityVersion((version) => version + 1);
  }, []);

  const registerTaskDetailInteraction = useCallback(() => {
    setTaskDetailActivityVersion((version) => version + 1);
  }, []);

  const clearCollapseAfterDeadlineTimer = useCallback(() => {
    if (collapseAfterDeadlineTimerRef.current !== null) {
      window.clearTimeout(collapseAfterDeadlineTimerRef.current);
      collapseAfterDeadlineTimerRef.current = null;
    }
  }, []);

  const queueCollapseAfterDeadline = useCallback(() => {
    clearCollapseAfterDeadlineTimer();
    collapseAfterDeadlineTimerRef.current = window.setTimeout(() => {
      setTaskListExpanded(false);
      collapseAfterDeadlineTimerRef.current = null;
    }, TASK_SELECTION_HIDE_DURATION_MS + TASK_IDLE_TIMEOUT_MS);
  }, [clearCollapseAfterDeadlineTimer, setTaskListExpanded]);

  const setTaskOverlayHovering = useCallback(
    (hovered: boolean) => {
      setTaskOverlayHoveredTaskId(hovered ? primaryTaskId : null);
      if (hovered) {
        registerTaskOverlayInteraction();
      }
    },
    [primaryTaskId, registerTaskOverlayInteraction],
  );

  const setTaskOverlayFocusWithin = useCallback(
    (focused: boolean) => {
      if (focused) {
        registerTaskOverlayInteraction();
      }
    },
    [registerTaskOverlayInteraction],
  );

  const setTaskDetailHovering = useCallback(
    (hovered: boolean) => {
      setTaskDetailHoveredTaskId(hovered ? selectedTaskStableId : null);
      if (hovered) {
        registerTaskDetailInteraction();
      }
    },
    [registerTaskDetailInteraction, selectedTaskStableId],
  );

  const setTaskDetailFocusWithin = useCallback(
    (focused: boolean) => {
      setTaskDetailFocusedTaskId(focused ? selectedTaskStableId : null);
      if (focused) {
        registerTaskDetailInteraction();
      }
    },
    [registerTaskDetailInteraction, selectedTaskStableId],
  );

  const toggleTaskListExpanded = useCallback(() => {
    registerTaskOverlayInteraction();
    setTaskListExpanded((expanded) => {
      const nextExpanded = !expanded;
      if (nextExpanded) {
        setTaskOverlayHoveredTaskId(primaryTaskId);
        clearCollapseAfterDeadlineTimer();
      }
      if (!nextExpanded) {
        setTaskCreationPreviewActive(false);
        clearCollapseAfterDeadlineTimer();
      }
      return nextExpanded;
    });
  }, [
    clearCollapseAfterDeadlineTimer,
    primaryTaskId,
    registerTaskOverlayInteraction,
    setTaskCreationPreviewActive,
    setTaskListExpanded,
  ]);

  const toggleTaskDetailOpen = useCallback(() => {
    setPendingTaskSelectionDismissal(false);
    registerTaskDetailInteraction();
    setTaskDetailOpen((open) => !open);
  }, [registerTaskDetailInteraction, setPendingTaskSelectionDismissal]);

  const toggleTaskDetailPinned = useCallback(() => {
    setPendingTaskSelectionDismissal(false);
    registerTaskDetailInteraction();
    setTaskDetailPinned((pinned) => !pinned);
  }, [registerTaskDetailInteraction, setPendingTaskSelectionDismissal]);

  useEffect(() => {
    const clearInteractionState = () => {
      setTaskOverlayHoveredTaskId(null);
      setTaskDetailHoveredTaskId(null);
      setTaskDetailFocusedTaskId(null);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        clearInteractionState();
      }
    };

    window.addEventListener("blur", clearInteractionState);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", clearInteractionState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!taskCreationPreviewActive || taskOverlayHovered) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!taskDetailPinned) {
        setTaskDetailOpen(false);
        setPendingTaskSelectionDismissal(true);
      }
      setTaskCreationPreviewActive(false);

      if (selectedTaskId) {
        queueCollapseAfterDeadline();
        return;
      }

      setTaskListExpanded(false);
    }, TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    queueCollapseAfterDeadline,
    selectedTaskId,
    setPendingTaskSelectionDismissal,
    setTaskCreationPreviewActive,
    setTaskListExpanded,
    taskCreationPreviewActive,
    taskDetailPinned,
    taskOverlayActivityVersion,
    taskOverlayHovered,
  ]);

  useEffect(() => {
    if (
      !taskListExpanded ||
      taskCreationPreviewActive ||
      taskOverlayHovered
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (selectedTaskId) {
        setPendingTaskSelectionDismissal(true);
        queueCollapseAfterDeadline();
        return;
      }

      setTaskListExpanded(false);
    }, TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    queueCollapseAfterDeadline,
    selectedTaskId,
    setPendingTaskSelectionDismissal,
    setTaskListExpanded,
    taskCreationPreviewActive,
    taskListExpanded,
    taskOverlayActivityVersion,
    taskOverlayHovered,
  ]);

  useEffect(() => {
    if (taskListExpanded) {
      return;
    }

    clearCollapseAfterDeadlineTimer();
  }, [clearCollapseAfterDeadlineTimer, taskListExpanded]);

  useEffect(
    () => clearCollapseAfterDeadlineTimer,
    [clearCollapseAfterDeadlineTimer],
  );

  useEffect(() => {
    if (
      !taskDetailOpen ||
      taskDetailPinned ||
      !selectedTaskId ||
      taskDetailHovered ||
      taskDetailFocused
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTaskDetailOpen(false);
      setPendingTaskSelectionDismissal(true);
    }, TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    selectedTaskId,
    setPendingTaskSelectionDismissal,
    taskDetailActivityVersion,
    taskDetailFocused,
    taskDetailHovered,
    taskDetailOpen,
    taskDetailPinned,
  ]);

  useEffect(() => {
    if (!pendingTaskSelectionDismissal) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!taskDetailOpen && !taskDetailPinned) {
        setSelectedTaskId(null);
      }
      setPendingTaskSelectionDismissal(false);
    }, TASK_SELECTION_HIDE_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    pendingTaskSelectionDismissal,
    setPendingTaskSelectionDismissal,
    setSelectedTaskId,
    taskDetailOpen,
    taskDetailPinned,
  ]);

  return {
    taskDetailOpen,
    setTaskDetailOpen,
    taskDetailPinned,
    setTaskDetailPinned,
    registerTaskOverlayInteraction,
    registerTaskDetailInteraction,
    setTaskOverlayHovering,
    setTaskOverlayFocusWithin,
    setTaskDetailHovering,
    setTaskDetailFocusWithin,
    toggleTaskListExpanded,
    toggleTaskDetailOpen,
    toggleTaskDetailPinned,
  };
};
