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
import type {
  AnnotationStroke,
  CaptureItem,
  CanvasItemBase,
  ReferenceGroup,
} from "@shared/types/project";
import type { DoodleMode, ToolMode } from "@renderer/features/tools/types";
import { CAPTURE_QUALITY_PROFILES } from "@renderer/features/connect/utils";

type CanvasItemPatch = Partial<Omit<CanvasItemBase, "id" | "type">>;

interface CanvasBoardProps {
  group: ReferenceGroup;
  activeTool: ToolMode | null;
  snapEnabled: boolean;
  doodleMode: DoodleMode;
  doodleColor: string;
  doodleSize: number;
  selectedItemIds: string[];
  onSelectionChange: (itemIds: string[]) => void;
  onViewChange: (zoom: number, panX: number, panY: number) => void;
  onItemsPatch: (updates: Record<string, CanvasItemPatch>) => void;
  onAnnotationsChange: (annotations: AnnotationStroke[]) => void;
  onCanvasSizePreviewChange?: (
    size: { width: number; height: number } | null,
  ) => void;
}

const BOARD_EXPANSION_PADDING = 24;
const BOARD_CORNER_RADIUS = 24;
const ZERO_INSETS = { left: 0, top: 0, right: 0, bottom: 0 };
const MIN_STROKE_POINT_DISTANCE = 2;
const SNAP_THRESHOLD = 14;
const SNAP_GAP = 2;
const MARQUEE_DRAG_THRESHOLD = 4;

interface CaptureSession {
  sourceId: string;
  quality: CaptureItem["quality"];
  stream: MediaStream;
  video: HTMLVideoElement;
  texture: Texture;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((value) => value + value)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);

  return `rgba(${Number.parseInt(expanded.slice(0, 2), 16)}, ${Number.parseInt(
    expanded.slice(2, 4),
    16,
  )}, ${Number.parseInt(expanded.slice(4, 6), 16)}, ${alpha})`;
};

const hexToPixiColor = (hex: string) =>
  Number.parseInt(hex.replace("#", ""), 16);

const distanceBetween = (
  first: { x: number; y: number },
  second: { x: number; y: number },
) => Math.hypot(first.x - second.x, first.y - second.y);

const distanceToSegment = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return distanceBetween(point, start);
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) /
      (dx * dx + dy * dy),
    0,
    1,
  );

  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
};

const drawAnnotationStroke = (graphics: Graphics, stroke: AnnotationStroke) => {
  if (stroke.points.length < 2) {
    return;
  }

  if (stroke.points.length === 2) {
    graphics.circle(stroke.points[0], stroke.points[1], stroke.size * 0.5);
    graphics.fill({ color: stroke.color, alpha: 1 });
    return;
  }

  graphics.moveTo(stroke.points[0], stroke.points[1]);
  for (let index = 2; index < stroke.points.length; index += 2) {
    graphics.lineTo(stroke.points[index], stroke.points[index + 1]);
  }
  graphics.stroke({
    color: stroke.color,
    width: stroke.size,
    alpha: 1,
    cap: "round",
    join: "round",
  });
};

const strokeTouchesPoint = (
  stroke: AnnotationStroke,
  point: { x: number; y: number },
  radius: number,
) => {
  const effectiveRadius = radius + stroke.size * 0.5;
  if (stroke.points.length === 2) {
    return (
      distanceBetween(point, { x: stroke.points[0], y: stroke.points[1] }) <=
      effectiveRadius
    );
  }

  for (let index = 0; index < stroke.points.length - 2; index += 2) {
    if (
      distanceToSegment(
        point,
        { x: stroke.points[index], y: stroke.points[index + 1] },
        { x: stroke.points[index + 2], y: stroke.points[index + 3] },
      ) <= effectiveRadius
    ) {
      return true;
    }
  }

  return false;
};

const eraseWholeStrokesAtPoint = (
  annotations: AnnotationStroke[],
  point: { x: number; y: number },
  radius: number,
) => {
  const nextAnnotations = annotations.filter(
    (stroke) => !strokeTouchesPoint(stroke, point, radius),
  );

  return nextAnnotations.length === annotations.length ? annotations : nextAnnotations;
};

