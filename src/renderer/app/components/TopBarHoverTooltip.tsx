import { useEffect, useRef, useState, type ReactNode } from "react";

interface TopBarHoverTooltipProps {
  label?: string;
  children: ReactNode;
}

const HOVER_TOOLTIP_DELAY_MS = 500;

export const TopBarHoverTooltip = ({
  label,
  children,
}: TopBarHoverTooltipProps) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const clearPendingShow = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const hideTooltip = () => {
    clearPendingShow();
    setVisible(false);
  };

  const scheduleShow = () => {
    clearPendingShow();
    timeoutRef.current = window.setTimeout(() => {
      setVisible(true);
      timeoutRef.current = null;
    }, HOVER_TOOLTIP_DELAY_MS);
  };

  useEffect(() => clearPendingShow, []);

  if (!label) {
    return <>{children}</>;
  }

  return (
    <span
      className={`topbar-hover-tooltip-shell ${visible ? "visible" : ""}`}
      onPointerEnter={scheduleShow}
      onPointerLeave={hideTooltip}
      onPointerDownCapture={hideTooltip}
      onClickCapture={hideTooltip}
      onPointerCancel={hideTooltip}
      onBlur={hideTooltip}
    >
      {children}
      <span className="topbar-hover-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
};
