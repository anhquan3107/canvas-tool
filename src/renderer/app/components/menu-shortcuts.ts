import type { ShortcutActionId, ShortcutBindings } from "@shared/shortcuts";

const isMacPlatform = () =>
  /mac/i.test(
    (() => {
      if (typeof navigator === "undefined") {
        return "";
      }

      const navigatorWithUAData = navigator as Navigator & {
        userAgentData?: { platform?: string };
      };

      return navigatorWithUAData.userAgentData?.platform ?? navigator.platform ?? "";
    })(),
  );

const shortcutTokenLabel = (token: string) => {
  const isMac = isMacPlatform();

  switch (token) {
    case "Ctrl":
      return isMac ? "Cmd" : "Ctrl";
    case "Alt":
      return isMac ? "Opt" : "Alt";
    case "Shift":
      return "Shift";
    case "Delete":
      return isMac ? "Del" : "Delete";
    case "Escape":
      return "Esc";
    case "Return":
      return "Enter";
    default:
      return token;
  }
};

export const formatMenuShortcut = (
  bindings: ShortcutBindings,
  actionId?: ShortcutActionId,
) => {
  if (!actionId) {
    return undefined;
  }

  const binding = bindings[actionId];
  if (!binding) {
    return undefined;
  }

  return binding
    .split("+")
    .map((token) => shortcutTokenLabel(token))
    .join("+");
};
