import { DialogFrame } from "@renderer/ui/DialogFrame";
import { ColorSquare } from "@renderer/app/components/ColorSquare";
import { HueSlider } from "@renderer/app/components/HueSlider";
import { useColorPickerState } from "@renderer/app/components/use-color-picker-state";
import { useI18n } from "@renderer/i18n";
import type { CSSProperties } from "react";

interface BackgroundColorDialogProps {
  open: boolean;
  canvasColor: string;
  backgroundColor: string;
  windowOpacity: number;
  onClose: () => void;
  onPreviewChange: (colors: {
    canvasColor: string;
    backgroundColor: string;
  }) => void;
  onConfirm: (colors: {
    canvasColor: string;
    backgroundColor: string;
  }) => void;
  onWindowOpacityChange: (opacity: number) => void;
}

export const BackgroundColorDialog = ({
  open,
  canvasColor,
  backgroundColor,
  windowOpacity,
  onClose,
  onPreviewChange,
  onConfirm,
  onWindowOpacityChange,
}: BackgroundColorDialogProps) => {
  const { copy } = useI18n();
  const {
    squareCanvasRef,
    hueTrackRef,
    target,
    setTarget,
    activeColor,
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
    onPreviewChange,
    onConfirm,
  });

  if (!open) {
    return null;
  }

  return (
    <DialogFrame
      title={copy.backgroundDialog.title}
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      <div className="color-picker-toggle-row">
        <button
          type="button"
          className={target === "canvas" ? "color-picker-target active" : "color-picker-target"}
          onClick={() => setTarget("canvas")}
        >
          {copy.backgroundDialog.canvas}
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
          {copy.backgroundDialog.background}
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
          <label htmlFor="color-picker-hex">{copy.backgroundDialog.hexColor}</label>
          <input
            id="color-picker-hex"
            value={hexInput}
            onChange={(event) => {
              setHexInput(event.target.value.toUpperCase());
            }}
            onBlur={commitHexInput}
          />
        </div>

        <div className="dialog-field">
          <label>{copy.backgroundDialog.preview}</label>
          <div
            className="color-picker-preview"
            style={{ backgroundColor: activeColor }}
          />
        </div>

        <div className="dialog-field color-picker-opacity-field">
          <label htmlFor="color-picker-opacity">
            {copy.backgroundDialog.appOpacity(Math.round(windowOpacity * 100))}
          </label>
          <input
            id="color-picker-opacity"
            type="range"
            min={1}
            max={100}
            step={1}
            value={Math.round(windowOpacity * 100)}
            className="color-picker-opacity-slider"
            style={{ "--slider-fill": `${windowOpacity * 100}%` } as CSSProperties}
            onChange={(event) => {
              const nextValue =
                Math.min(100, Math.max(1, Number(event.target.value))) / 100;
              onWindowOpacityChange(nextValue);
            }}
          />
        </div>
      </div>

      <div className="dialog-actions dialog-actions-triple">
        <button
          type="button"
          className="dialog-button"
          onClick={() => {
            handleReset();
            onWindowOpacityChange(1);
          }}
        >
          {copy.common.reset}
        </button>
        <button
          type="button"
          className="dialog-button primary"
          onClick={handleConfirm}
        >
          {copy.common.ok}
        </button>
        <button type="button" className="dialog-button" onClick={onClose}>
          {copy.common.cancel}
        </button>
      </div>
    </DialogFrame>
  );
};
