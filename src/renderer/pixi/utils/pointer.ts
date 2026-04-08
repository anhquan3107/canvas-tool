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

type PointerLikeEvent = {
  clientX: number;
  clientY: number;
  button?: number;
  buttons?: number;
  altKey?: boolean;
  shiftKey?: boolean;
  pointerId?: number;
  pointerType?: string;
  pressure?: number;
  nativeEvent?: Partial<PointerLikeEvent> | null;
};

export const getNormalizedPointerData = (
  nativeEvent: MouseEvent | PointerEvent | PointerLikeEvent,
): NormalizedPointerData => {
  const rawEvent =
    "nativeEvent" in nativeEvent &&
    nativeEvent.nativeEvent &&
    typeof nativeEvent.nativeEvent === "object"
      ? nativeEvent.nativeEvent
      : null;

  const clientX =
    rawEvent && typeof rawEvent.clientX === "number" && Number.isFinite(rawEvent.clientX)
      ? rawEvent.clientX
      : nativeEvent.clientX;
  const clientY =
    rawEvent && typeof rawEvent.clientY === "number" && Number.isFinite(rawEvent.clientY)
      ? rawEvent.clientY
      : nativeEvent.clientY;
  const pointerType =
    "pointerType" in nativeEvent &&
    typeof nativeEvent.pointerType === "string" &&
    nativeEvent.pointerType.length > 0
      ? nativeEvent.pointerType
      : rawEvent &&
          typeof rawEvent.pointerType === "string" &&
          rawEvent.pointerType.length > 0
        ? rawEvent.pointerType
      : "mouse";
  const pointerId =
    "pointerId" in nativeEvent &&
    typeof nativeEvent.pointerId === "number" &&
    Number.isFinite(nativeEvent.pointerId)
      ? nativeEvent.pointerId
      : rawEvent &&
          typeof rawEvent.pointerId === "number" &&
          Number.isFinite(rawEvent.pointerId)
        ? rawEvent.pointerId
      : 1;
  const pressure =
    "pressure" in nativeEvent &&
    typeof nativeEvent.pressure === "number" &&
    Number.isFinite(nativeEvent.pressure)
      ? nativeEvent.pressure
      : rawEvent &&
          typeof rawEvent.pressure === "number" &&
          Number.isFinite(rawEvent.pressure)
        ? rawEvent.pressure
      : 1;

  return {
    clientX,
    clientY,
    button:
      typeof nativeEvent.button === "number" && Number.isFinite(nativeEvent.button)
        ? nativeEvent.button
        : rawEvent &&
            typeof rawEvent.button === "number" &&
            Number.isFinite(rawEvent.button)
          ? rawEvent.button
        : 0,
    buttons:
      typeof nativeEvent.buttons === "number" && Number.isFinite(nativeEvent.buttons)
        ? nativeEvent.buttons
        : rawEvent &&
            typeof rawEvent.buttons === "number" &&
            Number.isFinite(rawEvent.buttons)
          ? rawEvent.buttons
        : 1,
    altKey: Boolean(
      typeof nativeEvent.altKey === "boolean" ? nativeEvent.altKey : rawEvent?.altKey,
    ),
    shiftKey: Boolean(
      typeof nativeEvent.shiftKey === "boolean"
        ? nativeEvent.shiftKey
        : rawEvent?.shiftKey,
    ),
    pointerId,
    pointerType,
    pressure,
  };
};
