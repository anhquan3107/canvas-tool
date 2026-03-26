import { useEffect, useRef } from "react";
import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
} from "pixi.js";
import type { CanvasItemBase, ReferenceGroup } from "@shared/types/project";

type CanvasItemPatch = Partial<Omit<CanvasItemBase, "id" | "type">>;

interface CanvasBoardProps {
  group: ReferenceGroup;
  selectedItemIds: string[];
  onSelectionChange: (itemIds: string[]) => void;
  onViewChange: (zoom: number, panX: number, panY: number) => void;
  onItemsPatch: (updates: Record<string, CanvasItemPatch>) => void;
}

export const CanvasBoard = ({
  group,
  selectedItemIds,
  onSelectionChange,
  onViewChange,
  onItemsPatch,
}: CanvasBoardProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let mounted = true;
    let pixiApp: Application | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cleanupListeners: (() => void) | null = null;

    const bootstrap = async () => {
      const app = new Application();
      await app.init({
        antialias: true,
        autoDensity: true,
        background: "#1d1916",
        resizeTo: host,
      });

      if (!mounted) {
        app.destroy(true, { children: true });
        return;
      }

      pixiApp = app;
      host.appendChild(app.canvas);

      const root = new Container();
      app.stage.addChild(root);
      root.eventMode = "static";

      const boardContainer = new Container();
      boardContainer.x = group.panX;
      boardContainer.y = group.panY;
      boardContainer.scale.set(group.zoom, group.zoom);
      root.addChild(boardContainer);

      const board = new Graphics();
      board.roundRect(
        0,
        0,
        group.canvasSize.width,
        group.canvasSize.height,
        24,
      );
      board.fill(0x2a2421);
      board.stroke({ color: 0x5c5148, width: 2, alpha: 0.8 });
      boardContainer.addChild(board);

      const grid = new Graphics();
      for (let x = 0; x <= group.canvasSize.width; x += 120) {
        grid.moveTo(x, 0);
        grid.lineTo(x, group.canvasSize.height);
      }
      for (let y = 0; y <= group.canvasSize.height; y += 120) {
        grid.moveTo(0, y);
        grid.lineTo(group.canvasSize.width, y);
      }
      grid.stroke({ width: 1, color: 0x40362f, alpha: 0.4 });
      boardContainer.addChild(grid);

      const selectionSet = new Set(selectedItemIds);

      const patchBuffer: Record<string, CanvasItemPatch> = {};

      group.items
        .filter((item) => item.visible)
        .sort((left, right) => left.zIndex - right.zIndex)
        .forEach((item) => {
          const itemNode = new Container();
          itemNode.position.set(item.x, item.y);
          itemNode.rotation = item.rotation;
          itemNode.scale.set(
            item.flippedX ? -item.scaleX : item.scaleX,
            item.scaleY,
          );
          itemNode.pivot.x = item.flippedX ? item.width : 0;
          itemNode.eventMode = "static";
          itemNode.cursor = "move";
          itemNode.hitArea = new Rectangle(0, 0, item.width, item.height);

          const frame = new Graphics();
          frame.roundRect(0, 0, item.width, item.height, 12);
          frame.fill(item.type === "capture" ? 0x3f6574 : 0xb87944);
          frame.stroke({
            color: selectionSet.has(item.id) ? 0xf2d1a8 : 0xe8b98a,
            width: selectionSet.has(item.id) ? 4 : 2,
            alpha: 0.95,
          });
          itemNode.addChild(frame);

          if (
            item.type === "image" &&
            item.assetPath &&
            item.previewStatus !== "blocked"
          ) {
            const sprite = Sprite.from(item.assetPath);
            sprite.width = item.width;
            sprite.height = item.height;
            sprite.roundPixels = true;
            sprite.alpha = 0.92;
            itemNode.addChild(sprite);
          }

          if (item.type === "image" && item.previewStatus === "blocked") {
            const blockedHint = new Text({
              text: "Preview blocked by remote source",
              style: new TextStyle({
                fill: "#ffce9e",
                fontSize: 13,
                fontFamily: "IBM Plex Sans",
              }),
            });
            blockedHint.position.set(10, item.height - 24);
            blockedHint.alpha = 0.9;
            itemNode.addChild(blockedHint);
          }

          const label = new Text({
            text: `${("label" in item ? item.label : undefined) ?? item.type} (${Math.round(item.width)}×${Math.round(item.height)})`,
            style: new TextStyle({
              fill: "#fff4e8",
              fontSize: 14,
              fontFamily: "IBM Plex Sans",
            }),
          });
          label.position.set(10, 10);
          label.alpha = 0.95;
          itemNode.addChild(label);

          let dragStart: { x: number; y: number } | null = null;
          let startPos: { x: number; y: number } | null = null;

          itemNode.on("pointerdown", (event: FederatedPointerEvent) => {
            if (event.nativeEvent.shiftKey) {
              if (selectionSet.has(item.id)) {
                onSelectionChange(
                  selectedItemIds.filter((id) => id !== item.id),
                );
              } else {
                onSelectionChange([...selectedItemIds, item.id]);
              }
            } else {
              onSelectionChange([item.id]);
            }

            dragStart = { x: event.globalX, y: event.globalY };
            startPos = { x: item.x, y: item.y };
          });

          itemNode.on("pointermove", (event: FederatedPointerEvent) => {
            if (!dragStart || !startPos || item.locked) {
              return;
            }

            const deltaX =
              (event.globalX - dragStart.x) / boardContainer.scale.x;
            const deltaY =
              (event.globalY - dragStart.y) / boardContainer.scale.y;

            itemNode.position.set(startPos.x + deltaX, startPos.y + deltaY);

            patchBuffer[item.id] = {
              x: startPos.x + deltaX,
              y: startPos.y + deltaY,
            };
          });

          itemNode.on("pointerup", () => {
            dragStart = null;
            startPos = null;

            if (Object.keys(patchBuffer).length > 0) {
              onItemsPatch({ ...patchBuffer });
            }
          });

          itemNode.on("pointerupoutside", () => {
            dragStart = null;
            startPos = null;
          });

          boardContainer.addChild(itemNode);
        });

      const hint = new Text({
        text: "Drop files/URLs or paste image links/files | Pan: Space+Drag | Zoom: Ctrl +/-",
        style: new TextStyle({
          fill: "#cdb59a",
          fontFamily: "IBM Plex Sans",
          fontSize: 14,
        }),
      });
      hint.position.set(20, 20);
      app.stage.addChild(hint);

      let isPanning = false;
      let panStart = { x: 0, y: 0 };
      let panOrigin = { x: boardContainer.x, y: boardContainer.y };
      let spacePressed = false;

      const syncView = () => {
        onViewChange(
          boardContainer.scale.x,
          boardContainer.x,
          boardContainer.y,
        );
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.code === "Space") {
          spacePressed = true;
        }
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (event.code === "Space") {
          spacePressed = false;
          isPanning = false;
        }
      };

      const onPointerDown = (event: PointerEvent) => {
        if (!spacePressed) {
          return;
        }

        isPanning = true;
        panStart = { x: event.clientX, y: event.clientY };
        panOrigin = { x: boardContainer.x, y: boardContainer.y };
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!isPanning) {
          return;
        }

        boardContainer.x = panOrigin.x + (event.clientX - panStart.x);
        boardContainer.y = panOrigin.y + (event.clientY - panStart.y);
        syncView();
      };

      const onPointerUp = () => {
        isPanning = false;
      };

      const onWheel = (event: WheelEvent) => {
        if (!event.ctrlKey && !event.metaKey) {
          return;
        }

        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        const nextZoom = Math.min(
          3,
          Math.max(0.25, boardContainer.scale.x + direction * 0.08),
        );
        boardContainer.scale.set(nextZoom, nextZoom);
        syncView();
      };

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      host.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      host.addEventListener("wheel", onWheel, { passive: false });

      cleanupListeners = () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        host.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        host.removeEventListener("wheel", onWheel);
      };

      resizeObserver = new ResizeObserver(() => {
        app.renderer.resize(host.clientWidth, host.clientHeight);
      });

      resizeObserver.observe(host);
    };

    void bootstrap();

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      cleanupListeners?.();

      if (pixiApp) {
        void pixiApp.destroy(true, {
          children: true,
        });
      }
    };
  }, [group, onItemsPatch, onSelectionChange, onViewChange, selectedItemIds]);

  return <div className="canvas-host" ref={hostRef} />;
};
