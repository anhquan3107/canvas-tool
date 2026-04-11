import { useCallback, type MutableRefObject } from "react";
import {
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
} from "pixi.js";
import type { CaptureItem, ReferenceGroup } from "@shared/types/project";
import { drawItemFrame } from "@renderer/pixi/utils/item-frame";
import {
  applySelectionVisualState,
  SELECTION_HIGHLIGHT_ALPHA,
  SELECTION_HIGHLIGHT_NAME,
  syncSelectionItemOrder,
} from "@renderer/pixi/hooks/use-board-selection-visuals";
import { renderBoardItemVisuals } from "@renderer/pixi/hooks/use-board-item-render";
import {
  getNormalizedPointerData,
  type NormalizedPointerData,
} from "@renderer/pixi/utils/pointer";
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
  onLockedInteractionRef: MutableRefObject<(() => void) | undefined>;
  onItemDoubleClickRef: MutableRefObject<((itemId: string) => void) | undefined>;
  activeToolRef: MutableRefObject<string | null>;
  showSwatchesRef: MutableRefObject<boolean>;
  renderTokenRef: MutableRefObject<number>;
  activeItemDragRef: MutableRefObject<ActiveItemDragState | null>;
  activeSelectionBoxRef: MutableRefObject<ActiveSelectionBoxState | null>;
  isPanningRef: MutableRefObject<boolean>;
  panStartRef: MutableRefObject<{ x: number; y: number }>;
  panOriginRef: MutableRefObject<{ x: number; y: number }>;
  cancelWheelZoomAnimationRef: MutableRefObject<(() => void) | null>;
  spacePanActiveRef: MutableRefObject<boolean>;
  lastItemPressRef: MutableRefObject<{ itemId: string; time: number } | null>;
  ensureCaptureSession: (item: CaptureItem) => Promise<CaptureSession>;
  drawBoardSurface: (insets?: CanvasInsets) => void;
  syncViewFromGroup: () => void;
  hideSelectionMarquee: () => void;
  redrawAnnotations: (annotations?: ReferenceGroup["annotations"]) => void;
  startAnnotationSession: (
    pointer: Pick<
      NormalizedPointerData,
      "clientX" | "clientY" | "pointerId" | "pointerType" | "pressure"
    >,
  ) => void;
}

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
  onLockedInteractionRef,
  onItemDoubleClickRef,
  activeToolRef,
  showSwatchesRef,
  renderTokenRef,
  activeItemDragRef,
  activeSelectionBoxRef,
  isPanningRef,
  panStartRef,
  panOriginRef,
  cancelWheelZoomAnimationRef,
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

      renderBoardItemVisuals({
        item,
        itemNode,
        safeWidth,
        safeHeight,
        showSwatches: showSwatchesRef.current,
        canvasZoom: scene.zoom,
        renderToken,
        renderTokenRef,
        ensureCaptureSession,
      });

      applySelectionVisualState(itemNode, item.id, selectionIdsRef.current);

      itemNode.on("pointerdown", (event: FederatedPointerEvent) => {
        event.stopPropagation();

        if (groupRef.current.locked) {
          onLockedInteractionRef.current?.();
          return;
        }

        if (event.nativeEvent.button === 2) {
          const nextSelection = [item.id];
          selectionIdsRef.current = nextSelection;
          onSelectionChangeRef.current(nextSelection);
          return;
        }

        const panByModifier =
          spacePanActiveRef.current ||
          event.nativeEvent.altKey ||
          event.nativeEvent.button === 1;

        if (panByModifier) {
          cancelWheelZoomAnimationRef.current?.();
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
              visualWidth:
                (Number.isFinite(entry.width) && entry.width > 1
                  ? entry.width
                  : 180) *
                Math.abs(
                  Number.isFinite(entry.scaleX) && entry.scaleX !== 0
                    ? entry.scaleX
                    : 1,
                ),
              visualHeight:
                (Number.isFinite(entry.height) && entry.height > 1
                  ? entry.height
                  : 120) *
                Math.abs(
                  Number.isFinite(entry.scaleY) && entry.scaleY !== 0
                    ? entry.scaleY
                    : 1,
                ),
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

    syncSelectionItemOrder(
      itemLayer,
      itemNodeByIdRef.current,
      scene.items,
      selectionIdsRef.current,
    );

    redrawAnnotations(scene.annotations);

    board.on("pointerdown", (event: FederatedPointerEvent) => {
      event.stopPropagation();

      if (groupRef.current.locked) {
        onLockedInteractionRef.current?.();
        return;
      }

      if (event.nativeEvent.button === 2) {
        return;
      }

      if (
        spacePanActiveRef.current ||
        event.nativeEvent.altKey ||
        event.nativeEvent.button === 1
      ) {
        cancelWheelZoomAnimationRef.current?.();
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
          getNormalizedPointerData(event.nativeEvent as MouseEvent | PointerEvent),
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
    onLockedInteractionRef,
    onSelectionChangeRef,
    onItemDoubleClickRef,
    cancelWheelZoomAnimationRef,
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
