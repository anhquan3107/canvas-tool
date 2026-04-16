import type { CSSProperties } from "react";
import { DialogFrame } from "@renderer/ui/DialogFrame";
import { ColorSquare } from "@renderer/app/components/ColorSquare";
import { HueSlider } from "@renderer/app/components/HueSlider";
import { clamp } from "@renderer/app/components/color-picker-utils";
import { useColorPickerState } from "@renderer/app/components/use-color-picker-state";

interface BackgroundColorDialogProps {
  open: boolean;
  canvasColor: string;
  backgroundColor: string;
  windowOpacity: number;
  onClose: () => void;
  onPreviewChange: (colors: {
    canvasColor: string;
    backgroundColor: string;
    windowOpacity: number;
  }) => void;
  onConfirm: (colors: {
    canvasColor: string;
    backgroundColor: string;
    windowOpacity: number;
  }) => void;
}

export const BackgroundColorDialog = ({
  open,
  canvasColor,
  backgroundColor,
  windowOpacity,
  onClose,
  onPreviewChange,
  onConfirm,
}: BackgroundColorDialogProps) => {
  const {
    squareCanvasRef,
    hueTrackRef,
    target,
    setTarget,
    activeColor,
    draftWindowOpacity,
    setDraftWindowOpacity,
    hexInput,
    setHexInput,
    squareThumbStyle,
    hueThumbStyle,
    handleSquarePointerDown,
    handleSquarePointerMove,
    handleSquarePointerUp,
    handleHuePointerDown,
    handleHuePointerMove,
    handleHuePointerUp,
    commitHexInput,
    handleReset,
    handleConfirm,
  } = useColorPickerState({
    open,
    canvasColor,
    backgroundColor,
    windowOpacity,
    onPreviewChange,
    onConfirm,
  });

  if (!open) {
    return null;
  }

  return (
    <DialogFrame
      title="Change Background Color"
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      <div className="color-picker-toggle-row">
        <button
          type="button"
          className={target === "canvas" ? "color-picker-target active" : "color-picker-target"}
          onClick={() => setTarget("canvas")}
        >
          Canvas
        </button>
        <button
          type="button"
          className={
            target === "background"
              ? "color-picker-target active"
              : "color-picker-target"
          }
          onClick={() => setTarget("background")}
        >
          Background
        </button>
      </div>

      <div className="color-picker-body">
        <ColorSquare
          squareCanvasRef={squareCanvasRef}
          thumbStyle={squareThumbStyle}
          onPointerDown={handleSquarePointerDown}
          onPointerMove={handleSquarePointerMove}
          onPointerUp={handleSquarePointerUp}
        />

        <HueSlider
          hueTrackRef={hueTrackRef}
          thumbStyle={hueThumbStyle}
          onPointerDown={handleHuePointerDown}
          onPointerMove={handleHuePointerMove}
          onPointerUp={handleHuePointerUp}
        />
      </div>

      <div className="dialog-grid color-picker-meta-grid">
        <div className="dialog-field">
          <label htmlFor="color-picker-hex">Hex Color:</label>
          <input
            id="color-picker-hex"
            value={hexInput}
            onChange={(event) => {
              setHexInput(event.target.value.toUpperCase());
            }}
            onBlur={commitHexInput}
          />
        </div>

        <div className="dialog-field color-picker-opacity-field">
          <label htmlFor="color-picker-opacity">
            App Opacity: {Math.round(draftWindowOpacity * 100)}%
          </label>
          <input
            id="color-picker-opacity"
            className="color-picker-opacity-slider"
            type="range"
            min="5"
            max="100"
            step="1"
            value={Math.round(draftWindowOpacity * 100)}
            style={
              {
                "--slider-fill": `${Math.round(draftWindowOpacity * 100)}%`,
              } as CSSProperties
            }
            onChange={(event) => {
              setDraftWindowOpacity(clamp(Number(event.target.value) / 100, 0.05, 1));
            }}
          />
        </div>

        <div className="dialog-field">
          <label>Preview:</label>
          <div
            className="color-picker-preview"
            style={{ backgroundColor: activeColor }}
          />
        </div>
      </div>

      <div className="dialog-actions dialog-actions-triple">
        <button
          type="button"
          className="dialog-button"
          onClick={handleReset}
        >
          Reset
        </button>
        <button
          type="button"
          className="dialog-button primary"
          onClick={handleConfirm}
        >
          OK
        </button>
        <button type="button" className="dialog-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </DialogFrame>
  );
};
