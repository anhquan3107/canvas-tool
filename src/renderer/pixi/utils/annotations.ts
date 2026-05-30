import { Graphics } from "pixi.js";
import type { AnnotationStroke } from "@shared/types/project";
import { distanceBetween, distanceToSegment } from "@renderer/pixi/utils/geometry";

type Point = { x: number; y: number };
type StrokeSample = { point: Point; pressure: number; inside: boolean; original: boolean };
type StrokeSegment = { points: number[]; pressures?: number[] };

const PIXEL_ERASER_SAMPLE_SPACING = 2.5;

export interface AnnotationStrokeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const getPointCount = (stroke: AnnotationStroke) => Math.floor(stroke.points.length / 2);

const getPointPressure = (stroke: AnnotationStroke, pointIndex: number) =>
  stroke.pressures?.[pointIndex] ?? 1;

const getPointSize = (stroke: AnnotationStroke, pointIndex: number) =>
  stroke.size * getPointPressure(stroke, pointIndex);

const getRenderedPointSize = (stroke: AnnotationStroke, pointIndex: number) =>
  getPointSize(stroke, pointIndex);

export const getAnnotationStrokeBounds = (
  stroke: AnnotationStroke,
): AnnotationStrokeBounds => {
  const pointCount = getPointCount(stroke);
  if (pointCount === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = stroke.points[0];
  let minY = stroke.points[1];
  let maxX = stroke.points[0];
  let maxY = stroke.points[1];

  for (let pointIndex = 1; pointIndex < pointCount; pointIndex += 1) {
    const offset = pointIndex * 2;
    const x = stroke.points[offset];
    const y = stroke.points[offset + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY };
};

export const drawAnnotationStroke = (
  graphics: Graphics,
  stroke: AnnotationStroke,
  startPointIndex = 0,
) => {
  const pointCount = getPointCount(stroke);
  if (pointCount === 0 || startPointIndex >= pointCount) {
    return;
  }

  if (pointCount === 1) {
    if (startPointIndex === 0) {
      graphics.circle(
        stroke.points[0],
        stroke.points[1],
        getPointSize(stroke, 0) * 0.5,
      );
      graphics.fill({ color: stroke.color, alpha: 1 });
    }
    return;
  }

  const segmentStartIndex = Math.max(
    0,
    Math.min(pointCount - 2, startPointIndex > 0 ? startPointIndex - 1 : 0),
  );

  for (
    let pointIndex = segmentStartIndex;
    pointIndex < pointCount - 1;
    pointIndex += 1
  ) {
    const startOffset = pointIndex * 2;
    const endOffset = startOffset + 2;
    const startX = stroke.points[startOffset];
    const startY = stroke.points[startOffset + 1];
    const endX = stroke.points[endOffset];
    const endY = stroke.points[endOffset + 1];
    const startSize = getRenderedPointSize(stroke, pointIndex);
    const endSize = getRenderedPointSize(stroke, pointIndex + 1);
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.stroke({
      color: stroke.color,
      width: Math.max(0.01, (startSize + endSize) * 0.5),
      alpha: 1,
      cap: "round",
      join: "round",
    });
  }
};

const strokeTouchesPoint = (
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

const getDistanceToErasePath = (
  point: Point,
  start: Point,
  end: Point,
  startRadius: number,
  endRadius: number,
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return {
      distance: distanceBetween(point, start),
      radius: Math.max(startRadius, endRadius),
    };
  }

  const t = Math.min(
    1,
    Math.max(
      0,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        (dx * dx + dy * dy),
    ),
  );

  return {
    distance: Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t)),
    radius: startRadius + (endRadius - startRadius) * t,
  };
};

const pointInsideErasePath = (
  point: Point,
  start: Point,
  end: Point,
  startRadius: number,
  endRadius: number,
) => {
  const { distance, radius } = getDistanceToErasePath(
    point,
    start,
    end,
    startRadius,
    endRadius,
  );

  return distance <= radius;
};

const getCrossProduct = (origin: Point, first: Point, second: Point) =>
  (first.x - origin.x) * (second.y - origin.y) -
  (first.y - origin.y) * (second.x - origin.x);

const isBetween = (value: number, start: number, end: number) =>
  value >= Math.min(start, end) && value <= Math.max(start, end);

const pointOnSegment = (point: Point, start: Point, end: Point) =>
  Math.abs(getCrossProduct(start, end, point)) < 0.0001 &&
  isBetween(point.x, start.x, end.x) &&
  isBetween(point.y, start.y, end.y);

const segmentsIntersect = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  const firstCrossStart = getCrossProduct(firstStart, firstEnd, secondStart);
  const firstCrossEnd = getCrossProduct(firstStart, firstEnd, secondEnd);
  const secondCrossStart = getCrossProduct(secondStart, secondEnd, firstStart);
  const secondCrossEnd = getCrossProduct(secondStart, secondEnd, firstEnd);

  if (
    ((firstCrossStart > 0 && firstCrossEnd < 0) ||
      (firstCrossStart < 0 && firstCrossEnd > 0)) &&
    ((secondCrossStart > 0 && secondCrossEnd < 0) ||
      (secondCrossStart < 0 && secondCrossEnd > 0))
  ) {
    return true;
  }

  return (
    pointOnSegment(secondStart, firstStart, firstEnd) ||
    pointOnSegment(secondEnd, firstStart, firstEnd) ||
    pointOnSegment(firstStart, secondStart, secondEnd) ||
    pointOnSegment(firstEnd, secondStart, secondEnd)
  );
};

