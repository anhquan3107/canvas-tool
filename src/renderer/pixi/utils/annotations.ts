import { Graphics } from "pixi.js";
import type { AnnotationStroke } from "@shared/types/project";
import { distanceBetween, distanceToSegment } from "@renderer/pixi/utils/geometry";

const getPointCount = (stroke: AnnotationStroke) => Math.floor(stroke.points.length / 2);

const getPointPressure = (stroke: AnnotationStroke, pointIndex: number) =>
  stroke.pressures?.[pointIndex] ?? 1;

const getPointSize = (stroke: AnnotationStroke, pointIndex: number) =>
  stroke.size * getPointPressure(stroke, pointIndex);

export const drawAnnotationStroke = (
  graphics: Graphics,
  stroke: AnnotationStroke,
) => {
  const pointCount = getPointCount(stroke);
  if (pointCount === 0) {
    return;
  }

  if (pointCount === 1) {
    graphics.circle(stroke.points[0], stroke.points[1], getPointSize(stroke, 0) * 0.5);
    graphics.fill({ color: stroke.color, alpha: 1 });
    return;
  }

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const offset = pointIndex * 2;
    graphics.circle(
      stroke.points[offset],
      stroke.points[offset + 1],
      getPointSize(stroke, pointIndex) * 0.5,
    );
    graphics.fill({ color: stroke.color, alpha: 1 });
  }

  for (let pointIndex = 0; pointIndex < pointCount - 1; pointIndex += 1) {
    const startOffset = pointIndex * 2;
    const endOffset = startOffset + 2;
    graphics.moveTo(stroke.points[startOffset], stroke.points[startOffset + 1]);
    graphics.lineTo(stroke.points[endOffset], stroke.points[endOffset + 1]);
    graphics.stroke({
      color: stroke.color,
      width: (getPointSize(stroke, pointIndex) + getPointSize(stroke, pointIndex + 1)) * 0.5,
      alpha: 1,
      cap: "round",
      join: "round",
    });
  }
};

export const strokeTouchesPoint = (
  stroke: AnnotationStroke,
  point: { x: number; y: number },
  radius: number,
) => {
  const pointCount = getPointCount(stroke);
  if (pointCount === 0) {
    return false;
  }

  if (pointCount === 1) {
    return (
      distanceBetween(point, { x: stroke.points[0], y: stroke.points[1] }) <=
      radius + getPointSize(stroke, 0) * 0.5
    );
  }

  for (let pointIndex = 0; pointIndex < pointCount - 1; pointIndex += 1) {
    const startOffset = pointIndex * 2;
    const endOffset = startOffset + 2;
    if (
      distanceToSegment(
        point,
        { x: stroke.points[startOffset], y: stroke.points[startOffset + 1] },
        { x: stroke.points[endOffset], y: stroke.points[endOffset + 1] },
      ) <= radius + Math.max(getPointSize(stroke, pointIndex), getPointSize(stroke, pointIndex + 1)) * 0.5
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
  const nextSegments: Array<{ points: number[]; pressures?: number[] }> = [];
  let currentSegmentPoints: number[] = [];
  let currentSegmentPressures: number[] | undefined = stroke.pressures ? [] : undefined;

  for (let pointIndex = 0; pointIndex < getPointCount(stroke); pointIndex += 1) {
    const offset = pointIndex * 2;
    const x = stroke.points[offset];
    const y = stroke.points[offset + 1];
    const pointPressure = getPointPressure(stroke, pointIndex);
    const pointSize = stroke.size * pointPressure;
    const shouldErase =
      distanceBetween(point, { x, y }) <= radius + pointSize * 0.5;

    if (shouldErase) {
      if (currentSegmentPoints.length >= 2) {
        nextSegments.push({
          points: currentSegmentPoints,
          ...(currentSegmentPressures ? { pressures: currentSegmentPressures } : {}),
        });
      }
      currentSegmentPoints = [];
      currentSegmentPressures = stroke.pressures ? [] : undefined;
      continue;
    }

    currentSegmentPoints.push(x, y);
    currentSegmentPressures?.push(pointPressure);
  }

  if (currentSegmentPoints.length >= 2) {
    nextSegments.push({
      points: currentSegmentPoints,
      ...(currentSegmentPressures ? { pressures: currentSegmentPressures } : {}),
    });
  }

  if (nextSegments.length === 0) {
    return [];
  }

  if (
    nextSegments.length === 1 &&
    nextSegments[0].points.length === stroke.points.length
  ) {
    return [stroke];
  }

  return nextSegments.map((segment, index) => ({
    ...stroke,
    id: index === 0 ? stroke.id : crypto.randomUUID(),
    points: segment.points,
    pressures: segment.pressures,
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