const eraseStrokePixelsAtPoint = (
  stroke: AnnotationStroke,
  point: { x: number; y: number },
  radius: number,
) => {
  const effectiveRadius = radius + stroke.size * 0.5;
  const nextSegments: number[][] = [];
  let currentSegment: number[] = [];

  for (let index = 0; index < stroke.points.length; index += 2) {
    const x = stroke.points[index];
    const y = stroke.points[index + 1];
    const shouldErase = distanceBetween(point, { x, y }) <= effectiveRadius;

    if (shouldErase) {
      if (currentSegment.length >= 2) {
        nextSegments.push(currentSegment);
      }
      currentSegment = [];
      continue;
    }

    currentSegment.push(x, y);
  }

  if (currentSegment.length >= 2) {
    nextSegments.push(currentSegment);
  }

  if (nextSegments.length === 0) {
    return [];
  }

  if (
    nextSegments.length === 1 &&
    nextSegments[0].length === stroke.points.length
  ) {
    return [stroke];
  }

  return nextSegments.map((points, index) => ({
    ...stroke,
    id: index === 0 ? stroke.id : crypto.randomUUID(),
    points,
  }));
};

const eraseStrokePixelsAtPointFromAnnotations = (
  annotations: AnnotationStroke[],
  point: { x: number; y: number },
  radius: number,
) => {
  let changed = false;
  const nextAnnotations = annotations.flatMap((stroke) => {
    const nextStrokes = eraseStrokePixelsAtPoint(stroke, point, radius);
    if (
      nextStrokes.length !== 1 ||
      nextStrokes[0] !== stroke
    ) {
      changed = true;
    }
    return nextStrokes;
  });

  return changed ? nextAnnotations : annotations;
};

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
  if (isSelected) {
    frame.stroke({
      color: 0xf3a84c,
      width: 4,
      alpha: 0.95,
    });
  }
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
  activeTool,
  snapEnabled,
  doodleMode,
  doodleColor,
  doodleSize,
  selectedItemIds,
  onSelectionChange,
  onViewChange,
  onItemsPatch,
  onAnnotationsChange,
  onCanvasSizePreviewChange,
}: CanvasBoardProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cursorOverlayRef = useRef<HTMLDivElement | null>(null);
  const selectionMarqueeRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const boardContainerRef = useRef<Container | null>(null);
  const boardGraphicRef = useRef<Graphics | null>(null);
  const gridGraphicRef = useRef<Graphics | null>(null);
  const itemLayerRef = useRef<Container | null>(null);
  const annotationLayerRef = useRef<Graphics | null>(null);
  const annotationPreviewLayerRef = useRef<Graphics | null>(null);
  const frameByIdRef = useRef(new Map<string, Graphics>());
  const itemNodeByIdRef = useRef(new Map<string, Container>());
  const frameMetaByIdRef = useRef(
    new Map<string, { width: number; height: number; isCapture: boolean }>(),
  );
  const captureSessionByIdRef = useRef(new Map<string, CaptureSession>());
  const selectionIdsRef = useRef(selectedItemIds);
  const groupRef = useRef(group);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onItemsPatchRef = useRef(onItemsPatch);
  const onViewChangeRef = useRef(onViewChange);
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  const onCanvasSizePreviewChangeRef = useRef(onCanvasSizePreviewChange);
  const activeToolRef = useRef<ToolMode | null>(activeTool);
  const snapEnabledRef = useRef(snapEnabled);
  const doodleModeRef = useRef<DoodleMode>(doodleMode);
  const doodleColorRef = useRef(doodleColor);
  const doodleSizeRef = useRef(doodleSize);
  const renderTokenRef = useRef(0);
  const viewCommitTimerRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const previewInsetsRef = useRef(ZERO_INSETS);
  const activeItemDragRef = useRef<{
    itemId: string;
    itemLayer: Container;
    startPointer: { x: number; y: number };
    items: Array<{
      itemId: string;
      itemNode: Container;
      startPos: { x: number; y: number };
      width: number;
      height: number;
    }>;
    patchBuffer: Record<string, CanvasItemPatch>;
  } | null>(null);
  const activeSelectionBoxRef = useRef<{
    startClient: { x: number; y: number };
    additive: boolean;
    baseSelection: string[];
  } | null>(null);
  const activeAnnotationSessionRef = useRef<{
    mode: DoodleMode;
    draftStroke: AnnotationStroke | null;
    annotations: AnnotationStroke[];
    lastPoint: { x: number; y: number };
    changed: boolean;
  } | null>(null);
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);
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
    onAnnotationsChangeRef.current = onAnnotationsChange;
  }, [onAnnotationsChange]);

  useEffect(() => {
    onCanvasSizePreviewChangeRef.current = onCanvasSizePreviewChange;
  }, [onCanvasSizePreviewChange]);

  useEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== "doodle") {
      hideDoodleCursor();
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [activeTool]);

  useEffect(() => {
    snapEnabledRef.current = snapEnabled;
  }, [snapEnabled]);

  useEffect(() => {
    doodleModeRef.current = doodleMode;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [doodleMode]);

  useEffect(() => {
    doodleColorRef.current = doodleColor;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [doodleColor]);

  useEffect(() => {
    doodleSizeRef.current = doodleSize;
    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [doodleSize]);

  const hideDoodleCursor = useCallback(() => {
    const cursorOverlay = cursorOverlayRef.current;
    if (!cursorOverlay) {
      return;
    }

    cursorOverlay.style.opacity = "0";
  }, []);

  const hideSelectionMarquee = useCallback(() => {
    const marquee = selectionMarqueeRef.current;
    if (!marquee) {
      return;
    }

    marquee.style.opacity = "0";
    marquee.style.transform = "translate(-9999px, -9999px)";
    marquee.style.width = "0px";
    marquee.style.height = "0px";
  }, []);

  const updateDoodleCursor = useCallback((clientX: number, clientY: number) => {
    lastPointerClientRef.current = { x: clientX, y: clientY };

    const host = hostRef.current;
    const cursorOverlay = cursorOverlayRef.current;
    const boardContainer = boardContainerRef.current;
    if (!host || !cursorOverlay || !boardContainer) {
      return;
    }

    if (activeToolRef.current !== "doodle") {
      cursorOverlay.style.opacity = "0";
      return;
    }

    const rect = host.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      cursorOverlay.style.opacity = "0";
      return;
    }

    const size = Math.max(10, doodleSizeRef.current * boardContainer.scale.x);
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const erasing =
      doodleModeRef.current === "erase-line" ||
      doodleModeRef.current === "erase-pixel";

    cursorOverlay.style.width = `${size}px`;
    cursorOverlay.style.height = `${size}px`;
    cursorOverlay.style.transform = `translate(${localX - size * 0.5}px, ${localY - size * 0.5}px)`;
    cursorOverlay.style.borderColor = erasing ? "rgba(255, 255, 255, 0.88)" : doodleColorRef.current;
    cursorOverlay.style.background = erasing
      ? "rgba(255, 255, 255, 0.08)"
      : hexToRgba(doodleColorRef.current, 0.12);
    cursorOverlay.style.boxShadow = erasing
      ? "0 0 0 1px rgba(0, 0, 0, 0.38), inset 0 0 0 1px rgba(255, 255, 255, 0.08)"
      : `0 0 0 1px rgba(0, 0, 0, 0.36), inset 0 0 0 1px ${hexToRgba(
          doodleColorRef.current,
          0.22,
        )}`;
    cursorOverlay.style.opacity = "1";
  }, []);

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

  const stopCaptureSession = useCallback((captureId: string) => {
    const session = captureSessionByIdRef.current.get(captureId);
    if (!session) {
      return;
    }

    captureSessionByIdRef.current.delete(captureId);
    session.stream.getTracks().forEach((track) => track.stop());
    session.texture.destroy(true);
    session.video.pause();
    session.video.srcObject = null;
  }, []);

  const ensureCaptureSession = useCallback(async (item: CaptureItem) => {
    const existing = captureSessionByIdRef.current.get(item.id);
    if (
      existing &&
      existing.sourceId === item.sourceId &&
      existing.quality === item.quality
    ) {
      return existing;
    }

    if (existing) {
      stopCaptureSession(item.id);
    }

    const profile = CAPTURE_QUALITY_PROFILES[item.quality];
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: item.sourceId,
          minWidth: 640,
          maxWidth: profile.width,
          minHeight: 360,
          maxHeight: profile.height,
          minFrameRate: profile.frameRate,
          maxFrameRate: profile.frameRate,
        },
      } as MediaTrackConstraints,
    } as MediaStreamConstraints);

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();

    const texture = Texture.from(video);
    const session = {
      sourceId: item.sourceId,
      quality: item.quality,
      stream,
      video,
      texture,
    };
    captureSessionByIdRef.current.set(item.id, session);
    return session;
  }, [stopCaptureSession]);

  const redrawAnnotations = useCallback((annotations = groupRef.current.annotations) => {
    const annotationLayer = annotationLayerRef.current;
    if (!annotationLayer) {
      return;
    }

    annotationLayer.clear();
    annotations.forEach((stroke) => drawAnnotationStroke(annotationLayer, stroke));
  }, []);

  const redrawDraftAnnotation = useCallback((stroke: AnnotationStroke | null) => {
    const annotationLayer = annotationLayerRef.current;
    const previewLayer = annotationPreviewLayerRef.current;
    if (!annotationLayer || !previewLayer) {
      return;
    }

    redrawAnnotations(groupRef.current.annotations);
    previewLayer.clear();
    if (stroke) {
      drawAnnotationStroke(annotationLayer, stroke);
    }
  }, [redrawAnnotations]);

  const clientPointToCanvas = useCallback((clientX: number, clientY: number) => {
    const host = hostRef.current;
    const boardContainer = boardContainerRef.current;
    if (!host || !boardContainer) {
      return null;
    }

    const rect = host.getBoundingClientRect();
    const scene = groupRef.current;
    const rawX =
      (clientX - rect.left - boardContainer.x) / boardContainer.scale.x;
    const rawY =
      (clientY - rect.top - boardContainer.y) / boardContainer.scale.y;

    return {
      x: clamp(rawX, 0, scene.canvasSize.width),
      y: clamp(rawY, 0, scene.canvasSize.height),
      insideCanvas:
        rawX >= 0 &&
        rawX <= scene.canvasSize.width &&
        rawY >= 0 &&
        rawY <= scene.canvasSize.height,
    };
  }, []);

  const clientPointToWorld = useCallback((clientX: number, clientY: number) => {
    const host = hostRef.current;
    const boardContainer = boardContainerRef.current;
    if (!host || !boardContainer) {
      return null;
    }

    const rect = host.getBoundingClientRect();
    return {
      x: (clientX - rect.left - boardContainer.x) / boardContainer.scale.x,
      y: (clientY - rect.top - boardContainer.y) / boardContainer.scale.y,
    };
  }, []);

  const updateSelectionMarquee = useCallback(
    (clientX: number, clientY: number) => {
      const marquee = selectionMarqueeRef.current;
      const host = hostRef.current;
      const selectionBox = activeSelectionBoxRef.current;
      if (!marquee || !host || !selectionBox) {
        return;
      }

      const hostRect = host.getBoundingClientRect();
      const startLeft = selectionBox.startClient.x - hostRect.left;
      const startTop = selectionBox.startClient.y - hostRect.top;
      const currentLeft = clientX - hostRect.left;
      const currentTop = clientY - hostRect.top;

      const left = Math.min(startLeft, currentLeft);
      const top = Math.min(startTop, currentTop);
      const width = Math.abs(currentLeft - startLeft);
      const height = Math.abs(currentTop - startTop);

      marquee.style.opacity = width > 0 || height > 0 ? "1" : "0";
      marquee.style.transform = `translate(${left}px, ${top}px)`;
      marquee.style.width = `${width}px`;
      marquee.style.height = `${height}px`;

      const startWorld = clientPointToWorld(
        selectionBox.startClient.x,
        selectionBox.startClient.y,
      );
      const endWorld = clientPointToWorld(clientX, clientY);
      if (!startWorld || !endWorld) {
        return;
      }

      const minX = Math.min(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const maxY = Math.max(startWorld.y, endWorld.y);

      const hitIds = groupRef.current.items
        .filter((item) => item.visible)
        .filter(
          (item) =>
            item.x < maxX &&
            item.x + item.width > minX &&
            item.y < maxY &&
            item.y + item.height > minY,
        )
        .map((item) => item.id);

      const nextSelection = selectionBox.additive
        ? Array.from(new Set([...selectionBox.baseSelection, ...hitIds]))
        : hitIds;

      selectionIdsRef.current = nextSelection;
      onSelectionChangeRef.current(nextSelection);
    },
    [clientPointToWorld],
  );

  const finalizeAnnotationSession = useCallback(
    (session: NonNullable<typeof activeAnnotationSessionRef.current>) => {
      activeAnnotationSessionRef.current = null;
      redrawDraftAnnotation(null);

      if (session.mode === "brush" && session.draftStroke) {
        const nextAnnotations = [
          ...groupRef.current.annotations,
          session.draftStroke,
        ];
        redrawAnnotations(nextAnnotations);
        onAnnotationsChangeRef.current(nextAnnotations);
        return;
      }

      if (session.changed) {
        redrawAnnotations(session.annotations);
        onAnnotationsChangeRef.current(session.annotations);
        return;
      }

      redrawAnnotations(groupRef.current.annotations);
    },
    [redrawAnnotations, redrawDraftAnnotation],
  );

  const startAnnotationSession = useCallback((clientX: number, clientY: number) => {
    const point = clientPointToCanvas(clientX, clientY);
    if (!point || !point.insideCanvas) {
      return;
    }

    if (selectionIdsRef.current.length > 0) {
      selectionIdsRef.current = [];
      onSelectionChangeRef.current([]);
    }

    const mode = doodleModeRef.current;

    if (mode === "brush") {
      const draftStroke: AnnotationStroke = {
        id: crypto.randomUUID(),
        points: [point.x, point.y],
        color: doodleColorRef.current,
        size: doodleSizeRef.current,
        tool: "brush",
        createdAt: new Date().toISOString(),
      };

      activeAnnotationSessionRef.current = {
        mode,
        draftStroke,
        annotations: groupRef.current.annotations,
        lastPoint: point,
        changed: false,
      };
      redrawDraftAnnotation(draftStroke);
      return;
    }

    const nextAnnotations =
      mode === "erase-line"
        ? eraseWholeStrokesAtPoint(
            groupRef.current.annotations,
            point,
            doodleSizeRef.current,
          )
        : eraseStrokePixelsAtPointFromAnnotations(
            groupRef.current.annotations,
            point,
            doodleSizeRef.current,
          );

    activeAnnotationSessionRef.current = {
      mode,
      draftStroke: null,
      annotations: nextAnnotations,
      lastPoint: point,
      changed: nextAnnotations !== groupRef.current.annotations,
    };
    redrawAnnotations(nextAnnotations);
    redrawDraftAnnotation(null);
  }, [clientPointToCanvas, redrawAnnotations, redrawDraftAnnotation]);

  const updateAnnotationSession = useCallback((clientX: number, clientY: number) => {
    const session = activeAnnotationSessionRef.current;
    if (!session) {
      return;
    }

    const point = clientPointToCanvas(clientX, clientY);
    if (!point) {
      return;
    }

    if (!point.insideCanvas) {
      if (
        session.mode === "brush" &&
        session.draftStroke &&
        distanceBetween(session.lastPoint, point) >= MIN_STROKE_POINT_DISTANCE
      ) {
        session.draftStroke = {
          ...session.draftStroke,
          points: [...session.draftStroke.points, point.x, point.y],
        };
      }
      finalizeAnnotationSession(session);
      return;
    }

    if (distanceBetween(session.lastPoint, point) < MIN_STROKE_POINT_DISTANCE) {
      return;
    }

    session.lastPoint = point;

    if (session.mode === "brush" && session.draftStroke) {
      session.draftStroke = {
        ...session.draftStroke,
        points: [...session.draftStroke.points, point.x, point.y],
      };
      redrawDraftAnnotation(session.draftStroke);
      return;
    }

    const nextAnnotations =
      session.mode === "erase-line"
        ? eraseWholeStrokesAtPoint(session.annotations, point, doodleSizeRef.current)
        : eraseStrokePixelsAtPointFromAnnotations(
            session.annotations,
            point,
            doodleSizeRef.current,
          );

    if (nextAnnotations === session.annotations) {
      return;
    }

    session.annotations = nextAnnotations;
    session.changed = true;
    redrawAnnotations(nextAnnotations);
  }, [clientPointToCanvas, finalizeAnnotationSession, redrawAnnotations, redrawDraftAnnotation]);

  const commitAnnotationSession = useCallback(() => {
    const session = activeAnnotationSessionRef.current;
    if (!session) {
      return;
    }
    finalizeAnnotationSession(session);
  }, [finalizeAnnotationSession]);

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
    let translateX = deltaX;
    let translateY = deltaY;

    const dragBounds = activeDrag.items.reduce(
      (acc, item) => ({
        minX: Math.min(acc.minX, item.startPos.x + translateX),
        minY: Math.min(acc.minY, item.startPos.y + translateY),
        maxX: Math.max(acc.maxX, item.startPos.x + translateX + item.width),
        maxY: Math.max(acc.maxY, item.startPos.y + translateY + item.height),
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      },
    );

    let snappedOnX = false;
    let snappedOnY = false;

    if (snapEnabledRef.current) {
      const selectedSet = new Set(activeDrag.items.map((item) => item.itemId));
      const candidateRects = groupRef.current.items.filter(
        (item) => !selectedSet.has(item.id) && item.visible,
      );

      let snappedTranslateX = translateX;
      let snappedTranslateY = translateY;
      let bestSnapX = SNAP_THRESHOLD + 1;
      let bestSnapY = SNAP_THRESHOLD + 1;

      candidateRects.forEach((item) => {
        const itemRight = item.x + item.width;
        const itemBottom = item.y + item.height;

        const horizontalCandidates = [
          { delta: Math.abs(dragBounds.minX - item.x), value: item.x - dragBounds.minX + translateX },
          {
            delta: Math.abs(dragBounds.minX - (itemRight + SNAP_GAP)),
            value: itemRight + SNAP_GAP - dragBounds.minX + translateX,
          },
          {
            delta: Math.abs(dragBounds.maxX - (item.x - SNAP_GAP)),
            value: item.x - SNAP_GAP - dragBounds.maxX + translateX,
          },
          {
            delta: Math.abs(dragBounds.maxX - itemRight),
            value: itemRight - dragBounds.maxX + translateX,
          },
        ];

        const verticalCandidates = [
          { delta: Math.abs(dragBounds.minY - item.y), value: item.y - dragBounds.minY + translateY },
          {
            delta: Math.abs(dragBounds.minY - (itemBottom + SNAP_GAP)),
            value: itemBottom + SNAP_GAP - dragBounds.minY + translateY,
          },
          {
            delta: Math.abs(dragBounds.maxY - (item.y - SNAP_GAP)),
            value: item.y - SNAP_GAP - dragBounds.maxY + translateY,
          },
          {
            delta: Math.abs(dragBounds.maxY - itemBottom),
            value: itemBottom - dragBounds.maxY + translateY,
          },
        ];

        horizontalCandidates.forEach((candidate) => {
          if (candidate.delta < bestSnapX && candidate.delta <= SNAP_THRESHOLD) {
            bestSnapX = candidate.delta;
            snappedTranslateX = candidate.value;
            snappedOnX = true;
          }
        });

        verticalCandidates.forEach((candidate) => {
          if (candidate.delta < bestSnapY && candidate.delta <= SNAP_THRESHOLD) {
            bestSnapY = candidate.delta;
            snappedTranslateY = candidate.value;
            snappedOnY = true;
          }
        });
      });

      translateX = snappedTranslateX;
      translateY = snappedTranslateY;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    activeDrag.items.forEach((item) => {
      const resolvedX = snappedOnX
        ? Math.round(item.startPos.x + translateX)
        : item.startPos.x + translateX;
      const resolvedY = snappedOnY
        ? Math.round(item.startPos.y + translateY)
        : item.startPos.y + translateY;

      item.itemNode.position.set(resolvedX, resolvedY);
      activeDrag.patchBuffer[item.itemId] = {
        ...activeDrag.patchBuffer[item.itemId],
        x: Math.round(resolvedX),
        y: Math.round(resolvedY),
      };

      minX = Math.min(minX, resolvedX);
      minY = Math.min(minY, resolvedY);
      maxX = Math.max(maxX, resolvedX + item.width);
      maxY = Math.max(maxY, resolvedY + item.height);
    });

    setPreviewInsets({
      left: minX < 0 ? Math.ceil(-minX + BOARD_EXPANSION_PADDING) : 0,
      top: minY < 0 ? Math.ceil(-minY + BOARD_EXPANSION_PADDING) : 0,
      right:
        maxX > groupRef.current.canvasSize.width
          ? Math.ceil(
              maxX - groupRef.current.canvasSize.width + BOARD_EXPANSION_PADDING,
            )
          : 0,
      bottom:
        maxY > groupRef.current.canvasSize.height
          ? Math.ceil(
              maxY - groupRef.current.canvasSize.height + BOARD_EXPANSION_PADDING,
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
      itemNode.cursor = doodleActive ? "none" : item.locked ? "default" : "move";
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

      if (item.type === "capture") {
        const showCaptureFallback = (message: string) => {
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

            showCaptureFallback(
              error instanceof Error &&
                error.message.toLowerCase().includes("permission")
                ? "Screen recording permission required"
                : "Capture preview unavailable",
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
        const visibleColors = paletteColors.slice(0, 10);
        const chipWidth = 18;
        const chipHeight = 18;
        const chipGap = 2;
        const stripPadding = 5;
        const stripWidth =
          visibleColors.length * chipWidth +
          Math.max(0, visibleColors.length - 1) * chipGap;
        const stripX = 12;
        const stripY = safeHeight - chipHeight - 12;

        const tray = new Graphics();
        tray.roundRect(
          stripX - stripPadding,
          stripY - stripPadding,
          stripWidth + stripPadding * 2,
          chipHeight + stripPadding * 2,
          7,
        );
        tray.fill({ color: 0x111111, alpha: 0.72 });
        tray.stroke({
          color: 0xffffff,
          width: 1,
          alpha: 0.16,
        });
        itemNode.addChild(tray);

        visibleColors.forEach((colorHex, index) => {
          const swatch = new Graphics();
          swatch.roundRect(
            stripX + index * (chipWidth + chipGap),
            stripY,
            chipWidth,
            chipHeight,
            2,
          );
          swatch.fill(hexToPixiColor(colorHex));
          swatch.stroke({
            color: 0xffffff,
            width: 1,
            alpha: 0.18,
          });
          itemNode.addChild(swatch);
        });
      }

      itemNode.on("pointerdown", (event: FederatedPointerEvent) => {
        event.stopPropagation();

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

        if (item.locked) {
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
          .filter(
            (
              entry,
            ): entry is {
              itemId: string;
              itemNode: Container;
              startPos: { x: number; y: number };
              width: number;
              height: number;
            } => entry !== null,
          );

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
        };

        const highestZIndex = groupRef.current.items.reduce(
          (acc, entry) => Math.max(acc, entry.zIndex),
          -1,
        );
        const activeDrag = activeItemDragRef.current;
        if (!activeDrag) {
          return;
        }

        dragItems.forEach((dragItem, index) => {
          activeDrag.patchBuffer[dragItem.itemId] = {
            zIndex: highestZIndex + index + 1,
          };
          activeDrag.itemLayer.addChild(dragItem.itemNode);
        });
      });

      itemLayer.addChild(itemNode);
    });

    redrawAnnotations(scene.annotations);

    board.on("pointerdown", (event: FederatedPointerEvent) => {
      event.stopPropagation();

      if (activeToolRef.current === "doodle") {
        startAnnotationSession(
          event.nativeEvent.clientX,
          event.nativeEvent.clientY,
        );
        return;
      }

      if (
        event.nativeEvent.altKey ||
        event.nativeEvent.button === 1
      ) {
        isPanningRef.current = true;
        panStartRef.current = {
          x: event.nativeEvent.clientX,
          y: event.nativeEvent.clientY,
        };
        panOriginRef.current = { x: boardContainer.x, y: boardContainer.y };
        board.cursor = "grabbing";
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
    drawBoardSurface,
    hideSelectionMarquee,
    redrawAnnotations,
    startAnnotationSession,
    syncViewFromGroup,
  ]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;
    const onPointerLeave = () => {
      hideDoodleCursor();
    };

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

      const annotationLayer = new Graphics();
      annotationLayer.eventMode = "none";
      boardContainer.addChild(annotationLayer);
      annotationLayerRef.current = annotationLayer;

      const annotationPreviewLayer = new Graphics();
      annotationPreviewLayer.eventMode = "none";
      boardContainer.addChild(annotationPreviewLayer);
      annotationPreviewLayerRef.current = annotationPreviewLayer;

      const onPointerMove = (event: PointerEvent) => {
        updateDoodleCursor(event.clientX, event.clientY);

        if (activeAnnotationSessionRef.current) {
          updateAnnotationSession(event.clientX, event.clientY);
          return;
        }

        if (activeSelectionBoxRef.current) {
          updateSelectionMarquee(event.clientX, event.clientY);
          return;
        }

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

      const onPointerUp = (event: PointerEvent) => {
        if (activeAnnotationSessionRef.current) {
          commitAnnotationSession();
        }

        if (activeSelectionBoxRef.current) {
          const selectionBox = activeSelectionBoxRef.current;
          const movedDistance = Math.hypot(
            event.clientX - selectionBox.startClient.x,
            event.clientY - selectionBox.startClient.y,
          );

          if (
            movedDistance < MARQUEE_DRAG_THRESHOLD &&
            !selectionBox.additive
          ) {
            selectionIdsRef.current = [];
            onSelectionChangeRef.current([]);
          }

          activeSelectionBoxRef.current = null;
          hideSelectionMarquee();
        }

        if (activeItemDragRef.current) {
          commitDraggedItemPatch();
        }

        if (!isPanningRef.current) {
          return;
        }

        isPanningRef.current = false;
        if (boardGraphicRef.current) {
          boardGraphicRef.current.cursor =
            activeToolRef.current === "doodle" ? "none" : "grab";
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
      host.addEventListener("pointerleave", onPointerLeave);
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
      host.removeEventListener("pointerleave", onPointerLeave);
      activeItemDragRef.current = null;
      host.replaceChildren();
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
      boardContainerRef.current = null;
      boardGraphicRef.current = null;
      gridGraphicRef.current = null;
      itemLayerRef.current = null;
      annotationLayerRef.current = null;
      annotationPreviewLayerRef.current = null;
      frameByIdRef.current.clear();
      frameMetaByIdRef.current.clear();
      captureSessionByIdRef.current.forEach((_, captureId) => {
        stopCaptureSession(captureId);
      });
    };
  }, [
    commitAnnotationSession,
    commitDraggedItemPatch,
    commitView,
    hideDoodleCursor,
    rebuildScene,
    scheduleViewCommit,
    stopCaptureSession,
    updateAnnotationSession,
    updateDoodleCursor,
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
    activeTool,
    rebuildScene,
  ]);

  useEffect(() => {
    const activeCaptureIds = new Set(
      group.items
        .filter((item): item is CaptureItem => item.type === "capture")
        .map((item) => item.id),
    );

    captureSessionByIdRef.current.forEach((_, captureId) => {
      if (!activeCaptureIds.has(captureId)) {
        stopCaptureSession(captureId);
      }
    });
  }, [group.id, group.items, stopCaptureSession]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    redrawAnnotations(group.annotations);
  }, [appReady, group.annotations, redrawAnnotations]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const lastPointer = lastPointerClientRef.current;
    if (lastPointer) {
      updateDoodleCursor(lastPointer.x, lastPointer.y);
    }
  }, [appReady, group.zoom, updateDoodleCursor]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    if (
      isPanningRef.current ||
      activeItemDragRef.current ||
      activeAnnotationSessionRef.current ||
      activeSelectionBoxRef.current
    ) {
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
        style={{
          filter: boardFilter,
          cursor: activeTool === "doodle" ? "none" : "default",
        }}
      />
      <div className="canvas-selection-marquee" ref={selectionMarqueeRef} />
      <div className="canvas-cursor-overlay" ref={cursorOverlayRef} />
    </div>
  );
};
