import { Graphics } from "pixi.js";
import type { AnnotationStroke } from "@shared/types/project";
import { distanceBetween, distanceToSegment } from "@renderer/pixi/utils/geometry";

export const drawAnnotationStroke = (
  graphics: Graphics,
  stroke: AnnotationStroke,
) => {
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

export const strokeTouchesPoint = (
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

export const eraseWholeStrokesAtPoint = (
  annotations: AnnotationStroke[],
  point: { x: number; y: number },
  radius: number,
) => {
  const nextAnnotations = annotations.filter(
    (stroke) => !strokeTouchesPoint(stroke, point, radius),
  );

  return nextAnnotations.length === annotations.length ? annotations : nextAnnotations;
};

export const eraseStrokePixelsAtPoint = (
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

export const eraseStrokePixelsAtPointFromAnnotations = (
  annotations: AnnotationStroke[],
  point: { x: number; y: number },
  radius: number,
) => {
  let changed = false;
  const nextAnnotations = annotations.flatMap((stroke) => {
    const nextStrokes = eraseStrokePixelsAtPoint(stroke, point, radius);
    if (nextStrokes.length !== 1 || nextStrokes[0] !== stroke) {
      changed = true;
    }
    return nextStrokes;
  });

  return changed ? nextAnnotations : annotations;
};
