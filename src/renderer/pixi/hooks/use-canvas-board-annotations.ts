import { useCallback, type MutableRefObject } from "react";
import type { Graphics } from "pixi.js";
import type { AnnotationStroke, ReferenceGroup } from "@shared/types/project";
import { MIN_STROKE_POINT_DISTANCE } from "@renderer/pixi/constants";
import {
  drawAnnotationStroke,
  eraseStrokePixelsAtPointFromAnnotations,
  eraseWholeStrokesAtPoint,
} from "@renderer/pixi/utils/annotations";
import { distanceBetween } from "@renderer/pixi/utils/geometry";
import type { ActiveAnnotationSessionState } from "@renderer/pixi/types";
import type { DoodleMode } from "@renderer/features/tools/types";
import {
  isPenPointerType,
  resolvePointerPressure,
  type NormalizedPointerData,
} from "@renderer/pixi/utils/pointer";

interface CanvasPoint {
  x: number;
  y: number;
  insideCanvas: boolean;
}

const BRUSH_SMOOTHING_MIN_ALPHA = 0.42;
const BRUSH_SMOOTHING_MAX_ALPHA = 0.88;
const BRUSH_PRESSURE_SMOOTHING = 0.42;

const lerp = (start: number, end: number, alpha: number) =>
  start + (end - start) * alpha;

const getBrushPositionAlpha = (distance: number) =>
  Math.min(
    BRUSH_SMOOTHING_MAX_ALPHA,
    Math.max(BRUSH_SMOOTHING_MIN_ALPHA, distance / 10),
  );

interface UseCanvasBoardAnnotationsOptions {
  annotationLayerRef: MutableRefObject<Graphics | null>;
  annotationPreviewLayerRef: MutableRefObject<Graphics | null>;
  groupRef: MutableRefObject<ReferenceGroup>;
  selectionIdsRef: MutableRefObject<string[]>;
  onSelectionChangeRef: MutableRefObject<(itemIds: string[]) => void>;
  onAnnotationsChangeRef: MutableRefObject<
    (annotations: AnnotationStroke[]) => void
  >;
  activeAnnotationSessionRef: MutableRefObject<ActiveAnnotationSessionState | null>;
  doodleModeRef: MutableRefObject<DoodleMode>;
  doodleColorRef: MutableRefObject<string>;
  doodleSizeRef: MutableRefObject<number>;
  clientPointToCanvas: (clientX: number, clientY: number) => CanvasPoint | null;
}

