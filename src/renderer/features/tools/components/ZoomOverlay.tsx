import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { ImageItem } from "@shared/types/project";
import type { RulerGridSettings } from "@renderer/features/tools/types";

interface ZoomOverlayProps {
  items: ImageItem[];
  activeImageId: string;
  rulerEnabled: boolean;
  rulerDialogOpen: boolean;
  rulerSettings: RulerGridSettings;
  draftRulerSettings: RulerGridSettings;
  filterStyle?: string;
  showBlurControl: boolean;
  blurAmount: number;
  slideshowPlaying: boolean;
  slideshowSeconds: number;
  onBlurChange: (blur: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleSlideshow: () => void;
  onSlideshowSecondsChange: (seconds: number) => void;
  onDraftRulerSettingsChange: (settings: RulerGridSettings) => void;
  onApplyRulerSettings: (settings: RulerGridSettings) => void;
  onCancelRuler: () => void;
  onClose: () => void;
}

const GRID_COLOR_OPTIONS = [
  { label: "Red", value: "#d24b43" },
  { label: "Green", value: "#5fb46b" },
  { label: "Blue", value: "#4e81d8" },
  { label: "Cyan", value: "#47c7cf" },
  { label: "White", value: "#f3f1e9" },
  { label: "Black", value: "#121212" },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampPanToBounds = (
  nextPan: { x: number; y: number },
  viewport: { width: number; height: number },
  image: { width: number; height: number },
) => {
  const overflowX = Math.max(0, (image.width - viewport.width) * 0.5);
  const overflowY = Math.max(0, (image.height - viewport.height) * 0.5);

  return {
    x: clamp(nextPan.x, -overflowX, overflowX),
    y: clamp(nextPan.y, -overflowY, overflowY),
  };
};

export const ZoomOverlay = ({
  items,
  activeImageId,
  rulerEnabled,
  rulerDialogOpen,
  rulerSettings,
  draftRulerSettings,
  filterStyle,
  showBlurControl,
  blurAmount,
  slideshowPlaying,
  slideshowSeconds,
  onBlurChange,
  onPrevious,
  onNext,
  onToggleSlideshow,
  onSlideshowSecondsChange,
  onDraftRulerSettingsChange,
  onApplyRulerSettings,
  onCancelRuler,
  onClose,
}: ZoomOverlayProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [slideshowBarVisible, setSlideshowBarVisible] = useState(false);

  const activeImage = useMemo(
    () => items.find((item) => item.id === activeImageId) ?? null,
    [activeImageId, items],
  );

  const sourceWidth = Math.max(
    1,
    Math.round(activeImage?.originalWidth ?? activeImage?.width ?? 1),
  );
  const sourceHeight = Math.max(
    1,
    Math.round(activeImage?.originalHeight ?? activeImage?.height ?? 1),
  );
  const cropX = Math.max(
    0,
    Math.min(sourceWidth - 1, Math.round(activeImage?.cropX ?? 0)),
  );
  const cropY = Math.max(
    0,
    Math.min(sourceHeight - 1, Math.round(activeImage?.cropY ?? 0)),
  );
  const cropWidth = Math.max(
    1,
    Math.min(sourceWidth - cropX, Math.round(activeImage?.cropWidth ?? sourceWidth)),
  );
  const cropHeight = Math.max(
    1,
    Math.min(sourceHeight - cropY, Math.round(activeImage?.cropHeight ?? sourceHeight)),
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateSize = () => {
      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!activeImage || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    const widthFitScale = viewportSize.width / cropWidth;
    const heightFitScale = viewportSize.height / cropHeight;
    const preferredFitScale =
      cropWidth >= cropHeight ? widthFitScale : heightFitScale;
    const containFitScale = Math.min(widthFitScale, heightFitScale);
    const nextFitScale = Math.min(preferredFitScale, containFitScale);

    setFitScale(nextFitScale);
    setScale(nextFitScale);
    setPan({ x: 0, y: 0 });
  }, [activeImage, cropHeight, cropWidth, viewportSize.height, viewportSize.width]);

  if (!activeImage || !activeImage.assetPath) {
    return null;
  }

  const maxScale = Math.max(fitScale * 20, fitScale);
  const gridSettings =
    rulerEnabled && rulerDialogOpen ? draftRulerSettings : rulerSettings;
  const canPan = scale > fitScale + 0.001;

  const clampPanForScale = useCallback(
    (nextPan: { x: number; y: number }, nextScale: number) => {
      if (viewportSize.width <= 0 || viewportSize.height <= 0) {
        return nextPan;
      }

      if (nextScale <= fitScale + 0.001) {
        return { x: 0, y: 0 };
      }

      return clampPanToBounds(nextPan, viewportSize, {
        width: cropWidth * nextScale,
        height: cropHeight * nextScale,
      });
    },
    [cropHeight, cropWidth, fitScale, viewportSize],
  );

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    setScale((previous) => {
      const nextScale = clamp(
        previous * Math.exp(-event.deltaY * 0.0015),
        fitScale,
        maxScale,
      );

      setPan((previousPan) => clampPanForScale(previousPan, nextScale));
      return nextScale;
    });
  };

  const handlePointerDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!canPan) {
      return;
    }

