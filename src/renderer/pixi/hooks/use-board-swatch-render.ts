import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { hexToPixiColor } from "@renderer/pixi/utils/color";

export const drawSwatchTray = (
  itemNode: Container,
  paletteColors: string[],
  safeWidth: number,
  safeHeight: number,
) => {
  if (safeWidth < 34 || safeHeight < 28) {
    return;
  }

  const desiredChipWidth = Math.min(
    24,
    Math.max(12, Math.min(safeWidth, safeHeight) * 0.02),
  );
  const chipGap = Math.max(0.5, desiredChipWidth * 0.08);
  const stripPadding = Math.max(0.5, desiredChipWidth * 0.1);
  const minChipWidth = 6;
  const borderColor = 0xffffff;
  const borderAlpha = 0.18;
  const borderWidth = Math.max(0.06, desiredChipWidth * 0.025);
  const edgeInset = Math.max(1, desiredChipWidth * 0.18);
  const maxInnerWidth = Math.max(0, safeWidth - edgeInset * 2);

  let chipWidth = desiredChipWidth;
  let chipHeight = chipWidth;
  const visibleColors = paletteColors.slice(0, 16);
  if (visibleColors.length === 0) {
    return;
  }

  while (chipWidth > minChipWidth) {
    const stripWidth =
      visibleColors.length * chipWidth +
      Math.max(0, visibleColors.length - 1) * chipGap;

    if (stripWidth <= maxInnerWidth) {
      break;
    }

    chipWidth -= 1;
    chipHeight = chipWidth;
  }

  const trayWidth =
    visibleColors.length * chipWidth +
    Math.max(0, visibleColors.length - 1) * chipGap;
  const stripHeight = chipHeight;
  const stripX = edgeInset;
  const stripY = Math.max(edgeInset, safeHeight - stripHeight - edgeInset);

  const tray = new Graphics();
  tray.rect(
    stripX - stripPadding,
    stripY - stripPadding,
    trayWidth + stripPadding * 2,
    stripHeight + stripPadding * 2,
  );
  tray.fill({ color: 0x111111, alpha: 0.72 });
  tray.stroke({
    color: borderColor,
    width: borderWidth,
    alpha: borderAlpha,
  });
  itemNode.addChild(tray);

  const tooltip = new Container();
  tooltip.visible = false;
  tooltip.eventMode = "none";
  tooltip.zIndex = 5;

  const tooltipLabel = new Text({
    text: "",
    style: new TextStyle({
      fill: "#fff7ef",
      fontSize: Math.max(4, chipWidth * 0.5),
      fontWeight: "700",
      fontFamily: "Aptos",
      stroke: {
        color: "#1a1715",
        width: 1,
        join: "round",
      },
    }),
  });
  tooltipLabel.resolution = 3;
  tooltipLabel.roundPixels = true;
  tooltip.addChild(tooltipLabel);
  itemNode.addChild(tooltip);

  visibleColors.forEach((colorHex, index) => {
    const swatchX = stripX + index * (chipWidth + chipGap);
    const swatchY = stripY;
    const swatch = new Graphics();
    swatch.rect(swatchX, swatchY, chipWidth, chipHeight);
    swatch.fill(hexToPixiColor(colorHex));
    swatch.stroke({
      color: borderColor,
      width: borderWidth,
      alpha: borderAlpha,
    });
    swatch.eventMode = "static";
    swatch.cursor = "pointer";
    swatch.on("pointerover", () => {
      tooltipLabel.text = colorHex.toUpperCase();
      tooltipLabel.position.set(0, 0);
      tooltip.position.set(
        Math.max(0, swatchX - 4),
        Math.max(0, swatchY - tooltipLabel.height - 8),
      );
      tooltip.visible = true;
    });
    swatch.on("pointerout", () => {
      tooltip.visible = false;
    });
    itemNode.addChild(swatch);
  });
};
