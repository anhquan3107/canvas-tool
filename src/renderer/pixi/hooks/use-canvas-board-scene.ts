import { useCallback, type MutableRefObject } from "react";
import {
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
} from "pixi.js";
import type { CaptureItem, ReferenceGroup } from "@shared/types/project";
import { drawItemFrame } from "@renderer/pixi/utils/item-frame";
import { loadTextureForAssetPath } from "@renderer/pixi/utils/textures";
import { hexToPixiColor } from "@renderer/pixi/utils/color";
import type {
  ActiveItemDragState,
  ActiveSelectionBoxState,
  CanvasInsets,
  CaptureSession,
} from "@renderer/pixi/types";

interface FrameMeta {
  width: number;
  height: number;
  isCapture: boolean;
}

const SELECTION_DIM_ALPHA = 0.34;
const SELECTION_HIGHLIGHT_ALPHA = 0.08;
const SELECTION_HIGHLIGHT_NAME = "selection-highlight";

const applySelectionVisualState = (
  itemNode: Container,
  itemId: string,
  selectionIds: string[],
) => {
  const hasSelection = selectionIds.length > 0;
  const isSelected = selectionIds.includes(itemId);
  itemNode.alpha = hasSelection ? (isSelected ? 1 : SELECTION_DIM_ALPHA) : 1;

  const highlightOverlay = itemNode.getChildByName(
    SELECTION_HIGHLIGHT_NAME,
  ) as Graphics | null;
  if (!highlightOverlay) {
    return;
  }

  highlightOverlay.alpha =
    hasSelection && isSelected ? SELECTION_HIGHLIGHT_ALPHA : 0;
  highlightOverlay.visible = !hasSelection || isSelected;
};

interface UseCanvasBoardSceneOptions {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  boardGraphicRef: MutableRefObject<Graphics | null>;
  gridGraphicRef: MutableRefObject<Graphics | null>;
  itemLayerRef: MutableRefObject<Container | null>;
  annotationLayerRef: MutableRefObject<Graphics | null>;
  annotationPreviewLayerRef: MutableRefObject<Graphics | null>;
  frameByIdRef: MutableRefObject<Map<string, Graphics>>;
  itemNodeByIdRef: MutableRefObject<Map<string, Container>>;
  frameMetaByIdRef: MutableRefObject<Map<string, FrameMeta>>;
  selectionIdsRef: MutableRefObject<string[]>;
  groupRef: MutableRefObject<ReferenceGroup>;
  onSelectionChangeRef: MutableRefObject<(itemIds: string[]) => void>;
  onItemDoubleClickRef: MutableRefObject<((itemId: string) => void) | undefined>;
  activeToolRef: MutableRefObject<string | null>;
  renderTokenRef: MutableRefObject<number>;
  activeItemDragRef: MutableRefObject<ActiveItemDragState | null>;
  activeSelectionBoxRef: MutableRefObject<ActiveSelectionBoxState | null>;
  isPanningRef: MutableRefObject<boolean>;
  panStartRef: MutableRefObject<{ x: number; y: number }>;
  panOriginRef: MutableRefObject<{ x: number; y: number }>;
  spacePanActiveRef: MutableRefObject<boolean>;
  lastItemPressRef: MutableRefObject<{ itemId: string; time: number } | null>;
  ensureCaptureSession: (item: CaptureItem) => Promise<CaptureSession>;
  drawBoardSurface: (insets?: CanvasInsets) => void;
  syncViewFromGroup: () => void;
  hideSelectionMarquee: () => void;
  redrawAnnotations: (annotations?: ReferenceGroup["annotations"]) => void;
  startAnnotationSession: (clientX: number, clientY: number) => void;
}

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

