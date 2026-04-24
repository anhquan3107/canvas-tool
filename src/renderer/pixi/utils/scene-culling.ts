import type { CanvasItem, ReferenceGroup } from "@shared/types/project";

export interface SceneCullBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const PREFETCH_VIEWPORT_MULTIPLIER = 0.75;
const MIN_PREFETCH_SCREEN_PX = 480;
const MAX_PREFETCH_SCREEN_PX = 1600;

const getSafeZoom = (zoom: number) =>
  Number.isFinite(zoom) && zoom > 0.001 ? zoom : 1;

const getSafeScale = (scale: number | undefined) =>
  typeof scale === "number" && Number.isFinite(scale) && scale !== 0
    ? Math.abs(scale)
    : 1;

const getPrefetchMarginInWorldUnits = (
  viewportSizePx: number,
  zoom: number,
) => {
  const screenMarginPx = Math.max(
    MIN_PREFETCH_SCREEN_PX,
    Math.min(MAX_PREFETCH_SCREEN_PX, viewportSizePx * PREFETCH_VIEWPORT_MULTIPLIER),
  );
  return screenMarginPx / getSafeZoom(zoom);
};

export const getSceneViewportBounds = (
  host: Pick<HTMLElement, "clientWidth" | "clientHeight">,
  scene: Pick<ReferenceGroup, "panX" | "panY" | "zoom">,
): SceneCullBounds => {
  const zoom = getSafeZoom(scene.zoom);

  return {
    minX: (-scene.panX) / zoom,
    minY: (-scene.panY) / zoom,
    maxX: (host.clientWidth - scene.panX) / zoom,
    maxY: (host.clientHeight - scene.panY) / zoom,
  };
};

export const getSceneCullBounds = (
  host: Pick<HTMLElement, "clientWidth" | "clientHeight">,
  scene: Pick<ReferenceGroup, "panX" | "panY" | "zoom">,
): SceneCullBounds => {
  const viewportBounds = getSceneViewportBounds(host, scene);
  const marginX = getPrefetchMarginInWorldUnits(host.clientWidth, scene.zoom);
  const marginY = getPrefetchMarginInWorldUnits(host.clientHeight, scene.zoom);

  return {
    minX: viewportBounds.minX - marginX,
    minY: viewportBounds.minY - marginY,
    maxX: viewportBounds.maxX + marginX,
    maxY: viewportBounds.maxY + marginY,
  };
};

export const isSceneViewportWithinCullBounds = (
  host: Pick<HTMLElement, "clientWidth" | "clientHeight">,
  scene: Pick<ReferenceGroup, "panX" | "panY" | "zoom">,
  bounds: SceneCullBounds | null,
) => {
  if (!bounds) {
    return false;
  }

  const viewportBounds = getSceneViewportBounds(host, scene);

  return (
    viewportBounds.minX >= bounds.minX &&
    viewportBounds.minY >= bounds.minY &&
    viewportBounds.maxX <= bounds.maxX &&
    viewportBounds.maxY <= bounds.maxY
  );
};

export const doesCanvasItemIntersectCullBounds = (
  item: Pick<
    CanvasItem,
    "x" | "y" | "width" | "height" | "scaleX" | "scaleY" | "rotation"
  >,
  bounds: SceneCullBounds,
) => {
  const scaledWidth = Math.max(1, item.width * getSafeScale(item.scaleX));
  const scaledHeight = Math.max(1, item.height * getSafeScale(item.scaleY));
  const centerX = item.x + scaledWidth * 0.5;
  const centerY = item.y + scaledHeight * 0.5;
  const rotation = Number.isFinite(item.rotation) ? item.rotation : 0;
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const halfWidth = (cos * scaledWidth + sin * scaledHeight) * 0.5;
  const halfHeight = (sin * scaledWidth + cos * scaledHeight) * 0.5;

  return !(
    centerX + halfWidth < bounds.minX ||
    centerX - halfWidth > bounds.maxX ||
    centerY + halfHeight < bounds.minY ||
    centerY - halfHeight > bounds.maxY
  );
};
