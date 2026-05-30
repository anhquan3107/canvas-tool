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

interface ColorPickerState {
  target: ColorTarget;
  draftCanvasColor: string;
  draftBackgroundColor: string;
  hue: number;
  saturation: number;
  value: number;
  hexInput: string;
}

const getStateForActiveColor = (color: string) => {
  const hsv = hexToHsv(color);
  return {
    hue: hsv.hue,
    saturation: hsv.saturation,
    value: hsv.value,
    hexInput: color.toUpperCase(),
  };
};

const createColorPickerState = (
  canvasColor: string,
  backgroundColor: string,
): ColorPickerState => ({
  target: "canvas",
  draftCanvasColor: canvasColor,
  draftBackgroundColor: backgroundColor,
  ...getStateForActiveColor(canvasColor),
});

const getDraftColors = (state: ColorPickerState) => ({
  canvasColor: state.draftCanvasColor,
  backgroundColor: state.draftBackgroundColor,
});

const updateActiveDraftColor = (state: ColorPickerState, nextColor: string) => ({
  ...state,
  ...(state.target === "canvas"
    ? { draftCanvasColor: nextColor }
    : { draftBackgroundColor: nextColor }),
});

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
  const [pickerState, setPickerState] = useState(() =>
    createColorPickerState(canvasColor, backgroundColor),
  );
  const pickerStateRef = useRef(pickerState);

  const updatePickerState = useCallback(
    (nextState: ColorPickerState, preview = true) => {
      pickerStateRef.current = nextState;
      setPickerState(nextState);

      if (preview) {
        onPreviewChange(getDraftColors(nextState));
      }
    },
    [onPreviewChange],
  );

  const setTarget = useCallback(
    (nextTarget: ColorTarget) => {
      const current = pickerStateRef.current;
      const nextColor =
        nextTarget === "canvas"
          ? current.draftCanvasColor
          : current.draftBackgroundColor;

      updatePickerState(
        {
          ...current,
          target: nextTarget,
          ...getStateForActiveColor(nextColor),
        },
        false,
      );
    },
    [updatePickerState],
  );

  const setHexInput = useCallback(
    (nextHexInput: string) => {
      const current = pickerStateRef.current;
      updatePickerState(
        {
          ...current,
          hexInput: nextHexInput,
        },
        false,
      );
    },
    [updatePickerState],
  );

  const activeColor =
    pickerState.target === "canvas"
      ? pickerState.draftCanvasColor
      : pickerState.draftBackgroundColor;

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
    context.fillStyle = hsvToHex(pickerState.hue, 1, 1);
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
  }, [pickerState.hue]);

  const squarePointer = useCallback((clientX: number, clientY: number) => {
    const canvas = squareCanvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const nextSaturation = clamp((clientX - rect.left) / rect.width, 0, 1);
    const nextValue = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    const current = pickerStateRef.current;
    const nextHex = hsvToHex(current.hue, nextSaturation, nextValue);

    updatePickerState(
      updateActiveDraftColor(
        {
          ...current,
          saturation: nextSaturation,
          value: nextValue,
          hexInput: nextHex,
        },
        nextHex,
      ),
    );
  }, [updatePickerState]);

  const huePointer = useCallback((clientY: number) => {
    const track = hueTrackRef.current;
    if (!track) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const ratio = clamp((clientY - rect.top) / rect.height, 0, 1);
    const nextHue = ratio * 360;
    const current = pickerStateRef.current;
    const nextHex = hsvToHex(nextHue, current.saturation, current.value);

    updatePickerState(
      updateActiveDraftColor(
        {
          ...current,
          hue: nextHue,
          hexInput: nextHex,
        },
        nextHex,
      ),
    );
  }, [updatePickerState]);

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
      left: `${pickerState.saturation * 100}%`,
      top: `${(1 - pickerState.value) * 100}%`,
    }),
    [pickerState.saturation, pickerState.value],
  );

  const hueThumbStyle = useMemo(
    () => ({
      top: `${(pickerState.hue / 360) * 100}%`,
    }),
    [pickerState.hue],
  );

  const commitHexInput = () => {
    const current = pickerStateRef.current;
    const normalized = normalizeHex(current.hexInput);
    const nextHsv = hexToHsv(normalized);
    updatePickerState(
      updateActiveDraftColor(
        {
          ...current,
          hue: nextHsv.hue,
          saturation: nextHsv.saturation,
          value: nextHsv.value,
          hexInput: normalized,
        },
        normalized,
      ),
    );
  };

  const handleReset = () => {
    const current = pickerStateRef.current;
    const activeResetColor =
      current.target === "canvas"
        ? DEFAULT_GROUP_CANVAS_COLOR
        : DEFAULT_GROUP_BACKGROUND_COLOR;

    updatePickerState({
      ...current,
      draftCanvasColor: DEFAULT_GROUP_CANVAS_COLOR,
      draftBackgroundColor: DEFAULT_GROUP_BACKGROUND_COLOR,
      ...getStateForActiveColor(activeResetColor),
    });
  };

  const handleConfirm = () => {
    const current = pickerStateRef.current;
    const normalizedHex = normalizeHex(current.hexInput);
    const canvasColorToConfirm =
      current.target === "canvas" ? normalizedHex : current.draftCanvasColor;
    const backgroundColorToConfirm =
      current.target === "background" ? normalizedHex : current.draftBackgroundColor;

    const nextHsv = hexToHsv(normalizedHex);
    updatePickerState(
      updateActiveDraftColor(
        {
          ...current,
          hue: nextHsv.hue,
          saturation: nextHsv.saturation,
          value: nextHsv.value,
          hexInput: normalizedHex,
        },
        normalizedHex,
      ),
      false,
    );

    onConfirm({
      canvasColor: canvasColorToConfirm,
      backgroundColor: backgroundColorToConfirm,
    });
  };

  return {
    squareCanvasRef,
    hueTrackRef,
    target: pickerState.target,
    setTarget,
    activeColor,
    hexInput: pickerState.hexInput,
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