export const useCanvasBoardAnnotations = ({
  annotationLayerRef,
  annotationPreviewLayerRef,
  groupRef,
  selectionIdsRef,
  onSelectionChangeRef,
  onAnnotationsChangeRef,
  activeAnnotationSessionRef,
  doodleModeRef,
  doodleColorRef,
  doodleSizeRef,
  clientPointToCanvas,
}: UseCanvasBoardAnnotationsOptions) => {
  const clearDraftAnnotation = useCallback(() => {
    annotationPreviewLayerRef.current?.clear();
  }, [annotationPreviewLayerRef]);

  const redrawAnnotations = useCallback(
    (annotations = groupRef.current.annotations) => {
      const annotationLayer = annotationLayerRef.current;
      if (!annotationLayer) {
        return;
      }

      annotationLayer.clear();
      annotations.forEach((stroke) =>
        drawAnnotationStroke(annotationLayer, stroke),
      );
    },
    [annotationLayerRef, groupRef],
  );

  const redrawDraftAnnotation = useCallback(
    (stroke: AnnotationStroke | null) => {
      const previewLayer = annotationPreviewLayerRef.current;
      if (!previewLayer) {
        return;
      }

      previewLayer.clear();
      if (stroke) {
        drawAnnotationStroke(previewLayer, stroke);
      }
    },
    [annotationPreviewLayerRef],
  );

  const appendDraftAnnotation = useCallback(
    (stroke: AnnotationStroke, renderedPointCount: number) => {
      const previewLayer = annotationPreviewLayerRef.current;
      if (!previewLayer) {
        return;
      }

      drawAnnotationStroke(previewLayer, stroke, renderedPointCount);
    },
    [annotationPreviewLayerRef],
  );

  const commitBrushDraftStroke = useCallback(
    (session: ActiveAnnotationSessionState) => {
      if (session.mode !== "brush" || !session.draftStroke) {
        return session;
      }

      const committedStroke: AnnotationStroke = {
        ...session.draftStroke,
        points: [...session.draftStroke.points],
        ...(session.draftStroke.pressures
          ? { pressures: [...session.draftStroke.pressures] }
          : {}),
      };

      return {
        ...session,
        annotations: [...session.annotations, committedStroke],
        draftStroke: null,
        draftRenderedPointCount: 0,
        changed: true,
      };
    },
    [],
  );

  const finalizeAnnotationSession = useCallback(
    (session: ActiveAnnotationSessionState) => {
      const committedSession = commitBrushDraftStroke(session);
      activeAnnotationSessionRef.current = null;
      clearDraftAnnotation();

      if (committedSession.changed) {
        redrawAnnotations(committedSession.annotations);
        onAnnotationsChangeRef.current(committedSession.annotations);
        return;
      }

      redrawAnnotations(groupRef.current.annotations);
    },
    [
      activeAnnotationSessionRef,
      clearDraftAnnotation,
      groupRef,
      onAnnotationsChangeRef,
      redrawAnnotations,
    ],
  );

  const appendBrushPoint = useCallback(
    (
      session: ActiveAnnotationSessionState,
      point: { x: number; y: number },
      pressure: number,
    ) => {
      if (session.mode !== "brush" || !session.draftStroke) {
        return false;
      }

      const inputDistance = distanceBetween(session.lastInputPoint, point);
      if (inputDistance < MIN_STROKE_POINT_DISTANCE) {
        return false;
      }

      const positionAlpha = getBrushPositionAlpha(inputDistance);
      const nextPressure = lerp(
        session.lastPressure,
        pressure,
        BRUSH_PRESSURE_SMOOTHING,
      );
      const nextPoint = {
        x: lerp(session.lastPoint.x, point.x, positionAlpha),
        y: lerp(session.lastPoint.y, point.y, positionAlpha),
      };

      session.lastInputPoint = point;
      session.lastPoint = nextPoint;
      session.lastPressure = nextPressure;
      session.draftStroke.points.push(nextPoint.x, nextPoint.y);
      session.draftStroke.pressures?.push(nextPressure);
      appendDraftAnnotation(session.draftStroke, session.draftRenderedPointCount);
      session.draftRenderedPointCount = Math.floor(
        session.draftStroke.points.length / 2,
      );
      return true;
    },
    [appendDraftAnnotation],
  );

  const startAnnotationSession = useCallback(
    (
      pointer: Pick<
        NormalizedPointerData,
        "clientX" | "clientY" | "pointerId" | "pointerType" | "pressure"
      >,
    ) => {
      const point = clientPointToCanvas(pointer.clientX, pointer.clientY);
      if (!point || !point.insideCanvas) {
        return;
      }

      if (selectionIdsRef.current.length > 0) {
        selectionIdsRef.current = [];
        onSelectionChangeRef.current([]);
      }

      const mode = doodleModeRef.current;
      const pressure = resolvePointerPressure(pointer.pointerType, pointer.pressure);

      if (mode === "brush") {
        const draftStroke: AnnotationStroke = {
          id: crypto.randomUUID(),
          points: [point.x, point.y],
          ...(isPenPointerType(pointer.pointerType) ? { pressures: [pressure] } : {}),
          color: doodleColorRef.current,
          size: doodleSizeRef.current,
          tool: "brush",
          createdAt: new Date().toISOString(),
        };

        activeAnnotationSessionRef.current = {
          pointerId: pointer.pointerId,
          mode,
          draftStroke,
          draftRenderedPointCount: 1,
          annotations: groupRef.current.annotations,
          lastPoint: point,
          lastInputPoint: point,
          lastPressure: pressure,
          changed: false,
          outsideCanvas: false,
        };
        redrawDraftAnnotation(draftStroke);
        return;
      }

      const nextAnnotations =
        mode === "erase-line"
          ? eraseWholeStrokesAtPoint(
              groupRef.current.annotations,
              point,
              doodleSizeRef.current * pressure,
            )
          : eraseStrokePixelsAtPointFromAnnotations(
              groupRef.current.annotations,
              point,
              doodleSizeRef.current * pressure,
            );

        activeAnnotationSessionRef.current = {
          pointerId: pointer.pointerId,
          mode,
          draftStroke: null,
          draftRenderedPointCount: 0,
          annotations: nextAnnotations,
          lastPoint: point,
          lastInputPoint: point,
        lastPressure: pressure,
        changed: nextAnnotations !== groupRef.current.annotations,
        outsideCanvas: false,
      };
      redrawAnnotations(nextAnnotations);
      redrawDraftAnnotation(null);
    },
    [
      activeAnnotationSessionRef,
      clientPointToCanvas,
      doodleColorRef,
      doodleModeRef,
      doodleSizeRef,
      groupRef,
      onSelectionChangeRef,
      redrawAnnotations,
      redrawDraftAnnotation,
      selectionIdsRef,
    ],
  );

  const updateAnnotationSession = useCallback(
    (
      pointer: Pick<
        NormalizedPointerData,
        "clientX" | "clientY" | "pointerId" | "pointerType" | "pressure"
      >,
    ) => {
      const session = activeAnnotationSessionRef.current;
      if (!session || session.pointerId !== pointer.pointerId) {
        return;
      }

      const point = clientPointToCanvas(pointer.clientX, pointer.clientY);
      if (!point) {
        return;
      }

      const pressure = resolvePointerPressure(pointer.pointerType, pointer.pressure);

      if (!point.insideCanvas) {
        if (session.mode === "brush") {
          if (!session.outsideCanvas) {
            appendBrushPoint(session, point, pressure);
          }

          const nextSession = commitBrushDraftStroke(session);
          nextSession.outsideCanvas = true;
          activeAnnotationSessionRef.current = nextSession;
          redrawAnnotations(nextSession.annotations);
          clearDraftAnnotation();
        } else {
          session.outsideCanvas = true;
        }
        return;
      }

      if (session.outsideCanvas) {
        session.outsideCanvas = false;
        session.lastPoint = point;
        session.lastInputPoint = point;
        session.lastPressure = pressure;

        if (session.mode === "brush") {
          session.draftStroke = {
            id: crypto.randomUUID(),
            points: [point.x, point.y],
            ...(isPenPointerType(pointer.pointerType) ? { pressures: [pressure] } : {}),
            color: doodleColorRef.current,
            size: doodleSizeRef.current,
            tool: "brush",
            createdAt: new Date().toISOString(),
          };
          session.draftRenderedPointCount = 1;
          redrawDraftAnnotation(session.draftStroke);
          return;
        }
      }

      if (session.mode === "brush" && session.draftStroke) {
        appendBrushPoint(session, point, pressure);
        return;
      }

      if (
        distanceBetween(session.lastInputPoint, point) < MIN_STROKE_POINT_DISTANCE
      ) {
        return;
      }

      session.lastInputPoint = point;
      session.lastPoint = point;
      session.lastPressure = pressure;

      const nextAnnotations =
        session.mode === "erase-line"
          ? eraseWholeStrokesAtPoint(
              session.annotations,
              point,
              doodleSizeRef.current * pressure,
            )
          : eraseStrokePixelsAtPointFromAnnotations(
              session.annotations,
              point,
              doodleSizeRef.current * pressure,
            );

      if (nextAnnotations === session.annotations) {
        return;
      }

      session.annotations = nextAnnotations;
      session.changed = true;
      redrawAnnotations(nextAnnotations);
    },
    [
      activeAnnotationSessionRef,
      appendBrushPoint,
      clientPointToCanvas,
      clearDraftAnnotation,
      doodleSizeRef,
      finalizeAnnotationSession,
      redrawAnnotations,
      redrawDraftAnnotation,
    ],
  );

  const commitAnnotationSession = useCallback(() => {
    const session = activeAnnotationSessionRef.current;
    if (!session) {
      return;
    }
    finalizeAnnotationSession(session);
  }, [activeAnnotationSessionRef, finalizeAnnotationSession]);

  const cancelAnnotationSession = useCallback(() => {
    activeAnnotationSessionRef.current = null;
    clearDraftAnnotation();
  }, [activeAnnotationSessionRef, clearDraftAnnotation]);

  return {
    redrawAnnotations,
    startAnnotationSession,
    updateAnnotationSession,
    commitAnnotationSession,
    cancelAnnotationSession,
  };
};
