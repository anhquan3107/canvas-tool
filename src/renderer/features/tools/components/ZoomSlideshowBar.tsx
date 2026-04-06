interface ZoomSlideshowBarProps {
  visible: boolean;
  slideshowPlaying: boolean;
  slideshowSeconds: number;
  onPrevious: () => void;
  onNext: () => void;
  onToggleSlideshow: () => void;
  onSlideshowSecondsChange: (seconds: number) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const ZoomSlideshowBar = ({
  visible,
  slideshowPlaying,
  slideshowSeconds,
  onPrevious,
  onNext,
  onToggleSlideshow,
  onSlideshowSecondsChange,
  onMouseEnter,
  onMouseLeave,
}: ZoomSlideshowBarProps) => (
  <div
    className={`zoom-slideshow-bar ${visible ? "visible" : ""}`}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
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
);