    event.preventDefault();
    setIsPanning(true);
    setPanOrigin({
      x: event.clientX - pan.x,
      y: event.clientY - pan.y,
    });
  };

  const handlePointerMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (viewport && !rulerEnabled) {
      const rect = viewport.getBoundingClientRect();
      const centerX = rect.width * 0.5 + pan.x;
      const centerY = rect.height * 0.5 + pan.y;
      const displayWidth = cropWidth * scale;
      const displayHeight = cropHeight * scale;
      const imageLeft = centerX - displayWidth * 0.5;
      const imageRight = centerX + displayWidth * 0.5;
      const imageBottom = centerY + displayHeight * 0.5;
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const inBottomBand =
        pointerX >= imageLeft - 36 &&
        pointerX <= imageRight + 36 &&
        pointerY >= imageBottom - 180 &&
        pointerY <= imageBottom + 56;
      setSlideshowBarVisible(inBottomBand);
    }

    if (!isPanning) {
      return;
    }

    event.preventDefault();
    setPan(
      clampPanForScale(
        {
          x: event.clientX - panOrigin.x,
          y: event.clientY - panOrigin.y,
        },
        scale,
      ),
    );
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    setPan((previousPan) => clampPanForScale(previousPan, scale));
  }, [clampPanForScale, scale]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.code !== "Space") {
        return;
      }

      event.preventDefault();
      setSpacePanActive(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      setSpacePanActive(false);
      setIsPanning(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const stageStyle = {
    width: `${cropWidth}px`,
    height: `${cropHeight}px`,
    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
  };

  const imageStyle = {
    width: `${sourceWidth}px`,
    height: `${sourceHeight}px`,
    transform: `translate(${-cropX}px, ${-cropY}px)`,
    ...(filterStyle ? { filter: filterStyle } : {}),
  };

  return (
    <div className="zoom-overlay">
      <div
        ref={viewportRef}
        className="zoom-overlay-viewport"
        onWheel={handleWheel}
        onMouseDown={(event) => {
          const canStartPan =
            event.button === 1 || (spacePanActive && event.button === 0);

          if (!canStartPan) {
            return;
          }

          handlePointerDown(event);
        }}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => {
          handlePointerUp();
          setSpacePanActive(false);
          setSlideshowBarVisible(false);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="zoom-overlay-stage" style={stageStyle}>
          <img
            className="zoom-overlay-image"
            src={activeImage.assetPath}
            alt={activeImage.label ?? "Focused canvas image"}
            draggable={false}
            style={imageStyle}
          />

          {rulerEnabled ? (
            <svg
              className="zoom-overlay-grid"
              viewBox={`0 0 ${cropWidth} ${cropHeight}`}
              preserveAspectRatio="none"
            >
              {Array.from({ length: Math.max(0, gridSettings.verticalLines - 1) }).map(
                (_, index) => {
                  const x = (cropWidth / gridSettings.verticalLines) * (index + 1);
                  return (
                    <line
                      key={`v-${index}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={cropHeight}
                      stroke={gridSettings.gridColor}
                      strokeWidth={1}
                      strokeOpacity={0.82}
                    />
                  );
                },
              )}
              {Array.from({
                length: Math.max(0, gridSettings.horizontalLines - 1),
              }).map((_, index) => {
                const y =
                  (cropHeight / gridSettings.horizontalLines) * (index + 1);
                return (
                  <line
                    key={`h-${index}`}
                    x1={0}
                    y1={y}
                    x2={cropWidth}
                    y2={y}
                    stroke={gridSettings.gridColor}
                    strokeWidth={1}
                    strokeOpacity={0.82}
                  />
                );
              })}
            </svg>
          ) : null}
        </div>
      </div>

      {showBlurControl ? (
        <div className="zoom-overlay-blur-bar">
          <label htmlFor="zoom-overlay-blur-range">Blur</label>
          <input
            id="zoom-overlay-blur-range"
            type="range"
            min={0}
            max={32}
            value={blurAmount}
            onChange={(event) => onBlurChange(Number(event.target.value))}
          />
          <span>{blurAmount}</span>
        </div>
      ) : null}

      {!rulerEnabled ? (
        <div
          className="zoom-slideshow-hotspot"
          onMouseEnter={() => setSlideshowBarVisible(true)}
          onMouseLeave={() => setSlideshowBarVisible(false)}
        />
      ) : null}

      {rulerEnabled && rulerDialogOpen ? (
        <div
          className="zoom-ruler-panel"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="zoom-ruler-header">
            <div>
              <strong>Ruler Grid</strong>
              <p>Shape a composition grid directly on the focused image.</p>
            </div>
          </div>

          <label className="zoom-ruler-field">
            <span>Horizontal Lines</span>
            <div className="zoom-ruler-slider-row">
              <input
                type="range"
                min={2}
                max={18}
                value={draftRulerSettings.horizontalLines}
                onChange={(event) =>
                  onDraftRulerSettingsChange({
                    ...draftRulerSettings,
                    horizontalLines: Number(event.target.value),
                  })
                }
              />
              <strong>{draftRulerSettings.horizontalLines}</strong>
            </div>
          </label>

          <label className="zoom-ruler-field">
            <span>Vertical Lines</span>
            <div className="zoom-ruler-slider-row">
              <input
                type="range"
                min={2}
                max={18}
                value={draftRulerSettings.verticalLines}
                onChange={(event) =>
                  onDraftRulerSettingsChange({
                    ...draftRulerSettings,
                    verticalLines: Number(event.target.value),
                  })
                }
              />
              <strong>{draftRulerSettings.verticalLines}</strong>
            </div>
          </label>

          <fieldset className="zoom-ruler-colors">
            <legend>Grid Color</legend>
            <div className="zoom-ruler-color-list">
              {GRID_COLOR_OPTIONS.map((option) => (
                <label key={option.value} className="zoom-ruler-color-option">
                  <input
                    type="radio"
                    name="zoom-ruler-grid-color"
                    checked={draftRulerSettings.gridColor === option.value}
                    onChange={() =>
                      onDraftRulerSettingsChange({
                        ...draftRulerSettings,
                        gridColor: option.value,
                      })
                    }
                  />
                  <span
                    className="zoom-ruler-color-dot"
                    style={{ backgroundColor: option.value }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="zoom-ruler-actions">
            <button
              type="button"
              onClick={() => onApplyRulerSettings(draftRulerSettings)}
            >
              Apply
            </button>
            <button type="button" onClick={onCancelRuler}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`zoom-slideshow-bar ${slideshowBarVisible ? "visible" : ""}`}
          onMouseEnter={() => setSlideshowBarVisible(true)}
          onMouseLeave={() => setSlideshowBarVisible(false)}
        >
          <button type="button" onClick={onPrevious}>
            ⏮
          </button>
          <button type="button" onClick={onToggleSlideshow}>
            {slideshowPlaying ? "⏸" : "▶"}
          </button>
          <button type="button" onClick={onNext}>
            ⏭
          </button>

          <label className="zoom-slideshow-timer">
            <span>{slideshowSeconds}s</span>
            <input
              type="range"
              min={1}
              max={12}
              value={slideshowSeconds}
              onChange={(event) =>
                onSlideshowSecondsChange(Number(event.target.value))
              }
            />
          </label>
        </div>
      )}

      <div className="zoom-overlay-hint">
        Scroll to zoom • Hold Space and drag to pan • ESC to close
      </div>
    </div>
  );
};
