import { useCallback, useEffect, useRef, useState } from "react";
import {
  Application,
  Assets,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";
import type { CanvasItemBase, ReferenceGroup } from "@shared/types/project";

type CanvasItemPatch = Partial<Omit<CanvasItemBase, "id" | "type">>;

interface CanvasBoardProps {
  group: ReferenceGroup;
  selectedItemIds: string[];
  onSelectionChange: (itemIds: string[]) => void;
  onViewChange: (zoom: number, panX: number, panY: number) => void;
  onItemsPatch: (updates: Record<string, CanvasItemPatch>) => void;
  onCanvasSizePreviewChange?: (
    size: { width: number; height: number } | null,
  ) => void;
}

const BOARD_EXPANSION_PADDING = 140;
const BOARD_CORNER_RADIUS = 24;
const ZERO_INSETS = { left: 0, top: 0, right: 0, bottom: 0 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const drawItemFrame = (
  frame: Graphics,
  width: number,
  height: number,
  isCapture: boolean,
  isSelected: boolean,
) => {
  frame.clear();
  frame.roundRect(0, 0, width, height, 12);
  frame.fill(isCapture ? 0x3d6072 : 0x8a5e32);
  frame.stroke({
    color: isSelected ? 0xf3a84c : 0xe8d9bf,
    width: isSelected ? 4 : 2,
    alpha: isSelected ? 0.95 : 0.72,
  });
};

const loadTextureForAssetPath = async (assetPath: string) => {
  try {
    return await Assets.load<Texture>(assetPath);
  } catch {
    return await new Promise<Texture>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(Texture.from(image));
      image.onerror = () =>
        reject(new Error(`Failed to decode texture for ${assetPath}`));
      image.src = assetPath;
    });
  }
};

