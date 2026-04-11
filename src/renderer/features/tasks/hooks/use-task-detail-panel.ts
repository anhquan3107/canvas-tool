import {
  useCallback,
  useEffect,
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
  const [taskOverlayHovered, setTaskOverlayHovered] = useState(false);
  const [taskOverlayFocused, setTaskOverlayFocused] = useState(false);
  const [taskDetailHovered, setTaskDetailHovered] = useState(false);
  const [taskDetailFocused, setTaskDetailFocused] = useState(false);
  const [collapseAfterDeadlineQueued, setCollapseAfterDeadlineQueued] =
    useState(false);

  const registerTaskOverlayInteraction = useCallback(() => {
    setTaskOverlayActivityVersion((version) => version + 1);
  }, []);

  const registerTaskDetailInteraction = useCallback(() => {
    setTaskDetailActivityVersion((version) => version + 1);
  }, []);

  const setTaskOverlayHovering = useCallback(
    (hovered: boolean) => {
      setTaskOverlayHovered(hovered);
      if (hovered) {
        registerTaskOverlayInteraction();
      }
    },
    [registerTaskOverlayInteraction],
  );

  const setTaskOverlayFocusWithin = useCallback(
    (focused: boolean) => {
      setTaskOverlayFocused(focused);
      if (focused) {
        registerTaskOverlayInteraction();
      }
    },
    [registerTaskOverlayInteraction],
  );

  const setTaskDetailHovering = useCallback(
    (hovered: boolean) => {
      setTaskDetailHovered(hovered);
      if (hovered) {
        registerTaskDetailInteraction();
      }
    },
    [registerTaskDetailInteraction],
  );

  const setTaskDetailFocusWithin = useCallback(
    (focused: boolean) => {
      setTaskDetailFocused(focused);
      if (focused) {
        registerTaskDetailInteraction();
      }
    },
    [registerTaskDetailInteraction],
  );

  const toggleTaskListExpanded = useCallback(() => {
    registerTaskOverlayInteraction();
    setTaskListExpanded((expanded) => {
      const nextExpanded = !expanded;
      if (nextExpanded) {
        setTaskOverlayHovered(true);
        setCollapseAfterDeadlineQueued(false);
      }
      if (!nextExpanded) {
        setTaskCreationPreviewActive(false);
        setCollapseAfterDeadlineQueued(false);
      }
      return nextExpanded;
    });
  }, [registerTaskOverlayInteraction, setTaskCreationPreviewActive, setTaskListExpanded]);

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
      setTaskOverlayHovered(false);
      setTaskOverlayFocused(false);
      setTaskDetailHovered(false);
      setTaskDetailFocused(false);
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
        setCollapseAfterDeadlineQueued(true);
        return;
      }

      setTaskListExpanded(false);
    }, TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    setCollapseAfterDeadlineQueued,
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
        setCollapseAfterDeadlineQueued(true);
        return;
      }

      setTaskListExpanded(false);
    }, TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    setCollapseAfterDeadlineQueued,
    selectedTaskId,
    setPendingTaskSelectionDismissal,
    setTaskListExpanded,
    taskCreationPreviewActive,
    taskListExpanded,
    taskOverlayActivityVersion,
    taskOverlayHovered,
  ]);

  useEffect(() => {
    if (!collapseAfterDeadlineQueued) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTaskListExpanded(false);
      setCollapseAfterDeadlineQueued(false);
    }, TASK_SELECTION_HIDE_DURATION_MS + TASK_IDLE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [collapseAfterDeadlineQueued, setTaskListExpanded]);

  useEffect(() => {
    if (taskListExpanded) {
      return;
    }

    setCollapseAfterDeadlineQueued(false);
  }, [taskListExpanded]);

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
    if (primaryTask) {
      return;
    }

    setTaskOverlayHovered(false);
    setTaskOverlayFocused(false);
  }, [primaryTask]);

  useEffect(() => {
    if (selectedTask) {
      return;
    }

    setTaskDetailHovered(false);
    setTaskDetailFocused(false);
  }, [selectedTask]);

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
