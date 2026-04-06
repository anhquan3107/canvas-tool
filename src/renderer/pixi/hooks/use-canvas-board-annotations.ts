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
import type { NormalizedPointerData } from "@renderer/pixi/utils/pointer";
import { resolvePointerPressure } from "@renderer/pixi/utils/pointer";

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
      const annotationLayer = annotationLayerRef.current;
      const previewLayer = annotationPreviewLayerRef.current;
      if (!annotationLayer || !previewLayer) {
        return;
      }

      previewLayer.clear();
      if (stroke) {
        drawAnnotationStroke(previewLayer, stroke);
      }
    },
    [annotationLayerRef, annotationPreviewLayerRef],
  );

  const commitBrushDraftStroke = useCallback(
    (session: ActiveAnnotationSessionState) => {
      if (session.mode !== "brush" || !session.draftStroke) {
        return session;
      }

      return {
        ...session,
        annotations: [...session.annotations, session.draftStroke],
        draftStroke: null,
        changed: true,
      };
    },
    [],
  );

  const finalizeAnnotationSession = useCallback(
    (session: ActiveAnnotationSessionState) => {
      const committedSession = commitBrushDraftStroke(session);
      activeAnnotationSessionRef.current = null;
      redrawDraftAnnotation(null);

      if (committedSession.changed) {
        redrawAnnotations(committedSession.annotations);
        onAnnotationsChangeRef.current(committedSession.annotations);
        return;
      }

      redrawAnnotations(groupRef.current.annotations);
    },
    [
      activeAnnotationSessionRef,
      groupRef,
      onAnnotationsChangeRef,
      redrawAnnotations,
      redrawDraftAnnotation,
    ],
  );

  const startAnnotationSession = useCallback(
    (pointer: Pick<NormalizedPointerData, "clientX" | "clientY" | "pointerId" | "pointerType" | "pressure">) => {
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
          ...(pointer.pointerType === "pen" ? { pressures: [pressure] } : {}),
          color: doodleColorRef.current,
          size: doodleSizeRef.current,
          tool: "brush",
          createdAt: new Date().toISOString(),
        };

        activeAnnotationSessionRef.current = {
          pointerId: pointer.pointerId,
          mode,
          draftStroke,
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
          if (
            !session.outsideCanvas &&
            session.draftStroke &&
            distanceBetween(session.lastInputPoint, point) >= MIN_STROKE_POINT_DISTANCE
          ) {
            const positionAlpha = getBrushPositionAlpha(
              distanceBetween(session.lastInputPoint, point),
            );
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
            session.draftStroke = {
              ...session.draftStroke,
              points: [...session.draftStroke.points, nextPoint.x, nextPoint.y],
              ...(session.draftStroke.pressures
                ? { pressures: [...session.draftStroke.pressures, nextPressure] }
                : {}),
            };
          }

          const nextSession = commitBrushDraftStroke(session);
          nextSession.outsideCanvas = true;
          activeAnnotationSessionRef.current = nextSession;
          redrawAnnotations(nextSession.annotations);
          redrawDraftAnnotation(null);
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
            ...(pointer.pointerType === "pen" ? { pressures: [pressure] } : {}),
            color: doodleColorRef.current,
            size: doodleSizeRef.current,
            tool: "brush",
            createdAt: new Date().toISOString(),
          };
          redrawDraftAnnotation(session.draftStroke);
          return;
        }
      }

      if (
        distanceBetween(session.lastInputPoint, point) < MIN_STROKE_POINT_DISTANCE
      ) {
        return;
      }

      const positionAlpha = getBrushPositionAlpha(
        distanceBetween(session.lastInputPoint, point),
      );
      const nextPressure = lerp(
        session.lastPressure,
        pressure,
        BRUSH_PRESSURE_SMOOTHING,
      );
      const nextPoint =
        session.mode === "brush"
          ? {
              x: lerp(session.lastPoint.x, point.x, positionAlpha),
              y: lerp(session.lastPoint.y, point.y, positionAlpha),
            }
          : point;

      session.lastInputPoint = point;
      session.lastPoint = nextPoint;
      session.lastPressure = nextPressure;

      if (session.mode === "brush" && session.draftStroke) {
        session.draftStroke = {
          ...session.draftStroke,
          points: [...session.draftStroke.points, nextPoint.x, nextPoint.y],
          ...(session.draftStroke.pressures
            ? { pressures: [...session.draftStroke.pressures, nextPressure] }
            : {}),
        };
        redrawDraftAnnotation(session.draftStroke);
        return;
      }

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
      clientPointToCanvas,
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
    redrawDraftAnnotation(null);
  }, [activeAnnotationSessionRef, redrawDraftAnnotation]);

  return {
    redrawAnnotations,
    startAnnotationSession,
    updateAnnotationSession,
    commitAnnotationSession,
    cancelAnnotationSession,
  };
};