export const CanvasBoard = ({
  group,
  selectedItemIds,
  onSelectionChange,
  onViewChange,
  onItemsPatch,
  onCanvasSizePreviewChange,
}: CanvasBoardProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardContainerRef = useRef<Container | null>(null);
  const boardGraphicRef = useRef<Graphics | null>(null);
  const gridGraphicRef = useRef<Graphics | null>(null);
  const itemLayerRef = useRef<Container | null>(null);
  const frameByIdRef = useRef(new Map<string, Graphics>());
  const frameMetaByIdRef = useRef(
    new Map<string, { width: number; height: number; isCapture: boolean }>(),
  );
  const selectionIdsRef = useRef(selectedItemIds);
  const groupRef = useRef(group);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onItemsPatchRef = useRef(onItemsPatch);
  const onViewChangeRef = useRef(onViewChange);
  const onCanvasSizePreviewChangeRef = useRef(onCanvasSizePreviewChange);
  const renderTokenRef = useRef(0);
  const viewCommitTimerRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const previewInsetsRef = useRef(ZERO_INSETS);
  const activeItemDragRef = useRef<{
    itemId: string;
    itemNode: Container;
    startPointer: { x: number; y: number };
    startPos: { x: number; y: number };
    width: number;
    height: number;
    patchBuffer: Record<string, CanvasItemPatch>;
  } | null>(null);
  const [appReady, setAppReady] = useState(false);
  const boardFilter = `blur(${group.filters.blur}px) grayscale(${group.filters.grayscale}%)`;

  useEffect(() => {
    selectionIdsRef.current = selectedItemIds;
    frameByIdRef.current.forEach((frame, id) => {
      const meta = frameMetaByIdRef.current.get(id);
      if (!meta) {
        return;
      }

      drawItemFrame(
        frame,
        meta.width,
        meta.height,
        meta.isCapture,
        selectedItemIds.includes(id),
      );
    });
  }, [selectedItemIds]);

  useEffect(() => {
    groupRef.current = group;
  }, [group]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onItemsPatchRef.current = onItemsPatch;
  }, [onItemsPatch]);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    onCanvasSizePreviewChangeRef.current = onCanvasSizePreviewChange;
  }, [onCanvasSizePreviewChange]);

  const drawBoardSurface = useCallback(
    (insets = previewInsetsRef.current) => {
      const board = boardGraphicRef.current;
      if (!board) {
        return;
      }

      const scene = groupRef.current;
      const width = scene.canvasSize.width + insets.left + insets.right;
      const height = scene.canvasSize.height + insets.top + insets.bottom;

      board.clear();
      board.roundRect(
        -insets.left,
        -insets.top,
        width,
        height,
        BOARD_CORNER_RADIUS,
      );
      board.fill(0x151515);
      board.stroke({ color: 0x2a2a2a, width: 2, alpha: 0.92 });
      board.hitArea = new Rectangle(-insets.left, -insets.top, width, height);
    },
    [],
  );

  const setPreviewInsets = useCallback(
    (nextInsets: typeof ZERO_INSETS) => {
      const currentInsets = previewInsetsRef.current;
      if (
        currentInsets.left === nextInsets.left &&
        currentInsets.top === nextInsets.top &&
        currentInsets.right === nextInsets.right &&
        currentInsets.bottom === nextInsets.bottom
      ) {
        return;
      }

      previewInsetsRef.current = nextInsets;
      drawBoardSurface(nextInsets);

      if (
        nextInsets.left === 0 &&
        nextInsets.top === 0 &&
        nextInsets.right === 0 &&
        nextInsets.bottom === 0
      ) {
        onCanvasSizePreviewChangeRef.current?.(null);
        return;
      }

      const scene = groupRef.current;
      onCanvasSizePreviewChangeRef.current?.({
        width: Math.round(
          scene.canvasSize.width + nextInsets.left + nextInsets.right,
        ),
        height: Math.round(
          scene.canvasSize.height + nextInsets.top + nextInsets.bottom,
        ),
      });
    },
    [drawBoardSurface],
  );

  const commitView = useCallback(() => {
    const boardContainer = boardContainerRef.current;
    if (!boardContainer) {
      return;
    }

    if (viewCommitTimerRef.current !== null) {
      window.clearTimeout(viewCommitTimerRef.current);
      viewCommitTimerRef.current = null;
    }

    onViewChangeRef.current(
      boardContainer.scale.x,
      boardContainer.x,
      boardContainer.y,
    );
  }, []);

  const scheduleViewCommit = useCallback((delay = 80) => {
    const boardContainer = boardContainerRef.current;
    if (!boardContainer) {
      return;
    }

    if (viewCommitTimerRef.current !== null) {
      window.clearTimeout(viewCommitTimerRef.current);
    }

    viewCommitTimerRef.current = window.setTimeout(() => {
      viewCommitTimerRef.current = null;
      onViewChangeRef.current(
        boardContainer.scale.x,
        boardContainer.x,
        boardContainer.y,
      );
    }, delay);
  }, []);

  const syncViewFromGroup = useCallback(() => {
    const boardContainer = boardContainerRef.current;
    if (!boardContainer) {
      return;
    }

    const scene = groupRef.current;
    boardContainer.x = scene.panX;
    boardContainer.y = scene.panY;
    boardContainer.scale.set(scene.zoom, scene.zoom);
  }, []);

  const updateDraggedItemPosition = useCallback((clientX: number, clientY: number) => {
    const activeDrag = activeItemDragRef.current;
    const boardContainer = boardContainerRef.current;
    if (!activeDrag || !boardContainer) {
      return;
    }

    const deltaX =
      (clientX - activeDrag.startPointer.x) / boardContainer.scale.x;
    const deltaY =
      (clientY - activeDrag.startPointer.y) / boardContainer.scale.y;
    const nextX = activeDrag.startPos.x + deltaX;
    const nextY = activeDrag.startPos.y + deltaY;

    activeDrag.itemNode.position.set(nextX, nextY);
    activeDrag.patchBuffer[activeDrag.itemId] = {
      x: Math.round(nextX),
      y: Math.round(nextY),
    };

    setPreviewInsets({
      left:
        nextX < 0 ? Math.ceil(-nextX + BOARD_EXPANSION_PADDING) : 0,
      top:
        nextY < 0 ? Math.ceil(-nextY + BOARD_EXPANSION_PADDING) : 0,
      right:
        nextX + activeDrag.width > groupRef.current.canvasSize.width
          ? Math.ceil(
              nextX +
                activeDrag.width -
                groupRef.current.canvasSize.width +
                BOARD_EXPANSION_PADDING,
            )
          : 0,
      bottom:
        nextY + activeDrag.height > groupRef.current.canvasSize.height
          ? Math.ceil(
              nextY +
                activeDrag.height -
                groupRef.current.canvasSize.height +
                BOARD_EXPANSION_PADDING,
            )
          : 0,
    });
  }, [setPreviewInsets]);

  const commitDraggedItemPatch = useCallback(() => {
    const activeDrag = activeItemDragRef.current;
    if (!activeDrag) {
      return;
    }

    activeItemDragRef.current = null;

    if (Object.keys(activeDrag.patchBuffer).length > 0) {
      onItemsPatchRef.current({ ...activeDrag.patchBuffer });
      return;
    }

    setPreviewInsets(ZERO_INSETS);
  }, [setPreviewInsets]);

  const rebuildScene = useCallback(() => {
    const boardContainer = boardContainerRef.current;
    const board = boardGraphicRef.current;
    const grid = gridGraphicRef.current;
    const itemLayer = itemLayerRef.current;
    const host = hostRef.current;

    if (!boardContainer || !board || !grid || !itemLayer || !host) {
      return;
    }

    const scene = groupRef.current;
    const renderToken = ++renderTokenRef.current;

    syncViewFromGroup();

    board.eventMode = "static";
    board.cursor = "grab";
    board.removeAllListeners();
    drawBoardSurface();

    grid.clear();

    itemLayer.removeChildren().forEach((child) => {
      child.destroy({ children: true });
    });
    frameByIdRef.current.clear();
    frameMetaByIdRef.current.clear();

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
      itemNode.eventMode = "static";
      itemNode.cursor = item.locked ? "default" : "move";
      itemNode.hitArea = new Rectangle(0, 0, safeWidth, safeHeight);

      const frame = new Graphics();
      frameByIdRef.current.set(item.id, frame);
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

      if (item.type === "image" && item.assetPath) {
        const showFallbackHint = (message: string) => {
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

        void loadTextureForAssetPath(item.assetPath)
          .then((texture) => {
            if (renderTokenRef.current !== renderToken) {
              return;
            }

            const sprite = new Sprite(texture);
            sprite.width = safeWidth;
            sprite.height = safeHeight;
            sprite.roundPixels = true;
            sprite.alpha = 0.96;
            itemNode.addChildAt(sprite, 1);
          })
          .catch(() => {
            if (renderTokenRef.current !== renderToken) {
              return;
            }

            showFallbackHint(
              item.previewStatus === "blocked"
                ? "Preview blocked by remote source"
                : "Preview unavailable",
            );
          });
      }

      const label = new Text({
        text: `${("label" in item ? item.label : undefined) ?? item.type} (${Math.round(safeWidth)}x${Math.round(safeHeight)})`,
        style: new TextStyle({
          fill: "#f0ece7",
          fontSize: 14,
          fontFamily: "Aptos",
        }),
      });
      label.position.set(10, 10);
      label.alpha = 0.95;
      itemNode.addChild(label);

      itemNode.on("pointerdown", (event: FederatedPointerEvent) => {
        event.stopPropagation();

        const currentSelection = selectionIdsRef.current;
        const nextSelection = event.nativeEvent.shiftKey
          ? currentSelection.includes(item.id)
            ? currentSelection.filter((id) => id !== item.id)
            : [...currentSelection, item.id]
          : [item.id];

        selectionIdsRef.current = nextSelection;
        onSelectionChangeRef.current(nextSelection);

        drawItemFrame(
          frame,
          safeWidth,
          safeHeight,
          item.type === "capture",
          true,
        );

        if (item.locked) {
          return;
        }

        activeItemDragRef.current = {
          itemId: item.id,
          itemNode,
          startPointer: {
            x: event.nativeEvent.clientX,
            y: event.nativeEvent.clientY,
          },
          startPos: { x: item.x, y: item.y },
          width: safeWidth,
          height: safeHeight,
          patchBuffer: {},
        };
      });

      itemNode.on("pointermove", (event: FederatedPointerEvent) => {
        if (item.locked || !activeItemDragRef.current) {
          return;
        }

        updateDraggedItemPosition(
          event.nativeEvent.clientX,
          event.nativeEvent.clientY,
        );
      });

      itemNode.on("pointerup", commitDraggedItemPatch);
      itemNode.on("pointerupoutside", commitDraggedItemPatch);

      itemLayer.addChild(itemNode);
    });

    board.on("pointerdown", (event: FederatedPointerEvent) => {
      event.stopPropagation();
      isPanningRef.current = true;
      panStartRef.current = { x: event.globalX, y: event.globalY };
      panOriginRef.current = { x: boardContainer.x, y: boardContainer.y };
      board.cursor = "grabbing";
      const currentSelection = selectionIdsRef.current;
      if (currentSelection.length > 0) {
        selectionIdsRef.current = [];
        onSelectionChangeRef.current([]);
      }
    });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;

    const bootstrap = async () => {
      const app = new Application();
      await app.init({
        antialias: true,
        autoDensity: true,
        background: "#232323",
        resizeTo: host,
      });

      if (!mounted) {
        app.destroy(true, { children: true });
        return;
      }

      appRef.current = app;
      host.replaceChildren(app.canvas);

      const root = new Container();
      root.eventMode = "static";
      app.stage.addChild(root);

      const boardContainer = new Container();
      root.addChild(boardContainer);
      boardContainerRef.current = boardContainer;

      const board = new Graphics();
      boardContainer.addChild(board);
      boardGraphicRef.current = board;

      const grid = new Graphics();
      boardContainer.addChild(grid);
      gridGraphicRef.current = grid;

      const itemLayer = new Container();
      boardContainer.addChild(itemLayer);
      itemLayerRef.current = itemLayer;

      const onPointerMove = (event: PointerEvent) => {
        if (activeItemDragRef.current) {
          updateDraggedItemPosition(event.clientX, event.clientY);
          return;
        }

        const currentBoard = boardContainerRef.current;
        if (!isPanningRef.current || !currentBoard) {
          return;
        }

        currentBoard.x =
          panOriginRef.current.x + (event.clientX - panStartRef.current.x);
        currentBoard.y =
          panOriginRef.current.y + (event.clientY - panStartRef.current.y);
      };

      const onPointerUp = () => {
        if (activeItemDragRef.current) {
          commitDraggedItemPatch();
        }

        if (!isPanningRef.current) {
          return;
        }

        isPanningRef.current = false;
        if (boardGraphicRef.current) {
          boardGraphicRef.current.cursor = "grab";
        }
        commitView();
      };

      const onWheel = (event: WheelEvent) => {
        const currentBoard = boardContainerRef.current;
        if (!currentBoard) {
          return;
        }

        event.preventDefault();

        const rect = host.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;

        if (event.ctrlKey || event.metaKey) {
          const worldX = (pointerX - currentBoard.x) / currentBoard.scale.x;
          const worldY = (pointerY - currentBoard.y) / currentBoard.scale.y;
          const nextZoom = clamp(
            currentBoard.scale.x * Math.exp(-event.deltaY * 0.0015),
            0.18,
            4,
          );

          currentBoard.scale.set(nextZoom, nextZoom);
          currentBoard.x = pointerX - worldX * nextZoom;
          currentBoard.y = pointerY - worldY * nextZoom;
          scheduleViewCommit(100);
          return;
        }

        currentBoard.x -= event.deltaX;
        currentBoard.y -= event.deltaY;
        scheduleViewCommit(30);
      };

      host.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);

      resizeObserver = new ResizeObserver(() => {
        app.renderer.resize(host.clientWidth, host.clientHeight);
      });
      resizeObserver.observe(host);
      rebuildScene();
      setAppReady(true);
    };

    void bootstrap();

    return () => {
      mounted = false;

      if (viewCommitTimerRef.current !== null) {
        window.clearTimeout(viewCommitTimerRef.current);
        viewCommitTimerRef.current = null;
      }

      resizeObserver?.disconnect();
      activeItemDragRef.current = null;
      host.replaceChildren();
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
      boardContainerRef.current = null;
      boardGraphicRef.current = null;
      gridGraphicRef.current = null;
      itemLayerRef.current = null;
      frameByIdRef.current.clear();
      frameMetaByIdRef.current.clear();
    };
  }, [
    commitDraggedItemPatch,
    commitView,
    rebuildScene,
    scheduleViewCommit,
    updateDraggedItemPosition,
  ]);

  useEffect(() => {
      if (!appReady) {
        return;
      }

      previewInsetsRef.current = ZERO_INSETS;
      onCanvasSizePreviewChangeRef.current?.(null);
      rebuildScene();
    }, [
      appReady,
    group.id,
    group.items,
      group.canvasSize.width,
      group.canvasSize.height,
      rebuildScene,
    ]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    syncViewFromGroup();
  }, [appReady, group.panX, group.panY, group.zoom, syncViewFromGroup]);

  useEffect(
    () => () => {
      onCanvasSizePreviewChangeRef.current?.(null);
    },
    [],
  );

  return (
    <div className="canvas-host">
      <div
        className="canvas-surface"
        ref={hostRef}
        style={{ filter: boardFilter }}
      />
    </div>
  );
};
