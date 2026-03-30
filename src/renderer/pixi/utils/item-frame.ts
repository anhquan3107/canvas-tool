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
  frame.fill({
    color: isCapture ? 0x3d6072 : 0x000000,
    alpha: isCapture ? 0.88 : 0,
  });
  if (isSelected) {
    frame.stroke({
      color: 0x74bfff,
      width: 1,
      alpha: 0.95,
      pixelLine: true,
    });
  }
};
