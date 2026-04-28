import { useMemo } from "react";
import type { ImageItem } from "@shared/types/project";
import type { RulerGridSettings } from "@renderer/features/tools/types";
import { ZoomRulerPanel } from "@renderer/features/tools/components/ZoomRulerPanel";
import { ZoomSlideshowBar } from "@renderer/features/tools/components/ZoomSlideshowBar";
import { ZoomViewport } from "@renderer/features/tools/components/ZoomViewport";
import { useZoomViewport } from "@renderer/features/tools/hooks/use-zoom-viewport";
import { useI18n } from "@renderer/i18n";

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
  const { copy } = useI18n();
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

  const gridSettings =
    rulerEnabled && rulerDialogOpen ? draftRulerSettings : rulerSettings;

  const {
    viewportRef,
    stageStyle,
    imageStyle,
    viewportCursor,
    slideshowBarVisible,
    setSlideshowBarVisible,
    setSlideshowBarHovering,
    handleWheel,
    handlePointerMove,
    handlePointerUp,
    handleViewportMouseDown,
    handleViewportMouseLeave,
    handleViewportDoubleClick,
  } = useZoomViewport({
    activeImageId,
    cropWidth,
    cropHeight,
    cropX,
    cropY,
    sourceWidth,
    sourceHeight,
    filterStyle,
    rulerEnabled,
    slideshowSeconds,
    onClose,
  });

  if (!activeImage || !activeImage.assetPath) {
    return null;
  }

  return (
    <div className="zoom-overlay">
      <ZoomViewport
        viewportRef={viewportRef}
        activeImagePath={activeImage.assetPath}
        activeImageLabel={activeImage.label}
        cropWidth={cropWidth}
        cropHeight={cropHeight}
        rulerEnabled={rulerEnabled}
        gridSettings={gridSettings}
        stageStyle={stageStyle}
        imageStyle={imageStyle}
        viewportCursor={viewportCursor}
        onWheel={handleWheel}
        onMouseDown={handleViewportMouseDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handleViewportMouseLeave}
        onDoubleClick={handleViewportDoubleClick}
      />

      {showBlurControl ? (
        <div className="zoom-overlay-blur-bar">
          <label htmlFor="zoom-overlay-blur-range">{copy.zoom.blur}</label>
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
          onMouseLeave={() => {
            setSlideshowBarHovering(false);
            setSlideshowBarVisible(false);
          }}
        />
      ) : null}

      {rulerEnabled && rulerDialogOpen ? (
        <ZoomRulerPanel
          draftRulerSettings={draftRulerSettings}
          onDraftRulerSettingsChange={onDraftRulerSettingsChange}
          onApplyRulerSettings={onApplyRulerSettings}
          onCancelRuler={onCancelRuler}
        />
      ) : (
        <ZoomSlideshowBar
          visible={slideshowBarVisible}
          slideshowPlaying={slideshowPlaying}
          slideshowSeconds={slideshowSeconds}
          onPrevious={onPrevious}
          onNext={onNext}
          onToggleSlideshow={onToggleSlideshow}
          onSlideshowSecondsChange={onSlideshowSecondsChange}
          onMouseEnter={() => {
            setSlideshowBarHovering(true);
            setSlideshowBarVisible(true);
          }}
          onMouseLeave={() => {
            setSlideshowBarHovering(false);
            setSlideshowBarVisible(false);
          }}
        />
      )}

      <div className="zoom-overlay-hint">
        {copy.zoom.hint}
      </div>
    </div>
  );
};
