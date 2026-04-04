import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "@shared/project-defaults";
import { DialogFrame } from "@renderer/ui/DialogFrame";

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

type ColorTarget = "canvas" | "background";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hsvToHex = (hue: number, saturation: number, value: number) => {
  const chroma = value * saturation;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (sector >= 0 && sector < 1) {
    red = chroma;
    green = x;
  } else if (sector < 2) {
    red = x;
    green = chroma;
  } else if (sector < 3) {
    green = chroma;
    blue = x;
  } else if (sector < 4) {
    green = x;
    blue = chroma;
  } else if (sector < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = value - chroma;
  const toHex = (channel: number) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();
};

const hexToHsv = (hex: string) => {
  const normalized = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta > 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
  }

  return {
    hue: (hue * 60 + 360) % 360,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  };
};

const normalizeHex = (value: string) => {
  const sanitized = value.trim().replace(/[^0-9a-fA-F]/g, "");
  if (sanitized.length === 3) {
    return `#${sanitized
      .split("")
      .map((part) => part + part)
      .join("")}`.toUpperCase();
  }

  return `#${sanitized.padEnd(6, "0").slice(0, 6)}`.toUpperCase();
};

export const BackgroundColorDialog = ({
  open,
  canvasColor,
  backgroundColor,
  windowOpacity,
  onClose,
  onPreviewChange,
  onConfirm,
}: BackgroundColorDialogProps) => {
  const squareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hueTrackRef = useRef<HTMLDivElement | null>(null);
  const previousOpenRef = useRef(false);
  const [target, setTarget] = useState<ColorTarget>("canvas");
  const [draftCanvasColor, setDraftCanvasColor] = useState(canvasColor);
  const [draftBackgroundColor, setDraftBackgroundColor] = useState(backgroundColor);
  const [draftWindowOpacity, setDraftWindowOpacity] = useState(windowOpacity);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [value, setValue] = useState(0);
  const [hexInput, setHexInput] = useState(canvasColor.toUpperCase());

  const activeColor =
    target === "canvas" ? draftCanvasColor : draftBackgroundColor;

  useEffect(() => {
    if (!open) {
      setDraftCanvasColor(canvasColor);
      setDraftBackgroundColor(backgroundColor);
      setDraftWindowOpacity(windowOpacity);
      return;
    }

    if (previousOpenRef.current) {
      return;
    }

    setTarget("canvas");
    setDraftCanvasColor(canvasColor);
    setDraftBackgroundColor(backgroundColor);
    setDraftWindowOpacity(windowOpacity);
  }, [backgroundColor, canvasColor, open, windowOpacity]);

  useEffect(() => {
    previousOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextColor = target === "canvas" ? draftCanvasColor : draftBackgroundColor;
    const nextHsv = hexToHsv(nextColor);
    setHue(nextHsv.hue);
    setSaturation(nextHsv.saturation);
    setValue(nextHsv.value);
    setHexInput(nextColor.toUpperCase());
  }, [draftBackgroundColor, draftCanvasColor, open, target]);

  useEffect(() => {
    const canvas = squareCanvasRef.current;
    if (!canvas) {
      return;
    }

    const size = 320;
    const dpr = window.devicePixelRatio || 1;
    const pixelSize = Math.round(size * dpr);
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, pixelSize, pixelSize);
    context.fillStyle = hsvToHex(hue, 1, 1);
    context.fillRect(0, 0, pixelSize, pixelSize);

    const whiteGradient = context.createLinearGradient(0, 0, pixelSize, 0);
    whiteGradient.addColorStop(0, "rgba(255,255,255,1)");
    whiteGradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = whiteGradient;
    context.fillRect(0, 0, pixelSize, pixelSize);

    const blackGradient = context.createLinearGradient(0, 0, 0, pixelSize);
    blackGradient.addColorStop(0, "rgba(0,0,0,0)");
    blackGradient.addColorStop(1, "rgba(0,0,0,1)");
    context.fillStyle = blackGradient;
    context.fillRect(0, 0, pixelSize, pixelSize);
  }, [hue, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    onPreviewChange({
      canvasColor: draftCanvasColor,
      backgroundColor: draftBackgroundColor,
      windowOpacity: draftWindowOpacity,
    });
  }, [
    draftBackgroundColor,
    draftCanvasColor,
    draftWindowOpacity,
    onPreviewChange,
    open,
  ]);

  const squarePointer = (clientX: number, clientY: number) => {
    const canvas = squareCanvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const nextSaturation = clamp((clientX - rect.left) / rect.width, 0, 1);
    const nextValue = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    const nextHex = hsvToHex(hue, nextSaturation, nextValue);

    setSaturation(nextSaturation);
    setValue(nextValue);
    setHexInput(nextHex);
    if (target === "canvas") {
      setDraftCanvasColor(nextHex);
    } else {
      setDraftBackgroundColor(nextHex);
    }
  };

  const huePointer = (clientY: number) => {
    const track = hueTrackRef.current;
    if (!track) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const ratio = clamp((clientY - rect.top) / rect.height, 0, 1);
    const nextHue = ratio * 360;
    const nextHex = hsvToHex(nextHue, saturation, value);

    setHue(nextHue);
    setHexInput(nextHex);
    if (target === "canvas") {
      setDraftCanvasColor(nextHex);
    } else {
      setDraftBackgroundColor(nextHex);
    }
  };

  const handleSquarePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    squarePointer(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSquarePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    squarePointer(event.clientX, event.clientY);
  };

  const handleSquarePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleHuePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    huePointer(event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleHuePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    huePointer(event.clientY);
  };

  const handleHuePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const squareThumbStyle = useMemo(
    () => ({
      left: `${saturation * 100}%`,
      top: `${(1 - value) * 100}%`,
    }),
    [saturation, value],
  );

  const hueThumbStyle = useMemo(
    () => ({
      top: `${(hue / 360) * 100}%`,
    }),
    [hue],
  );

  if (!open) {
    return null;
  }

  return (
    <DialogFrame title="Change Background Color" onClose={onClose}>
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
        <div className="color-picker-square-shell">
          <canvas
            ref={squareCanvasRef}
            className="color-picker-square"
            onPointerDown={handleSquarePointerDown}
            onPointerMove={handleSquarePointerMove}
            onPointerUp={handleSquarePointerUp}
          />
          <span className="color-picker-square-thumb" style={squareThumbStyle} />
        </div>

        <div className="color-picker-hue-shell">
          <div
            ref={hueTrackRef}
            className="color-picker-hue"
            onPointerDown={handleHuePointerDown}
            onPointerMove={handleHuePointerMove}
            onPointerUp={handleHuePointerUp}
          />
          <span className="color-picker-hue-thumb" style={hueThumbStyle} />
        </div>
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
            onBlur={() => {
              const normalized = normalizeHex(hexInput);
              const nextHsv = hexToHsv(normalized);
              setHue(nextHsv.hue);
              setSaturation(nextHsv.saturation);
              setValue(nextHsv.value);
              setHexInput(normalized);
              if (target === "canvas") {
                setDraftCanvasColor(normalized);
              } else {
                setDraftBackgroundColor(normalized);
              }
            }}
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
          onClick={() => {
            setDraftCanvasColor(DEFAULT_GROUP_CANVAS_COLOR);
            setDraftBackgroundColor(DEFAULT_GROUP_BACKGROUND_COLOR);
            setDraftWindowOpacity(1);
          }}
        >
          Reset
        </button>
        <button
          type="button"
          className="dialog-button primary"
          onClick={() =>
            onConfirm({
              canvasColor: draftCanvasColor,
              backgroundColor: draftBackgroundColor,
              windowOpacity: draftWindowOpacity,
            })
          }
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
