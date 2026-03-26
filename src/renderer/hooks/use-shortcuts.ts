import { useEffect } from "react";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

const keyToString = (event: KeyboardEvent) => {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push("Ctrl");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  if (event.altKey) {
    parts.push("Alt");
  }

  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  parts.push(key);

  return parts.join("+");
};

export const useShortcuts = (
  handlers: Partial<Record<string, () => void>>,
  options?: { allowWhenTyping?: string[] },
) => {
  useEffect(() => {
    const typingWhitelist = new Set(options?.allowWhenTyping ?? []);

    const onKeyDown = (event: KeyboardEvent) => {
      const combo = keyToString(event);

      if (isTypingTarget(event.target) && !typingWhitelist.has(combo)) {
        return;
      }

      const handler = handlers[combo];
      if (!handler) {
        return;
      }

      event.preventDefault();
      handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers, options?.allowWhenTyping]);
};
