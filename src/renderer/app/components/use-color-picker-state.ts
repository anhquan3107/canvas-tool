import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  DEFAULT_GROUP_BACKGROUND_COLOR,
  DEFAULT_GROUP_CANVAS_COLOR,
} from "@shared/project-defaults";
import {
  clamp,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  type ColorTarget,
} from "@renderer/app/components/color-picker-utils";

interface UseColorPickerStateOptions {
  canvasColor: string;
  backgroundColor: string;
  onPreviewChange: (colors: {
    canvasColor: string;
    backgroundColor: string;
  }) => void;
  onConfirm: (colors: {
    canvasColor: string;
    backgroundColor: string;
  }) => void;
}

export const useColorPickerState = ({
  canvasColor,
  backgroundColor,
  onPreviewChange,
  onConfirm,
}: UseColorPickerStateOptions) => {
  const squareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hueTrackRef = useRef<HTMLDivElement | null>(null);
  const squareDraggingRef = useRef(false);
  const hueDraggingRef = useRef(false);
  const targetRef = useRef<ColorTarget>("canvas");
  const hueRef = useRef(0);
  const saturationRef = useRef(0);
  const valueRef = useRef(0);
  const [target, setTarget] = useState<ColorTarget>("canvas");
  const [draftCanvasColor, setDraftCanvasColor] = useState(canvasColor);
  const [draftBackgroundColor, setDraftBackgroundColor] = useState(backgroundColor);
  const [hue, setHue] = useState(() => hexToHsv(canvasColor).hue);
  const [saturation, setSaturation] = useState(
    () => hexToHsv(canvasColor).saturation,
  );
  const [value, setValue] = useState(() => hexToHsv(canvasColor).value);
  const [hexInput, setHexInput] = useState(() => canvasColor.toUpperCase());

  const activeColor =
    target === "canvas" ? draftCanvasColor : draftBackgroundColor;

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    hueRef.current = hue;
  }, [hue]);

  useEffect(() => {
    saturationRef.current = saturation;
  }, [saturation]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const nextColor = target === "canvas" ? draftCanvasColor : draftBackgroundColor;
    const nextHsv = hexToHsv(nextColor);
    setHue(nextHsv.hue);
    setSaturation(nextHsv.saturation);
    setValue(nextHsv.value);
    setHexInput(nextColor.toUpperCase());
  }, [draftBackgroundColor, draftCanvasColor, target]);

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
    Object.assign(canvas.style, {
      width: `${size}px`,
      height: `${size}px`,
    });

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
  }, [hue]);

  useEffect(() => {
    onPreviewChange({
      canvasColor: draftCanvasColor,
      backgroundColor: draftBackgroundColor,
    });
  }, [draftBackgroundColor, draftCanvasColor, onPreviewChange]);

  const squarePointer = useCallback((clientX: number, clientY: number) => {
    const canvas = squareCanvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const nextSaturation = clamp((clientX - rect.left) / rect.width, 0, 1);
    const nextValue = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    const nextHex = hsvToHex(hueRef.current, nextSaturation, nextValue);

    setSaturation(nextSaturation);
    setValue(nextValue);
    setHexInput(nextHex);
    if (targetRef.current === "canvas") {
      setDraftCanvasColor(nextHex);
    } else {
      setDraftBackgroundColor(nextHex);
    }
  }, []);

  const huePointer = useCallback((clientY: number) => {
    const track = hueTrackRef.current;
    if (!track) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const ratio = clamp((clientY - rect.top) / rect.height, 0, 1);
    const nextHue = ratio * 360;
    const nextHex = hsvToHex(nextHue, saturationRef.current, valueRef.current);

    setHue(nextHue);
    setHexInput(nextHex);
    if (targetRef.current === "canvas") {
      setDraftCanvasColor(nextHex);
    } else {
      setDraftBackgroundColor(nextHex);
    }
  }, []);

  const handleSquarePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    squareDraggingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some stylus targets refuse capture; window listeners still back us up.
    }
    squarePointer(event.clientX, event.clientY);
  };

  const handleSquarePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!squareDraggingRef.current) {
      return;
    }

    squarePointer(event.clientX, event.clientY);
  };

  const handleSquarePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!squareDraggingRef.current) {
      return;
    }

    squareDraggingRef.current = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore failed pointer-capture cleanup.
    }
  };

  const handleHuePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    hueDraggingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some stylus targets refuse capture; window listeners still back us up.
    }
    huePointer(event.clientY);
  };

  const handleHuePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hueDraggingRef.current) {
      return;
    }

    huePointer(event.clientY);
  };

  const handleHuePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hueDraggingRef.current) {
      return;
    }

    hueDraggingRef.current = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore failed pointer-capture cleanup.
    }
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (squareDraggingRef.current) {
        squarePointer(event.clientX, event.clientY);
      }

      if (hueDraggingRef.current) {
        huePointer(event.clientY);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (squareDraggingRef.current) {
        squarePointer(event.clientX, event.clientY);
      }

      if (hueDraggingRef.current) {
        huePointer(event.clientY);
      }
    };

    const handlePointerEnd = () => {
      squareDraggingRef.current = false;
      hueDraggingRef.current = false;
    };

    const handleMouseUp = () => {
      squareDraggingRef.current = false;
      hueDraggingRef.current = false;
    };

    const handleBlur = () => {
      squareDraggingRef.current = false;
      hueDraggingRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [huePointer, squarePointer]);

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

  const commitHexInput = () => {
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
  };

  const handleReset = () => {
    setDraftCanvasColor(DEFAULT_GROUP_CANVAS_COLOR);
    setDraftBackgroundColor(DEFAULT_GROUP_BACKGROUND_COLOR);
  };

  const handleConfirm = () => {
    const normalizedHex = normalizeHex(hexInput);
    const canvasColorToConfirm =
      target === "canvas" ? normalizedHex : draftCanvasColor;
    const backgroundColorToConfirm =
      target === "background" ? normalizedHex : draftBackgroundColor;

    const nextHsv = hexToHsv(normalizedHex);
    setHue(nextHsv.hue);
    setSaturation(nextHsv.saturation);
    setValue(nextHsv.value);
    setHexInput(normalizedHex);

    if (target === "canvas") {
      setDraftCanvasColor(normalizedHex);
    } else {
      setDraftBackgroundColor(normalizedHex);
    }

    onConfirm({
      canvasColor: canvasColorToConfirm,
      backgroundColor: backgroundColorToConfirm,
    });
  };

  return {
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
  };
};
