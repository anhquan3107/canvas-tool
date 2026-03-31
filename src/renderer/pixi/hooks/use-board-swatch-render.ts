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

  const chipGap = 0.5;
  const stripPadding = 0.5;
  const desiredChipWidth = 12;
  const minChipWidth = 6;
  const borderColor = 0xffffff;
  const borderAlpha = 0.18;
  const borderWidth = 0.06;
  const maxInnerWidth = Math.max(0, safeWidth - 20);
  const maxInnerHeight = Math.max(0, safeHeight - 20);

  let chipWidth = desiredChipWidth;
  let chipHeight = chipWidth;
  let visibleColors = [...paletteColors];
  let columns = Math.max(
    1,
    Math.floor((maxInnerWidth + chipGap) / (chipWidth + chipGap)),
  );
  let rows = Math.max(1, Math.ceil(visibleColors.length / columns));

  while (chipWidth > minChipWidth) {
    columns = Math.max(
      1,
      Math.floor((maxInnerWidth + chipGap) / (chipWidth + chipGap)),
    );
    rows = Math.max(1, Math.ceil(visibleColors.length / columns));
    const stripHeight = rows * chipHeight + Math.max(0, rows - 1) * chipGap;

    if (stripHeight <= maxInnerHeight) {
      break;
    }

    chipWidth -= 1;
    chipHeight = chipWidth;
  }

  columns = Math.max(
    1,
    Math.floor((maxInnerWidth + chipGap) / (chipWidth + chipGap)),
  );
  const maxRows = Math.max(
    1,
    Math.floor((maxInnerHeight + chipGap) / (chipHeight + chipGap)),
  );
  const maxVisibleCount = Math.max(1, columns * maxRows);
  visibleColors = visibleColors.slice(0, maxVisibleCount);
  rows = Math.max(1, Math.ceil(visibleColors.length / columns));
  const colorsInLastRow =
    visibleColors.length - Math.max(0, rows - 1) * columns;
  const stripWidth =
    Math.min(columns, visibleColors.length) * chipWidth +
    Math.max(0, Math.min(columns, visibleColors.length) - 1) * chipGap;
  const lastRowWidth =
    colorsInLastRow * chipWidth + Math.max(0, colorsInLastRow - 1) * chipGap;
  const trayWidth = Math.max(stripWidth, lastRowWidth);
  const stripHeight = rows * chipHeight + Math.max(0, rows - 1) * chipGap;
  const edgeInset = 1;
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
    const column = index % columns;
    const row = Math.floor(index / columns);
    const swatchX = stripX + column * (chipWidth + chipGap);
    const swatchY = stripY + row * (chipHeight + chipGap);
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
