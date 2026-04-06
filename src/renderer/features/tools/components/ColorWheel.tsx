import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { DoodleMode } from "@renderer/features/tools/types";

interface ColorWheelProps {
  doodleMode: DoodleMode;
  doodleColor: string;
  brushSize: number;
  eraserSize: number;
  onDoodleModeChange: (mode: DoodleMode) => void;
  onDoodleColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onEraserSizeChange: (size: number) => void;
}

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

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

export const ColorWheel = ({
  doodleMode,
  doodleColor,
  brushSize,
  eraserSize,
  onDoodleModeChange,
  onDoodleColorChange,
  onBrushSizeChange,
  onEraserSizeChange,
}: ColorWheelProps) => {
  const wheelRef = useRef<HTMLButtonElement | null>(null);
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringRef = useRef<HTMLSpanElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const activePointerTypeRef = useRef<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [thumbPosition, setThumbPosition] = useState<{ x: number; y: number } | null>(
    null,
  );

  const fallbackThumbPosition = useMemo(() => {
    const hex = doodleColor.replace("#", "");
    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((value) => value + value)
            .join("")
        : hex.padEnd(6, "0").slice(0, 6);

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

    hue = (hue * 60 + 360) % 360;
    const saturation = max === 0 ? 0 : delta / max;
    const radius = 56 * clamp(saturation, 0, 1);
    const radians = (hue * Math.PI) / 180;

    return {
      x: Math.cos(radians) * radius,
      y: Math.sin(radians) * radius,
    };
  }, [doodleColor]);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) {
      return;
    }

    const nextPosition = thumbPosition ?? fallbackThumbPosition;
    ring.style.transform = `translate(${nextPosition.x}px, ${nextPosition.y}px)`;
  }, [fallbackThumbPosition, thumbPosition]);

  useEffect(() => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) {
      return;
    }

    const size = 160;
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

    const imageData = context.createImageData(pixelSize, pixelSize);
    const data = imageData.data;
    const center = pixelSize * 0.5;
    const radius = pixelSize * 0.5;

    for (let y = 0; y < pixelSize; y += 1) {
      for (let x = 0; x < pixelSize; x += 1) {
        const deltaX = x + 0.5 - center;
        const deltaY = y + 0.5 - center;
        const distance = Math.hypot(deltaX, deltaY);
        const offset = (y * pixelSize + x) * 4;

        if (distance > radius) {
          data[offset + 3] = 0;
          continue;
        }

        const saturation = clamp(distance / radius, 0, 1);
        const hue = ((Math.atan2(deltaY, deltaX) * 180) / Math.PI + 360) % 360;
        const nextColor = hsvToHex(hue, saturation, 1);
        const rgb = hexToRgb(nextColor);
        const edgeAlpha = distance > radius - 1 ? radius - distance : 1;

        data[offset] = rgb.r;
        data[offset + 1] = rgb.g;
        data[offset + 2] = rgb.b;
        data[offset + 3] = Math.round(clamp(edgeAlpha, 0, 1) * 255);
      }
    }

    context.putImageData(imageData, 0, 0);
  }, []);

  const updateColorFromPointer = (clientX: number, clientY: number) => {
    const wheel = wheelRef.current;
    if (!wheel) {
      return;
    }

    const rect = wheel.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const radius = rect.width * 0.5;
    const clampedDistance = clamp(distance, 0, radius - 11);
    const hue = ((Math.atan2(deltaY, deltaX) * 180) / Math.PI + 360) % 360;
    const saturation = clamp(clampedDistance / radius, 0, 1);
    const nextColor = hsvToHex(hue, saturation, 1);

    setThumbPosition({
      x: distance === 0 ? 0 : (deltaX / distance) * clampedDistance,
      y: distance === 0 ? 0 : (deltaY / distance) * clampedDistance,
    });
    onDoodleColorChange(nextColor);
  };

  const handleWheelPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (doodleMode !== "brush") {
      return;
    }

    event.preventDefault();
    activePointerIdRef.current = event.pointerId;
    activePointerTypeRef.current = event.pointerType;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some stylus targets refuse capture; window listeners still back us up.
    }
    updateColorFromPointer(event.clientX, event.clientY);
  };

  const handleWheelPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      doodleMode !== "brush" ||
      activePointerIdRef.current === null ||
      !(
        event.pointerId === activePointerIdRef.current ||
        (activePointerTypeRef.current === "pen" && event.pointerType === "pen")
      )
    ) {
      return;
    }

    updateColorFromPointer(event.clientX, event.clientY);
  };

  const handleWheelPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      activePointerIdRef.current === null ||
      !(
        event.pointerId === activePointerIdRef.current ||
        (activePointerTypeRef.current === "pen" && event.pointerType === "pen")
      )
    ) {
      return;
    }

    activePointerIdRef.current = null;
    activePointerTypeRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore failed pointer-capture cleanup.
    }
  };

  useEffect(() => {
    if (doodleMode !== "brush") {
      activePointerIdRef.current = null;
      activePointerTypeRef.current = null;
    }
  }, [doodleMode]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (
        doodleMode !== "brush" ||
        activePointerIdRef.current === null ||
        !(
          event.pointerId === activePointerIdRef.current ||
          (activePointerTypeRef.current === "pen" && event.pointerType === "pen")
        )
      ) {
        return;
      }

      updateColorFromPointer(event.clientX, event.clientY);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (
        activePointerIdRef.current === null ||
        !(
          event.pointerId === activePointerIdRef.current ||
          (activePointerTypeRef.current === "pen" && event.pointerType === "pen")
        )
      ) {
        return;
      }

      activePointerIdRef.current = null;
      activePointerTypeRef.current = null;
    };

    const handleBlur = () => {
      activePointerIdRef.current = null;
      activePointerTypeRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("blur", handleBlur);
    };
  }, [doodleMode]);

  const erasing = doodleMode === "erase-line" || doodleMode === "erase-pixel";
  const activeSize = erasing ? eraserSize : brushSize;
  const handleSizeChange = (size: number) => {
    if (erasing) {
      onEraserSizeChange(size);
      return;
    }

    onBrushSizeChange(size);
  };

  return (
    <div className="doodle-panel">
      <div className="tool-wheel-card">
        <button
          ref={wheelRef}
          type="button"
          className={doodleMode === "brush" ? "tool-wheel interactive" : "tool-wheel"}
          aria-label="Choose brush color"
          onPointerDown={handleWheelPointerDown}
          onPointerMove={handleWheelPointerMove}
          onPointerUp={handleWheelPointerUp}
          onPointerCancel={handleWheelPointerUp}
        >
          <canvas ref={wheelCanvasRef} className="tool-wheel-canvas" />
          <span
            className="tool-wheel-ring"
            ref={ringRef}
            style={{ backgroundColor: doodleMode === "brush" ? doodleColor : "#ec7a98" }}
          />
        </button>
        <span
          className="tool-wheel-chip"
          style={{ backgroundColor: doodleMode === "brush" ? doodleColor : "#ec7a98" }}
        />
      </div>

      <div className="doodle-tool-group">
        <button
          type="button"
          className={toolsOpen ? "doodle-tools-toggle active" : "doodle-tools-toggle"}
          aria-label={toolsOpen ? "Hide doodle tools" : "Show doodle tools"}
          aria-expanded={toolsOpen}
          onClick={() => setToolsOpen((previous) => !previous)}
        >
          <span className="doodle-tools-toggle-label">Tools</span>
          <span className="doodle-tools-toggle-arrow">{toolsOpen ? "▾" : "▸"}</span>
        </button>

        {toolsOpen ? (
          <div className="doodle-controls">
            <div className="doodle-mode-row">
              <button
                type="button"
                className={doodleMode === "brush" ? "doodle-mode-button active" : "doodle-mode-button"}
                aria-label="Brush"
                title="Brush"
                onClick={() => onDoodleModeChange("brush")}
              >
                Brush
              </button>
              <button
                type="button"
                className={
                  erasing ? "doodle-mode-button active" : "doodle-mode-button"
                }
                aria-label="Erase"
                title="Erase"
                onClick={() =>
                  onDoodleModeChange(
                    doodleMode === "erase-pixel" ? "erase-pixel" : "erase-line",
                  )
                }
              >
                Erase
              </button>
            </div>

            {erasing ? (
              <div className="doodle-submode-row">
                <button
                  type="button"
                  className={
                    doodleMode === "erase-line"
                      ? "doodle-submode-button active"
                      : "doodle-submode-button"
                  }
                  onClick={() => onDoodleModeChange("erase-line")}
                >
                  Erase Line
                </button>
                <button
                  type="button"
                  className={
                    doodleMode === "erase-pixel"
                      ? "doodle-submode-button active"
                      : "doodle-submode-button"
                  }
                  onClick={() => onDoodleModeChange("erase-pixel")}
                >
                  Erase Pixel
                </button>
              </div>
            ) : null}

            <label className="doodle-size-control" htmlFor="doodle-size">
              <span>{erasing ? "Eraser" : "Brush"}</span>
              <input
                id="doodle-size"
                type="range"
                min={6}
                max={48}
                value={activeSize}
                onChange={(event) => handleSizeChange(Number(event.target.value))}
              />
              <strong>{activeSize}px</strong>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
};
