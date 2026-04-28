import { useCallback, useState } from "react";
import { useI18n } from "@renderer/i18n";

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
  const { copy } = useI18n();
  const [featureGuide, setFeatureGuide] = useState<FeatureGuideState | null>(null);

  const maybeShowTodoGuide = useCallback(() => {
    const guideId = "guide.todo-management";
    if (seenTitleBarTooltips.includes(guideId)) {
      return;
    }

    markTitleBarTooltipSeen(guideId);
    setFeatureGuide({
      id: guideId,
      label: copy.tasks.todoGuide.label,
      description: copy.tasks.todoGuide.description,
    });
  }, [copy.tasks.todoGuide.description, copy.tasks.todoGuide.label, markTitleBarTooltipSeen, seenTitleBarTooltips]);

  return {
    featureGuide,
    maybeShowTodoGuide,
    setFeatureGuide,
  };
};
