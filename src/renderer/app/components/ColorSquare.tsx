import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

interface ColorSquareProps {
  squareCanvasRef: RefObject<HTMLCanvasElement | null>;
  thumbStyle: { left: string; top: string };
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
}

export const ColorSquare = ({
  squareCanvasRef,
  thumbStyle,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: ColorSquareProps) => (
  <div className="color-picker-square-shell">
    <canvas
      ref={squareCanvasRef}
      className="color-picker-square"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
    <span className="color-picker-square-thumb" style={thumbStyle} />
  </div>
);
