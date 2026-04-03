import { useEffect, useState } from "react";

export const useWindowFocusState = () => {
  const [windowFocused, setWindowFocused] = useState(() => document.hasFocus());

  useEffect(() => {
    const handleFocus = () => setWindowFocused(true);
    const handleBlur = () => setWindowFocused(false);
    const handleVisibilityChange = () => {
      setWindowFocused(document.visibilityState === "visible" && document.hasFocus());
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return windowFocused;
};
