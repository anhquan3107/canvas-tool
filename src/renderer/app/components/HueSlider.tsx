import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

interface HueSliderProps {
  hueTrackRef: RefObject<HTMLDivElement | null>;
  thumbStyle: { top: string };
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export const HueSlider = ({
  hueTrackRef,
  thumbStyle,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: HueSliderProps) => (
  <div className="color-picker-hue-shell">
    <div
      ref={hueTrackRef}
      className="color-picker-hue"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
    <span className="color-picker-hue-thumb" style={thumbStyle} />
  </div>
);
