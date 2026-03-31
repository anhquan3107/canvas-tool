import { useCallback, useState } from "react";

export interface FeatureGuideState {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
}

interface UseAppFeatureGuideOptions {
  seenTitleBarTooltips: string[];
  markTitleBarTooltipSeen: (id: string) => void;
}

export const useAppFeatureGuide = ({
  seenTitleBarTooltips,
  markTitleBarTooltipSeen,
}: UseAppFeatureGuideOptions) => {
  const [featureGuide, setFeatureGuide] = useState<FeatureGuideState | null>(null);

  const maybeShowTodoGuide = useCallback(() => {
    const guideId = "guide.todo-management";
    if (seenTitleBarTooltips.includes(guideId)) {
      return;
    }

    markTitleBarTooltipSeen(guideId);
    setFeatureGuide({
      id: guideId,
      label: "Todo List Management",
      description:
        "You can double-click on content to change it. Finish editing with Enter or click anywhere else.\n\nHold mouse on a todo task and drag to move task position. Tick the checkbox to confirm work completion. When all tasks in the todo panel are ticked, the Task deadline will automatically confirm complete.\n\nThe todo panel will be saved if you save the canvas file. If you don't save the canvas file, all edit operations, delete tasks, and move task positions will be lost. Please be careful.",
    });
  }, [markTitleBarTooltipSeen, seenTitleBarTooltips]);

  return {
    featureGuide,
    maybeShowTodoGuide,
    setFeatureGuide,
  };
};
