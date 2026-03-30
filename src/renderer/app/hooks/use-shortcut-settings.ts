import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SHORTCUT_BINDINGS,
  resolveShortcutBindings,
  SHORTCUT_DEFINITIONS,
  type ShortcutActionId,
  type ShortcutBindings,
} from "@shared/shortcuts";

const findBindingConflicts = (bindings: ShortcutBindings) => {
  const actionIdsByBinding = new Map<string, ShortcutActionId[]>();

  SHORTCUT_DEFINITIONS.forEach((definition) => {
    const binding = bindings[definition.id]?.trim();
    if (!binding) {
      return;
    }

    const existing = actionIdsByBinding.get(binding) ?? [];
    existing.push(definition.id);
    actionIdsByBinding.set(binding, existing);
  });

  return Object.fromEntries(
    Array.from(actionIdsByBinding.entries())
      .filter(([, actionIds]) => actionIds.length > 1)
      .flatMap(([, actionIds]) =>
        actionIds.map((actionId) => [actionId, actionIds]),
      ),
  ) as Partial<Record<ShortcutActionId, ShortcutActionId[]>>;
};

interface UseShortcutSettingsOptions {
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
}

export const useShortcutSettings = ({
  pushToast,
}: UseShortcutSettingsOptions) => {
  const [shortcutBindings, setShortcutBindings] = useState<ShortcutBindings>(
    DEFAULT_SHORTCUT_BINDINGS,
  );
  const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);
  const [shortcutDraftBindings, setShortcutDraftBindings] =
    useState<ShortcutBindings>(DEFAULT_SHORTCUT_BINDINGS);
  const [seenTitleBarTooltips, setSeenTitleBarTooltips] = useState<string[]>([]);

  useEffect(() => {
    void window.desktopApi.app
      .getSettings()
      .then((settings) => {
        const nextBindings = resolveShortcutBindings(settings.shortcuts);
        setShortcutBindings(nextBindings);
        setShortcutDraftBindings(nextBindings);
        setSeenTitleBarTooltips(settings.seenTitleBarTooltips ?? []);
      })
      .catch(() => {
        setShortcutBindings(DEFAULT_SHORTCUT_BINDINGS);
        setShortcutDraftBindings(DEFAULT_SHORTCUT_BINDINGS);
        setSeenTitleBarTooltips([]);
      });
  }, []);

  const shortcutConflicts = useMemo(
    () => findBindingConflicts(shortcutDraftBindings),
    [shortcutDraftBindings],
  );

  const openShortcutDialog = useCallback(() => {
    setShortcutDraftBindings(shortcutBindings);
    setShortcutDialogOpen(true);
  }, [shortcutBindings]);

  const closeShortcutDialog = useCallback(() => {
    setShortcutDialogOpen(false);
    setShortcutDraftBindings(shortcutBindings);
  }, [shortcutBindings]);

  const updateShortcutDraftBinding = useCallback(
    (actionId: ShortcutActionId, binding: string) => {
      setShortcutDraftBindings((previous) => ({
        ...previous,
        [actionId]: binding.trim(),
      }));
    },
    [],
  );

  const resetShortcutDraftBinding = useCallback((actionId: ShortcutActionId) => {
    setShortcutDraftBindings((previous) => ({
      ...previous,
      [actionId]: DEFAULT_SHORTCUT_BINDINGS[actionId],
    }));
  }, []);

  const resetAllShortcutDraftBindings = useCallback(() => {
    setShortcutDraftBindings(DEFAULT_SHORTCUT_BINDINGS);
  }, []);

  const markTitleBarTooltipSeen = useCallback((tooltipId: string) => {
    const nextTooltipId = tooltipId.trim();
    if (!nextTooltipId) {
      return;
    }

    let shouldPersist = false;
    setSeenTitleBarTooltips((previous) => {
      if (previous.includes(nextTooltipId)) {
        return previous;
      }

      shouldPersist = true;
      return [...previous, nextTooltipId];
    });

    if (!shouldPersist) {
      return;
    }

    void window.desktopApi.app.markTitleBarTooltipSeen(nextTooltipId).catch(() => {
      setSeenTitleBarTooltips((previous) =>
        previous.filter((item) => item !== nextTooltipId),
      );
    });
  }, []);

  const resetTitleBarTooltips = useCallback(async () => {
    setSeenTitleBarTooltips([]);

    try {
      await window.desktopApi.app.resetTitleBarTooltips();
      pushToast("success", "Title bar tooltips reset.");
      return true;
    } catch {
      pushToast("error", "Couldn't reset title bar tooltips.");
      void window.desktopApi.app
        .getSettings()
        .then((settings) => {
          setSeenTitleBarTooltips(settings.seenTitleBarTooltips ?? []);
        })
        .catch(() => {
          setSeenTitleBarTooltips([]);
        });
      return false;
    }
  }, [pushToast]);

  const saveShortcutBindings = useCallback(async () => {
    const hasConflicts = Object.keys(shortcutConflicts).length > 0;
    if (hasConflicts) {
      pushToast("error", "Resolve duplicate shortcut bindings before saving.");
      return false;
    }

    const nextBindings = resolveShortcutBindings(shortcutDraftBindings);
    const savedBindings =
      await window.desktopApi.app.saveShortcutBindings(nextBindings);

    setShortcutBindings(savedBindings);
    setShortcutDraftBindings(savedBindings);
    setShortcutDialogOpen(false);
    pushToast("success", "Keyboard shortcuts updated.");
    return true;
  }, [pushToast, shortcutConflicts, shortcutDraftBindings]);

  return {
    shortcutBindings,
    shortcutDialogOpen,
    shortcutDraftBindings,
    shortcutConflicts,
    seenTitleBarTooltips,
    setShortcutDialogOpen,
    openShortcutDialog,
    closeShortcutDialog,
    updateShortcutDraftBinding,
    resetShortcutDraftBinding,
    resetAllShortcutDraftBindings,
    markTitleBarTooltipSeen,
    resetTitleBarTooltips,
    saveShortcutBindings,
  };
};
