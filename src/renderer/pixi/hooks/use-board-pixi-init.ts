import type { MutableRefObject } from "react";
import { Application, Container, Graphics } from "pixi.js";

interface InitializeBoardPixiOptions {
  host: HTMLDivElement;
  isMounted: () => boolean;
  appRef: MutableRefObject<Application | null>;
  boardContainerRef: MutableRefObject<Container | null>;
  boardGraphicRef: MutableRefObject<Graphics | null>;
  gridGraphicRef: MutableRefObject<Graphics | null>;
  itemLayerRef: MutableRefObject<Container | null>;
  annotationMaskRef: MutableRefObject<Graphics | null>;
  annotationLayerRef: MutableRefObject<Graphics | null>;
  annotationPreviewLayerRef: MutableRefObject<Graphics | null>;
}

export const initializeBoardPixi = async ({
  host,
  isMounted,
  appRef,
  boardContainerRef,
  boardGraphicRef,
  gridGraphicRef,
  itemLayerRef,
  annotationMaskRef,
  annotationLayerRef,
  annotationPreviewLayerRef,
}: InitializeBoardPixiOptions) => {
  const app = new Application();
  const rendererResolution = Math.max(window.devicePixelRatio || 1, 2);
  await app.init({
    antialias: true,
    autoDensity: true,
    background: "#000000",
    backgroundAlpha: 0,
    preserveDrawingBuffer: true,
    resolution: rendererResolution,
    resizeTo: host,
  });

  if (!isMounted()) {
    app.destroy(true, { children: true });
    return null;
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

  const annotationMask = new Graphics();
  annotationMask.eventMode = "none";
  annotationMask.alpha = 0;
  boardContainer.addChild(annotationMask);
  annotationMaskRef.current = annotationMask;

  const annotationLayer = new Graphics();
  annotationLayer.eventMode = "none";
  annotationLayer.mask = annotationMask;
  boardContainer.addChild(annotationLayer);
  annotationLayerRef.current = annotationLayer;

  const annotationPreviewLayer = new Graphics();
  annotationPreviewLayer.eventMode = "none";
  annotationPreviewLayer.mask = annotationMask;
  boardContainer.addChild(annotationPreviewLayer);
  annotationPreviewLayerRef.current = annotationPreviewLayer;

  return app;
};
