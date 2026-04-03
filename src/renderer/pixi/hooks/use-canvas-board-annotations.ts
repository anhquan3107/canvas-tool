import { useCallback, useRef, type MutableRefObject } from "react";
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

interface CanvasPoint {
  x: number;
  y: number;
  insideCanvas: boolean;
}

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
    (clientX: number, clientY: number) => {
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
    (clientX: number, clientY: number) => {
      const session = activeAnnotationSessionRef.current;
      if (!session) {
        return;
      }

      const point = clientPointToCanvas(clientX, clientY);
      if (!point) {
        return;
      }

      if (!point.insideCanvas) {
        if (session.mode === "brush") {
          if (
            !session.outsideCanvas &&
            session.draftStroke &&
            distanceBetween(session.lastPoint, point) >= MIN_STROKE_POINT_DISTANCE
          ) {
            session.lastPoint = point;
            session.draftStroke = {
              ...session.draftStroke,
              points: [...session.draftStroke.points, point.x, point.y],
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

        if (session.mode === "brush") {
          session.draftStroke = {
            id: crypto.randomUUID(),
            points: [point.x, point.y],
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
        distanceBetween(session.lastPoint, point) < MIN_STROKE_POINT_DISTANCE
      ) {
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
          ? eraseWholeStrokesAtPoint(
              session.annotations,
              point,
              doodleSizeRef.current,
            )
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
