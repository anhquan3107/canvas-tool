import type {
  MouseEvent as ReactMouseEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from "react";
import type { RulerGridSettings } from "@renderer/features/tools/types";

interface ZoomViewportProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  activeImagePath: string;
  activeImageLabel?: string;
  cropWidth: number;
  cropHeight: number;
  rulerEnabled: boolean;
  gridSettings: RulerGridSettings;
  stageStyle: {
    width: string;
    height: string;
    transform: string;
  };
  imageStyle: {
    width: string;
    height: string;
    transform: string;
    filter?: string;
  };
  viewportCursor: string;
  onWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseMove: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

export const ZoomViewport = ({
  viewportRef,
  activeImagePath,
  activeImageLabel,
  cropWidth,
  cropHeight,
  rulerEnabled,
  gridSettings,
  stageStyle,
  imageStyle,
  viewportCursor,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onDoubleClick,
}: ZoomViewportProps) => (
  <div
    ref={viewportRef}
    className="zoom-overlay-viewport"
    style={{ cursor: viewportCursor }}
    onWheel={onWheel}
    onMouseDown={onMouseDown}
    onMouseMove={onMouseMove}
    onMouseUp={onMouseUp}
    onMouseLeave={onMouseLeave}
    onDoubleClick={onDoubleClick}
  >
    <div className="zoom-overlay-stage" style={stageStyle}>
      <img
        className="zoom-overlay-image"
        src={activeImagePath}
        alt={activeImageLabel ?? "Focused canvas image"}
        draggable={false}
        style={imageStyle}
      />

      {rulerEnabled ? (
        <svg
          className="zoom-overlay-grid"
          viewBox={`0 0 ${cropWidth} ${cropHeight}`}
          preserveAspectRatio="none"
          shapeRendering="geometricPrecision"
        >
          {Array.from({ length: Math.max(0, gridSettings.verticalLines - 1) }).map(
            (_, index) => {
              const x = (cropWidth / gridSettings.verticalLines) * (index + 1);
              return (
                <line
                  key={`v-${index}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={cropHeight}
                  stroke={gridSettings.gridColor}
                  strokeWidth={1}
                  strokeOpacity={1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            },
          )}
          {Array.from({
            length: Math.max(0, gridSettings.horizontalLines - 1),
          }).map((_, index) => {
            const y =
              (cropHeight / gridSettings.horizontalLines) * (index + 1);
            return (
              <line
                key={`h-${index}`}
                x1={0}
                y1={y}
                x2={cropWidth}
                y2={y}
                stroke={gridSettings.gridColor}
                strokeWidth={1}
                strokeOpacity={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      ) : null}
    </div>
  </div>
);
