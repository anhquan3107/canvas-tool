import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import type { CaptureItem, CanvasItem } from "@shared/types/project";
import { loadTextureForAssetPath } from "@renderer/pixi/utils/textures";
import type { CaptureSession } from "@renderer/pixi/types";
import { drawSwatchTray } from "@renderer/pixi/hooks/use-board-swatch-render";

const createFallbackHint = (
  itemNode: Container,
  message: string,
  safeHeight: number,
) => {
  const fallbackHint = new Text({
    text: message,
    style: new TextStyle({
      fill: "#d7d0c8",
      fontSize: 13,
      fontFamily: "Aptos",
    }),
  });
  fallbackHint.position.set(10, safeHeight - 24);
  fallbackHint.alpha = 0.9;
  itemNode.addChild(fallbackHint);
};

interface RenderBoardItemVisualsOptions {
  item: CanvasItem;
  itemNode: Container;
  safeWidth: number;
  safeHeight: number;
  showSwatches: boolean;
  canvasZoom: number;
  dotGain20BlackAndWhite: boolean;
  renderToken: number;
  renderTokenRef: { current: number };
  ensureCaptureSession: (item: CaptureItem) => Promise<CaptureSession>;
}

export const renderBoardItemVisuals = ({
  item,
  itemNode,
  safeWidth,
  safeHeight,
  showSwatches,
  canvasZoom,
  dotGain20BlackAndWhite,
  renderToken,
  renderTokenRef,
  ensureCaptureSession,
}: RenderBoardItemVisualsOptions) => {
  if (item.type === "image" && item.assetPath) {
    void loadTextureForAssetPath(item.assetPath, {
      preferHighResolution: canvasZoom >= 2,
      dotGain20: dotGain20BlackAndWhite,
    })
      .then((texture) => {
        if (renderTokenRef.current !== renderToken) {
          return;
        }

        const sprite = new Sprite(texture);
        const sourceWidth =
          item.originalWidth ?? Math.max(1, Math.round(texture.width || safeWidth));
        const sourceHeight =
          item.originalHeight ?? Math.max(1, Math.round(texture.height || safeHeight));
        const cropX = Math.max(
          0,
          Math.min(sourceWidth - 1, Math.round(item.cropX ?? 0)),
        );
        const cropY = Math.max(
          0,
          Math.min(sourceHeight - 1, Math.round(item.cropY ?? 0)),
        );
        const cropWidth = Math.max(
          1,
          Math.min(sourceWidth - cropX, Math.round(item.cropWidth ?? sourceWidth)),
        );
        const cropHeight = Math.max(
          1,
          Math.min(sourceHeight - cropY, Math.round(item.cropHeight ?? sourceHeight)),
        );

        if (
          cropX > 0 ||
          cropY > 0 ||
          cropWidth < sourceWidth ||
          cropHeight < sourceHeight
        ) {
          const cropMask = new Graphics();
          cropMask.rect(0, 0, safeWidth, safeHeight).fill(0xffffff);
          sprite.x = -(cropX * safeWidth) / cropWidth;
          sprite.y = -(cropY * safeHeight) / cropHeight;
          sprite.width = (sourceWidth * safeWidth) / cropWidth;
          sprite.height = (sourceHeight * safeHeight) / cropHeight;
          sprite.mask = cropMask;
          itemNode.addChild(cropMask);
        } else {
          sprite.width = safeWidth;
          sprite.height = safeHeight;
        }

        sprite.roundPixels = false;
        sprite.alpha = 1;
        itemNode.addChildAt(sprite, 1);
      })
      .catch(() => {
        if (renderTokenRef.current !== renderToken) {
          return;
        }

        createFallbackHint(
          itemNode,
          item.previewStatus === "blocked"
            ? "Preview blocked by remote source"
            : "Preview unavailable",
          safeHeight,
        );
      });
  }

  if (item.type === "capture") {
    void ensureCaptureSession(item)
      .then((session) => {
        if (renderTokenRef.current !== renderToken) {
          return;
        }

        const sprite = new Sprite(session.texture);
        sprite.width = safeWidth;
        sprite.height = safeHeight;
        sprite.roundPixels = false;
        sprite.alpha = 0.98;
        itemNode.addChildAt(sprite, 1);
      })
      .catch((error) => {
        if (renderTokenRef.current !== renderToken) {
          return;
        }

        createFallbackHint(
          itemNode,
          error instanceof Error && error.message.toLowerCase().includes("permission")
            ? "Screen recording permission required"
            : "Capture preview unavailable",
          safeHeight,
        );
      });
  }

  if (
    showSwatches &&
    item.type === "image" &&
    ((item.swatches?.length ?? 0) > 0 || item.swatchHex)
  ) {
    const paletteColors =
      item.swatches?.length
        ? item.swatches.map((swatch) => swatch.colorHex)
        : item.swatchHex
          ? [item.swatchHex]
          : [];
    drawSwatchTray(itemNode, paletteColors, safeWidth, safeHeight);
  }
};
