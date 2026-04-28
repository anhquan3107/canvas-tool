import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import type { CaptureItem, CanvasItem } from "@shared/types/project";
import {
  getBoardRenderAssetPath,
  loadTextureForAssetPath,
} from "@renderer/pixi/utils/textures";
import type { CaptureSession } from "@renderer/pixi/types";
import { drawSwatchTray } from "@renderer/pixi/hooks/use-board-swatch-render";
import { getDocumentMessages } from "@renderer/i18n";

const BOARD_ITEM_VISUAL_NAME = "board-item-visual";
const BOARD_ITEM_CROP_MASK_NAME = "board-item-crop-mask";
const BOARD_ITEM_FALLBACK_NAME = "board-item-fallback";

const clearBoardItemVisuals = (itemNode: Container) => {
  itemNode.children
    .filter((child) =>
      [
        BOARD_ITEM_VISUAL_NAME,
        BOARD_ITEM_CROP_MASK_NAME,
        BOARD_ITEM_FALLBACK_NAME,
      ].includes(child.name ?? ""),
    )
    .forEach((child) => {
      itemNode.removeChild(child);
      child.destroy({ children: true });
    });
};

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
  fallbackHint.name = BOARD_ITEM_FALLBACK_NAME;
  fallbackHint.position.set(10, safeHeight - 24);
  fallbackHint.alpha = 0.9;
  itemNode.addChild(fallbackHint);
};

interface RenderBoardImageVisualsOptions {
  item: Extract<CanvasItem, { type: "image" }>;
  itemNode: Container;
  safeWidth: number;
  safeHeight: number;
  canvasZoom: number;
  dotGain20BlackAndWhite: boolean;
  renderToken: number;
  renderTokenRef: { current: number };
}

const renderBoardImageVisuals = ({
  item,
  itemNode,
  safeWidth,
  safeHeight,
  canvasZoom,
  dotGain20BlackAndWhite,
  renderToken,
  renderTokenRef,
}: RenderBoardImageVisualsOptions) => {
  const renderAssetPath = getBoardRenderAssetPath(item, {
    preferHighResolution: canvasZoom >= 2,
  });

  if (!renderAssetPath) {
    return;
  }

  void loadTextureForAssetPath(renderAssetPath, {
    preferHighResolution: canvasZoom >= 2,
    dotGain20: dotGain20BlackAndWhite,
  })
    .then((texture) => {
      if (renderTokenRef.current !== renderToken) {
        return;
      }

      const sprite = new Sprite(texture);
      sprite.name = BOARD_ITEM_VISUAL_NAME;
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

      clearBoardItemVisuals(itemNode);

      if (
        cropX > 0 ||
        cropY > 0 ||
        cropWidth < sourceWidth ||
        cropHeight < sourceHeight
      ) {
        const cropMask = new Graphics();
        cropMask.name = BOARD_ITEM_CROP_MASK_NAME;
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

      clearBoardItemVisuals(itemNode);
      createFallbackHint(
        itemNode,
        item.previewStatus === "blocked"
          ? "Preview blocked by remote source"
          : "Preview unavailable",
        safeHeight,
      );
    });
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
    renderBoardImageVisuals({
      item,
      itemNode,
      safeWidth,
      safeHeight,
      canvasZoom,
      dotGain20BlackAndWhite,
      renderToken,
      renderTokenRef,
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

        const copy = getDocumentMessages();
        createFallbackHint(
          itemNode,
          error instanceof Error && error.message.toLowerCase().includes("permission")
            ? copy.capture.permissionRequired
            : copy.capture.previewUnavailable,
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

export const refreshBoardImageVisuals = ({
  item,
  itemNode,
  safeWidth,
  safeHeight,
  canvasZoom,
  dotGain20BlackAndWhite,
  renderToken,
  renderTokenRef,
}: RenderBoardImageVisualsOptions) => {
  renderBoardImageVisuals({
    item,
    itemNode,
    safeWidth,
    safeHeight,
    canvasZoom,
    dotGain20BlackAndWhite,
    renderToken,
    renderTokenRef,
  });
};
