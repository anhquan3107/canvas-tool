import { Graphics } from "pixi.js";

export const drawItemFrame = (
  frame: Graphics,
  width: number,
  height: number,
  isCapture: boolean,
  isSelected: boolean,
) => {
  frame.clear();
  frame.rect(0, 0, width, height);
  frame.fill(isCapture ? 0x3d6072 : 0x8a5e32);
  if (isSelected) {
    frame.stroke({
      color: 0xf3a84c,
      width: 4,
      alpha: 0.95,
    });
  }
};