const distanceBetweenSegments = (
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) => {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
    return 0;
  }

  return Math.min(
    distanceToSegment(firstStart, secondStart, secondEnd),
    distanceToSegment(firstEnd, secondStart, secondEnd),
    distanceToSegment(secondStart, firstStart, firstEnd),
    distanceToSegment(secondEnd, firstStart, firstEnd),
  );
};

const strokeCouldTouchErasePath = (
  stroke: AnnotationStroke,
  start: Point,
  end: Point,
  startRadius: number,
  endRadius: number,
) => {
  const pointCount = getPointCount(stroke);
  if (pointCount === 0) {
    return false;
  }

  const maxRadius = Math.max(startRadius, endRadius);
  if (pointCount === 1) {
    return pointInsideErasePath(
      { x: stroke.points[0], y: stroke.points[1] },
      start,
      end,
      startRadius,
      endRadius,
    );
  }

  for (let pointIndex = 0; pointIndex < pointCount - 1; pointIndex += 1) {
    const startOffset = pointIndex * 2;
    const endOffset = startOffset + 2;
    if (
      distanceBetweenSegments(
        {
          x: stroke.points[startOffset],
          y: stroke.points[startOffset + 1],
        },
        {
          x: stroke.points[endOffset],
          y: stroke.points[endOffset + 1],
        },
        start,
        end,
      ) <= maxRadius
    ) {
      return true;
    }
  }

  return false;
};

const boundsCouldTouchErasePath = (
  bounds: AnnotationStrokeBounds,
  start: Point,
  end: Point,
  radius: number,
) =>
  bounds.maxX >= Math.min(start.x, end.x) - radius &&
  bounds.minX <= Math.max(start.x, end.x) + radius &&
  bounds.maxY >= Math.min(start.y, end.y) - radius &&
  bounds.minY <= Math.max(start.y, end.y) + radius;

const pushStrokeSample = (
  currentSegment: StrokeSegment,
  point: Point,
  pressure: number,
) => {
  const pointCount = Math.floor(currentSegment.points.length / 2);
  if (pointCount > 0) {
    const lastOffset = currentSegment.points.length - 2;
    if (
      distanceBetween(point, {
        x: currentSegment.points[lastOffset],
        y: currentSegment.points[lastOffset + 1],
      }) < 0.001
    ) {
      return currentSegment;
    }
  }

  currentSegment.points.push(point.x, point.y);
  currentSegment.pressures?.push(pressure);
  return currentSegment;
};

const closeStrokeSampleSegment = (
  segments: StrokeSegment[],
  currentSegment: StrokeSegment,
  hasPressure: boolean,
) => {
  if (currentSegment.points.length >= 2) {
    segments.push(currentSegment);
  }

  return {
    points: [],
    ...(hasPressure ? { pressures: [] } : {}),
  };
};

const interpolateStrokePoint = (
  start: Point,
  end: Point,
  startPressure: number,
  endPressure: number,
  t: number,
) => ({
  point: {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  },
  pressure: startPressure + (endPressure - startPressure) * t,
});

const getEraseBoundarySample = (
  outsideSample: StrokeSample,
  insideSample: StrokeSample,
  pathStart: Point,
  pathEnd: Point,
  pathStartRadius: number,
  pathEndRadius: number,
) => {
  let outsideT = 0;
  let insideT = 1;
  let boundary = outsideSample;

  for (let index = 0; index < 8; index += 1) {
    const midT = (outsideT + insideT) * 0.5;
    const sample = interpolateStrokePoint(
      outsideSample.point,
      insideSample.point,
      outsideSample.pressure,
      insideSample.pressure,
      midT,
    );

    if (
      pointInsideErasePath(
        sample.point,
        pathStart,
        pathEnd,
        pathStartRadius,
        pathEndRadius,
      )
    ) {
      insideT = midT;
    } else {
      outsideT = midT;
      boundary = {
        ...sample,
        inside: false,
        original: false,
      };
    }
  }

  return boundary;
};

