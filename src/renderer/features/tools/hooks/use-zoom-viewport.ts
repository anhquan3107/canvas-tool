import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

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

interface UseZoomViewportOptions {
  activeImageId: string;
  cropWidth: number;
  cropHeight: number;
  cropX: number;
  cropY: number;
  sourceWidth: number;
  sourceHeight: number;
  filterStyle?: string;
  rulerEnabled: boolean;
  slideshowSeconds: number;
  onClose: () => void;
}

export const useZoomViewport = ({
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
}: UseZoomViewportOptions) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panButtonMaskRef = useRef(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [slideshowBarVisible, setSlideshowBarVisible] = useState(false);
  const [slideshowBarHovering, setSlideshowBarHovering] = useState(false);
  const previousSlideshowSecondsRef = useRef(slideshowSeconds);

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
    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
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
  }, [activeImageId, cropHeight, cropWidth, viewportSize.height, viewportSize.width]);

  const maxScale = Math.max(fitScale * 20, fitScale);
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

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();

      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const viewportCenterX = rect.width * 0.5;
      const viewportCenterY = rect.height * 0.5;

      const nextScale = clamp(
        scale * Math.exp(-event.deltaY * 0.0015),
        fitScale,
        maxScale,
      );

      if (Math.abs(nextScale - scale) < 0.0001) {
        return;
      }

      const anchoredPan = {
        x:
          pointerX -
          viewportCenterX -
          ((pointerX - viewportCenterX - pan.x) / scale) * nextScale,
        y:
          pointerY -
          viewportCenterY -
          ((pointerY - viewportCenterY - pan.y) / scale) * nextScale,
      };

      setScale(nextScale);
      setPan(clampPanForScale(anchoredPan, nextScale));
    },
    [clampPanForScale, fitScale, maxScale, pan.x, pan.y, scale],
  );

  const handlePointerDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!canPan) {
        return;
      }

      event.preventDefault();
      panButtonMaskRef.current = event.button === 1 ? 4 : 1;
      setIsPanning(true);
      setPanOrigin({
        x: event.clientX - pan.x,
        y: event.clientY - pan.y,
      });
    },
    [canPan, pan.x, pan.y],
  );

  const handlePointerUp = useCallback(() => {
    panButtonMaskRef.current = 0;
    setIsPanning(false);
  }, []);

  const handlePointerMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
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

      if ((event.buttons & panButtonMaskRef.current) !== panButtonMaskRef.current) {
        handlePointerUp();
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
    },
    [
      clampPanForScale,
      cropHeight,
      cropWidth,
      handlePointerUp,
      isPanning,
      pan.x,
      pan.y,
      panOrigin.x,
      panOrigin.y,
      rulerEnabled,
      scale,
    ],
  );

  useEffect(() => {
    setPan((previousPan) => clampPanForScale(previousPan, scale));
  }, [clampPanForScale, scale]);

  useEffect(() => {
    if (rulerEnabled) {
      previousSlideshowSecondsRef.current = slideshowSeconds;
      return;
    }

    if (previousSlideshowSecondsRef.current === slideshowSeconds) {
      return;
    }

    previousSlideshowSecondsRef.current = slideshowSeconds;
    setSlideshowBarVisible(true);

    const timeoutId = window.setTimeout(() => {
      if (!slideshowBarHovering) {
        setSlideshowBarVisible(false);
      }
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [rulerEnabled, slideshowBarHovering, slideshowSeconds]);

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
      panButtonMaskRef.current = 0;
    };

    const handleWindowBlur = () => {
      setSpacePanActive(false);
      setIsPanning(false);
      panButtonMaskRef.current = 0;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
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

  return {
    viewportRef,
    stageStyle,
    imageStyle,
    slideshowBarVisible,
    setSlideshowBarVisible,
    setSlideshowBarHovering,
    handleWheel,
    handlePointerMove,
    handlePointerUp,
    handleViewportMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => {
      const canStartPan =
        event.button === 1 || (spacePanActive && event.button === 0);

      if (!canStartPan) {
        return;
      }

      handlePointerDown(event);
    },
    handleViewportMouseLeave: () => {
      setSlideshowBarVisible(false);
    },
    handleViewportDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      onClose();
    },
  };
};
