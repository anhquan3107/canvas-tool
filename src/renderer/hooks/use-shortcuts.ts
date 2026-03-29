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

const normalizeShortcutKey = (key: string) => {
  switch (key) {
    case " ":
    case "Spacebar":
      return "Space";
    case "Esc":
      return "Escape";
    case "Del":
      return "Delete";
    case "Enter":
      return "Return";
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    case "ArrowUp":
      return "Up";
    case "ArrowDown":
      return "Down";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
};

const keyFromCode = (event: KeyboardEvent) => {
  const { code, key, shiftKey } = event;

  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3);
  }

  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5);
  }

  switch (code) {
    case "Space":
      return "Space";
    case "Escape":
      return "Escape";
    case "Delete":
      return "Delete";
    case "Enter":
    case "NumpadEnter":
      return "Return";
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    case "ArrowUp":
      return "Up";
    case "ArrowDown":
      return "Down";
    case "Minus":
    case "NumpadSubtract":
      return "-";
    case "Equal":
    case "NumpadAdd":
      return shiftKey || key === "+" ? "+" : "=";
    case "BracketLeft":
      return "[";
    case "BracketRight":
      return "]";
    case "Semicolon":
      return ";";
    case "Quote":
      return "'";
    case "Comma":
      return ",";
    case "Period":
      return ".";
    case "Slash":
    case "NumpadDivide":
      return "/";
    case "Backslash":
      return "\\";
    case "Backquote":
      return "`";
    default:
      return normalizeShortcutKey(key);
  }
};

export const keyboardEventToShortcut = (event: KeyboardEvent) => {
  const normalizedKey = keyFromCode(event);
  if (
    normalizedKey === "Control" ||
    normalizedKey === "Meta" ||
    normalizedKey === "Alt" ||
    normalizedKey === "Shift"
  ) {
    return null;
  }

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

  parts.push(normalizedKey);

  return parts.join("+");
};

export const useShortcuts = (
  handlers: Partial<Record<string, () => void>>,
  options?: { allowWhenTyping?: string[] },
) => {
  useEffect(() => {
    const typingWhitelist = new Set(options?.allowWhenTyping ?? []);

    const onKeyDown = (event: KeyboardEvent) => {
      const combo = keyboardEventToShortcut(event);
      if (!combo) {
        return;
      }

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