const eraseStrokePixelsAlongSegment = (
  stroke: AnnotationStroke,
  start: Point,
  end: Point,
  startRadius: number,
  endRadius = startRadius,
) => {
  const pointCount = getPointCount(stroke);
  if (
    !strokeCouldTouchErasePath(stroke, start, end, startRadius, endRadius)
  ) {
    return [stroke];
  }

  const hasPressure = Boolean(stroke.pressures);
  const nextSegments: StrokeSegment[] = [];
  let changed = false;
  let currentSegment: StrokeSegment = {
    points: [],
    ...(hasPressure ? { pressures: [] } : {}),
  };

  const visitSample = (sample: Point, pressure: number) => {
    if (
      pointInsideErasePath(sample, start, end, startRadius, endRadius)
    ) {
      changed = true;
      currentSegment = closeStrokeSampleSegment(
        nextSegments,
        currentSegment,
        hasPressure,
      );
      return;
    }

    currentSegment = pushStrokeSample(currentSegment, sample, pressure);
  };

  if (pointCount === 1) {
    visitSample({ x: stroke.points[0], y: stroke.points[1] }, getPointPressure(stroke, 0));
  } else {
    for (let pointIndex = 0; pointIndex < pointCount - 1; pointIndex += 1) {
      const startOffset = pointIndex * 2;
      const endOffset = startOffset + 2;
      const segmentStart = {
        x: stroke.points[startOffset],
        y: stroke.points[startOffset + 1],
      };
      const segmentEnd = {
        x: stroke.points[endOffset],
        y: stroke.points[endOffset + 1],
      };
      const segmentStartPressure = getPointPressure(stroke, pointIndex);
      const segmentEndPressure = getPointPressure(stroke, pointIndex + 1);
      const segmentDistance = distanceBetween(segmentStart, segmentEnd);
      const sampleCount = Math.max(
        1,
        Math.ceil(segmentDistance / PIXEL_ERASER_SAMPLE_SPACING),
      );
      let previousSample: StrokeSample | null = null;

      for (
        let sampleIndex = 0;
        sampleIndex <= sampleCount;
        sampleIndex += 1
      ) {
        const t = sampleIndex / sampleCount;
        const { point, pressure } = interpolateStrokePoint(
          segmentStart,
          segmentEnd,
          segmentStartPressure,
          segmentEndPressure,
          t,
        );
        const sample: StrokeSample = {
          point,
          pressure,
          inside: pointInsideErasePath(
            point,
            start,
            end,
            startRadius,
            endRadius,
          ),
          original:
            (pointIndex === 0 && sampleIndex === 0) ||
            sampleIndex === sampleCount,
        };

        if (!previousSample) {
          if (!sample.inside && sample.original) {
            currentSegment = pushStrokeSample(
              currentSegment,
              sample.point,
              sample.pressure,
            );
          } else if (sample.inside) {
            changed = true;
          }
          previousSample = sample;
          continue;
        }

        if (!previousSample.inside && sample.inside) {
          const boundary = getEraseBoundarySample(
            previousSample,
            sample,
            start,
            end,
            startRadius,
            endRadius,
          );
          currentSegment = pushStrokeSample(
            currentSegment,
            boundary.point,
            boundary.pressure,
          );
          currentSegment = closeStrokeSampleSegment(
            nextSegments,
            currentSegment,
            hasPressure,
          );
          changed = true;
        } else if (previousSample.inside && !sample.inside) {
          const boundary = getEraseBoundarySample(
            sample,
            previousSample,
            start,
            end,
            startRadius,
            endRadius,
          );
          currentSegment = pushStrokeSample(
            currentSegment,
            boundary.point,
            boundary.pressure,
          );
          if (sample.original) {
            currentSegment = pushStrokeSample(
              currentSegment,
              sample.point,
              sample.pressure,
            );
          }
          changed = true;
        } else if (!sample.inside && sample.original) {
          currentSegment = pushStrokeSample(
            currentSegment,
            sample.point,
            sample.pressure,
          );
        } else if (sample.inside) {
          changed = true;
        }

        previousSample = sample;
      }
    }
  }

  closeStrokeSampleSegment(nextSegments, currentSegment, hasPressure);

  if (!changed) {
    return [stroke];
  }

  if (nextSegments.length === 0) {
    return [];
  }

  return nextSegments.map((segment, index) => ({
    ...stroke,
    id: index === 0 ? stroke.id : crypto.randomUUID(),
    points: segment.points,
    pressures: segment.pressures,
  }));
};

export const eraseStrokePixelsAlongSegmentFromAnnotations = (
  annotations: AnnotationStroke[],
  start: Point,
  end: Point,
  startRadius: number,
  endRadius = startRadius,
  boundsById?: Map<string, AnnotationStrokeBounds>,
) => {
  let changed = false;
  const nextAnnotations = annotations.flatMap((stroke) => {
    const bounds = boundsById?.get(stroke.id);
    if (
      bounds &&
      !boundsCouldTouchErasePath(bounds, start, end, Math.max(startRadius, endRadius))
    ) {
      return [stroke];
    }

    const nextStrokes = eraseStrokePixelsAlongSegment(
      stroke,
      start,
      end,
      startRadius,
      endRadius,
    );
    if (nextStrokes.length !== 1 || nextStrokes[0] !== stroke) {
      changed = true;
      boundsById?.delete(stroke.id);
      nextStrokes.forEach((nextStroke) => {
        boundsById?.set(nextStroke.id, getAnnotationStrokeBounds(nextStroke));
      });
    }
    return nextStrokes;
  });

  return changed ? nextAnnotations : annotations;
};