const drawSwatchTray = (
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
    const stripHeight =
      rows * chipHeight + Math.max(0, rows - 1) * chipGap;

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
    colorsInLastRow * chipWidth +
    Math.max(0, colorsInLastRow - 1) * chipGap;
  const trayWidth = Math.max(stripWidth, lastRowWidth);
  const stripHeight =
    rows * chipHeight + Math.max(0, rows - 1) * chipGap;
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
    swatch.rect(
      swatchX,
      swatchY,
      chipWidth,
      chipHeight,
    );
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

export const useCanvasBoardScene = ({
  hostRef,
  boardContainerRef,
  boardGraphicRef,
  gridGraphicRef,
  itemLayerRef,
  annotationLayerRef,
  annotationPreviewLayerRef,
  frameByIdRef,
  itemNodeByIdRef,
  frameMetaByIdRef,
  selectionIdsRef,
  groupRef,
  onSelectionChangeRef,
  onItemDoubleClickRef,
  activeToolRef,
  renderTokenRef,
  activeItemDragRef,
  activeSelectionBoxRef,
  isPanningRef,
  panStartRef,
  panOriginRef,
  spacePanActiveRef,
  lastItemPressRef,
  ensureCaptureSession,
  drawBoardSurface,
  syncViewFromGroup,
  hideSelectionMarquee,
  redrawAnnotations,
  startAnnotationSession,
}: UseCanvasBoardSceneOptions) => {
  return useCallback(() => {
    const boardContainer = boardContainerRef.current;
    const board = boardGraphicRef.current;
    const grid = gridGraphicRef.current;
    const itemLayer = itemLayerRef.current;
    const annotationLayer = annotationLayerRef.current;
    const annotationPreviewLayer = annotationPreviewLayerRef.current;
    const host = hostRef.current;

    if (
      !boardContainer ||
      !board ||
      !grid ||
      !itemLayer ||
      !annotationLayer ||
      !annotationPreviewLayer ||
      !host
    ) {
      return;
    }

    const scene = groupRef.current;
    const renderToken = ++renderTokenRef.current;
    const doodleActive = activeToolRef.current === "doodle";

    syncViewFromGroup();

    board.eventMode = "static";
    board.cursor = doodleActive ? "none" : "grab";
    board.removeAllListeners();
    drawBoardSurface();

    grid.clear();
    annotationLayer.clear();
    annotationPreviewLayer.clear();

    itemLayer.removeChildren().forEach((child) => {
      child.destroy({ children: true });
    });
    frameByIdRef.current.clear();
    itemNodeByIdRef.current.clear();
    frameMetaByIdRef.current.clear();
    activeSelectionBoxRef.current = null;
    hideSelectionMarquee();

    const visibleItems = scene.items
      .filter((item) => item.visible)
      .sort((left, right) => left.zIndex - right.zIndex);

    visibleItems.forEach((item) => {
      const safeWidth =
        Number.isFinite(item.width) && item.width > 1 ? item.width : 180;
      const safeHeight =
        Number.isFinite(item.height) && item.height > 1 ? item.height : 120;
      const safeRotation = Number.isFinite(item.rotation) ? item.rotation : 0;
      const safeScaleX =
        Number.isFinite(item.scaleX) && item.scaleX !== 0 ? item.scaleX : 1;
      const safeScaleY =
        Number.isFinite(item.scaleY) && item.scaleY !== 0 ? item.scaleY : 1;

      const itemNode = new Container();
      itemNode.position.set(item.x, item.y);
      itemNode.rotation = safeRotation;
      itemNode.scale.set(item.flippedX ? -safeScaleX : safeScaleX, safeScaleY);
      itemNode.pivot.x = item.flippedX ? safeWidth : 0;
      itemNode.eventMode = doodleActive ? "none" : "static";
      itemNode.cursor =
        doodleActive || groupRef.current.locked
          ? "default"
          : item.locked
            ? "default"
            : "move";
      itemNode.hitArea = new Rectangle(0, 0, safeWidth, safeHeight);

      const frame = new Graphics();
      frameByIdRef.current.set(item.id, frame);
      itemNodeByIdRef.current.set(item.id, itemNode);
      frameMetaByIdRef.current.set(item.id, {
        width: safeWidth,
        height: safeHeight,
        isCapture: item.type === "capture",
      });
      drawItemFrame(
        frame,
        safeWidth,
        safeHeight,
        item.type === "capture",
        selectionIdsRef.current.includes(item.id),
      );
      itemNode.addChild(frame);

      const selectionHighlight = new Graphics();
      selectionHighlight.name = SELECTION_HIGHLIGHT_NAME;
      selectionHighlight.rect(0, 0, safeWidth, safeHeight).fill({
        color: 0xffffff,
        alpha: SELECTION_HIGHLIGHT_ALPHA,
      });
      selectionHighlight.alpha = 0;
      selectionHighlight.eventMode = "none";
      itemNode.addChild(selectionHighlight);

      if (item.type === "image" && item.assetPath) {
        void loadTextureForAssetPath(item.assetPath)
          .then((texture) => {
            if (renderTokenRef.current !== renderToken) {
              return;
            }

            const sprite = new Sprite(texture);
            const sourceWidth =
              item.originalWidth ??
              Math.max(1, Math.round(texture.width || safeWidth));
            const sourceHeight =
              item.originalHeight ??
              Math.max(1, Math.round(texture.height || safeHeight));
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

            sprite.roundPixels = true;
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
            sprite.alpha = 0.98;
            itemNode.addChildAt(sprite, 1);
          })
          .catch((error) => {
            if (renderTokenRef.current !== renderToken) {
              return;
            }

            createFallbackHint(
              itemNode,
              error instanceof Error &&
                error.message.toLowerCase().includes("permission")
                ? "Screen recording permission required"
                : "Capture preview unavailable",
              safeHeight,
            );
          });
      }

      if (
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

      applySelectionVisualState(itemNode, item.id, selectionIdsRef.current);

      itemNode.on("pointerdown", (event: FederatedPointerEvent) => {
        event.stopPropagation();

        const panByModifier =
          spacePanActiveRef.current ||
          event.nativeEvent.altKey ||
          event.nativeEvent.button === 1;

        if (panByModifier) {
          isPanningRef.current = true;
          panStartRef.current = {
            x: event.nativeEvent.clientX,
            y: event.nativeEvent.clientY,
          };
          panOriginRef.current = {
            x: boardContainer.x,
            y: boardContainer.y,
          };
          board.cursor = "grabbing";
          return;
        }

        const now = performance.now();
        const previousPress = lastItemPressRef.current;
        if (
          event.nativeEvent instanceof MouseEvent &&
          previousPress?.itemId === item.id &&
          now - previousPress.time <= 320
        ) {
          lastItemPressRef.current = null;
          activeItemDragRef.current = null;
          onItemDoubleClickRef.current?.(item.id);
          return;
        }

        lastItemPressRef.current = {
          itemId: item.id,
          time: now,
        };

        const currentSelection = selectionIdsRef.current;
        if (event.nativeEvent.shiftKey) {
          const nextSelection = currentSelection.includes(item.id)
            ? currentSelection.filter((id) => id !== item.id)
            : [...currentSelection, item.id];

          selectionIdsRef.current = nextSelection;
          onSelectionChangeRef.current(nextSelection);
          return;
        }

        const nextSelection = currentSelection.includes(item.id)
          ? currentSelection
          : [item.id];

        selectionIdsRef.current = nextSelection;
        onSelectionChangeRef.current(nextSelection);

        if (groupRef.current.locked || item.locked) {
          return;
        }

        const selectionSet = new Set(nextSelection);
        const dragItems = groupRef.current.items
          .filter((entry) => selectionSet.has(entry.id) && !entry.locked)
          .sort((left, right) => left.zIndex - right.zIndex)
          .map((entry) => {
            const node = itemNodeByIdRef.current.get(entry.id);
            if (!node) {
              return null;
            }

            return {
              itemId: entry.id,
              itemNode: node,
              startPos: { x: entry.x, y: entry.y },
              width:
                Number.isFinite(entry.width) && entry.width > 1
                  ? entry.width
                  : 180,
              height:
                Number.isFinite(entry.height) && entry.height > 1
                  ? entry.height
                  : 120,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

        if (dragItems.length === 0) {
          return;
        }

        activeItemDragRef.current = {
          itemId: item.id,
          itemLayer,
          startPointer: {
            x: event.nativeEvent.clientX,
            y: event.nativeEvent.clientY,
          },
          items: dragItems,
          patchBuffer: {},
          hasMoved: false,
          zIndexApplied: false,
        };
      });

      itemLayer.addChild(itemNode);
    });

    redrawAnnotations(scene.annotations);

    board.on("pointerdown", (event: FederatedPointerEvent) => {
      event.stopPropagation();

      if (
        spacePanActiveRef.current ||
        event.nativeEvent.altKey ||
        event.nativeEvent.button === 1
      ) {
        isPanningRef.current = true;
        panStartRef.current = {
          x: event.nativeEvent.clientX,
          y: event.nativeEvent.clientY,
        };
        panOriginRef.current = {
          x: boardContainer.x,
          y: boardContainer.y,
        };
        board.cursor = "grabbing";
        return;
      }

      if (activeToolRef.current === "doodle") {
        startAnnotationSession(
          event.nativeEvent.clientX,
          event.nativeEvent.clientY,
        );
        return;
      }

      activeSelectionBoxRef.current = {
        startClient: {
          x: event.nativeEvent.clientX,
          y: event.nativeEvent.clientY,
        },
        additive: event.nativeEvent.shiftKey,
        baseSelection: selectionIdsRef.current,
      };
      hideSelectionMarquee();
    });
  }, [
    activeItemDragRef,
    activeSelectionBoxRef,
    activeToolRef,
    annotationLayerRef,
    annotationPreviewLayerRef,
    boardContainerRef,
    boardGraphicRef,
    drawBoardSurface,
    ensureCaptureSession,
    frameByIdRef,
    frameMetaByIdRef,
    gridGraphicRef,
    groupRef,
    hideSelectionMarquee,
    hostRef,
    isPanningRef,
    itemLayerRef,
    itemNodeByIdRef,
    onSelectionChangeRef,
    onItemDoubleClickRef,
    panOriginRef,
    panStartRef,
    redrawAnnotations,
    renderTokenRef,
    selectionIdsRef,
    spacePanActiveRef,
    startAnnotationSession,
    syncViewFromGroup,
    lastItemPressRef,
  ]);
};
