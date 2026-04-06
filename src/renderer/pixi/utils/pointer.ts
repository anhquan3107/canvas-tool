import { clamp } from "@renderer/pixi/utils/geometry";

const PEN_STROKE_PRESSURE_FLOOR = 0.005;
const PEN_DISPLAY_PRESSURE_FLOOR = 0.02;

export interface NormalizedPointerData {
  clientX: number;
  clientY: number;
  button: number;
  buttons: number;
  altKey: boolean;
  shiftKey: boolean;
  pointerId: number;
  pointerType: string;
  pressure: number;
}

export const isPenPointerType = (pointerType?: string | null) =>
  pointerType === "pen";

export const resolvePointerPressure = (
  pointerType: string | undefined,
  pressure: number | undefined,
  minimumPressure = PEN_STROKE_PRESSURE_FLOOR,
) => {
  if (!isPenPointerType(pointerType)) {
    return 1;
  }

  const rawPressure =
    typeof pressure === "number" && Number.isFinite(pressure) && pressure > 0
      ? pressure
      : minimumPressure;

  return clamp(rawPressure, minimumPressure, 1);
};

export const getDisplayPressureScale = (
  pointerType: string | undefined,
  pressure: number | undefined,
  buttons: number | undefined,
) => {
  if (!isPenPointerType(pointerType) || !buttons) {
    return 1;
  }

  return resolvePointerPressure(pointerType, pressure, PEN_DISPLAY_PRESSURE_FLOOR);
};

export const getNormalizedPointerData = (
  nativeEvent: MouseEvent | PointerEvent,
): NormalizedPointerData => {
  const pointerType =
    "pointerType" in nativeEvent && typeof nativeEvent.pointerType === "string"
      ? nativeEvent.pointerType
      : "mouse";
  const pointerId =
    "pointerId" in nativeEvent && typeof nativeEvent.pointerId === "number"
      ? nativeEvent.pointerId
      : 1;
  const pressure =
    "pressure" in nativeEvent && typeof nativeEvent.pressure === "number"
      ? nativeEvent.pressure
      : 1;

  return {
    clientX: nativeEvent.clientX,
    clientY: nativeEvent.clientY,
    button: nativeEvent.button,
    buttons: nativeEvent.buttons,
    altKey: nativeEvent.altKey,
    shiftKey: nativeEvent.shiftKey,
    pointerId,
    pointerType,
    pressure,
  };
};
