import {
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { CanvasItem, ImageItem, ReferenceGroup } from "@shared/types/project";
import type { ImagePatch, ToastKind } from "@renderer/features/workspace/types";
import type { ImportPayload } from "@renderer/features/import/image-import";

const CLIPBOARD_MAX_RENDER_PIXELS = 24_000_000;

interface UseWorkspaceClipboardActionsOptions {
  activeGroup: ReferenceGroup | undefined;
  clipboardItems: CanvasItem[];
  selectedItemIds: string[];
  importFromPayload: (payload: ImportPayload) => Promise<void>;
  addGroupItems: (groupId: string, items: CanvasItem[]) => void;
  removeGroupItems: (groupId: string, itemIds: string[]) => void;
  patchGroupItems: (groupId: string, updates: Record<string, ImagePatch>) => void;
  flipItems: (groupId: string, itemIds: string[]) => void;
  setClipboardItems: Dispatch<SetStateAction<CanvasItem[]>>;
  setSelectedItemIds: Dispatch<SetStateAction<string[]>>;
  pushToast: (kind: ToastKind, message: string) => void;
  runHistoryBatch: (callback: () => void) => void;
  ensureCanvasFitsItems: (
    groupId: string,
    items: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      scaleX?: number;
      scaleY?: number;
      visible?: boolean;
    }>,
    currentSize: { width: number; height: number },
    currentView?: { zoom: number; panX: number; panY: number },
  ) => void;
}

const resolveClipboardImageSource = (assetPath: string) => {
  if (
    assetPath.startsWith("data:") ||
    assetPath.startsWith("blob:") ||
    assetPath.startsWith("http://") ||
    assetPath.startsWith("https://") ||
    assetPath.startsWith("file://")
  ) {
    return assetPath;
  }

  if (/^[a-zA-Z]:[\\/]/.test(assetPath)) {
    const normalized = assetPath.replace(/\\/g, "/");
    return `file:///${encodeURI(normalized)}`;
  }

  if (assetPath.startsWith("/")) {
    return `file://${encodeURI(assetPath)}`;
  }

  return assetPath;
};

const loadClipboardImage = (assetPath: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load clipboard image: ${assetPath}`));
    image.src = resolveClipboardImageSource(assetPath);
  });

const getItemRenderSize = (item: ImageItem) => ({
  width:
    Math.max(1, item.width) *
    Math.max(1e-3, Math.abs(item.scaleX) || 1),
  height:
    Math.max(1, item.height) *
    Math.max(1e-3, Math.abs(item.scaleY) || 1),
});

const getRotatedBounds = (item: ImageItem) => {
  const { width, height } = getItemRenderSize(item);
  const centerX = item.x + width * 0.5;
  const centerY = item.y + height * 0.5;
  const radians = (item.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map(({ x, y }) => ({
    x: centerX + x * cosine - y * sine,
    y: centerY + x * sine + y * cosine,
  }));

  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  };
};

const getImageSourceCrop = (item: ImageItem, image: HTMLImageElement) => {
  const sourceWidth = Math.max(
    1,
    Math.round(item.originalWidth ?? image.naturalWidth ?? image.width ?? 1),
  );
  const sourceHeight = Math.max(
    1,
    Math.round(item.originalHeight ?? image.naturalHeight ?? image.height ?? 1),
  );
  const cropX = Math.max(0, Math.min(sourceWidth - 1, Math.round(item.cropX ?? 0)));
  const cropY = Math.max(0, Math.min(sourceHeight - 1, Math.round(item.cropY ?? 0)));
  const cropWidth = Math.max(
    1,
    Math.min(sourceWidth - cropX, Math.round(item.cropWidth ?? sourceWidth)),
  );
  const cropHeight = Math.max(
    1,
    Math.min(sourceHeight - cropY, Math.round(item.cropHeight ?? sourceHeight)),
  );

  return {
    cropX,
    cropY,
    cropWidth,
    cropHeight,
  };
};

const renderClipboardSelectionDataUrl = async (items: ImageItem[]) => {
  const renderableItems = items.filter(
    (item): item is ImageItem & { assetPath: string } =>
      item.visible !== false &&
      typeof item.assetPath === "string" &&
      item.assetPath.length > 0,
  );

  if (renderableItems.length === 0) {
    return null;
  }

  const images = await Promise.all(
    renderableItems.map(async (item) => ({
      item,
      image: await loadClipboardImage(item.assetPath),
    })),
  ).catch(() => null);

  if (!images || images.length === 0) {
    return null;
  }

  const bounds = images.map(({ item }) => getRotatedBounds(item));
  const minX = Math.min(...bounds.map((bound) => bound.minX));
  const minY = Math.min(...bounds.map((bound) => bound.minY));
  const maxX = Math.max(...bounds.map((bound) => bound.maxX));
  const maxY = Math.max(...bounds.map((bound) => bound.maxY));
  const width = Math.max(1, Math.ceil(maxX - minX));
  const height = Math.max(1, Math.ceil(maxY - minY));
  const desiredScale = Math.max(
    1,
    ...images.map(({ item, image }) => {
      const { width: renderWidth, height: renderHeight } = getItemRenderSize(item);
      const { cropWidth, cropHeight } = getImageSourceCrop(item, image);

      return Math.max(
        cropWidth / Math.max(1, renderWidth),
        cropHeight / Math.max(1, renderHeight),
        1,
      );
    }),
  );
  const maxScaleByPixels = Math.sqrt(
    CLIPBOARD_MAX_RENDER_PIXELS / Math.max(1, width * height),
  );
  const exportScale = Math.max(
    1,
    Math.min(
      desiredScale,
      Number.isFinite(maxScaleByPixels) ? maxScaleByPixels : 1,
    ),
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * exportScale));
  canvas.height = Math.max(1, Math.ceil(height * exportScale));
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  images.forEach(({ item, image }) => {
    const { width: renderWidth, height: renderHeight } = getItemRenderSize(item);
    const { cropX, cropY, cropWidth, cropHeight } = getImageSourceCrop(item, image);
    const centerX = (item.x + renderWidth * 0.5 - minX) * exportScale;
    const centerY = (item.y + renderHeight * 0.5 - minY) * exportScale;
    const scaledRenderWidth = renderWidth * exportScale;
    const scaledRenderHeight = renderHeight * exportScale;

    context.save();
    context.translate(centerX, centerY);
    context.rotate((item.rotation * Math.PI) / 180);
    context.scale(item.flippedX ? -1 : 1, 1);
    context.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      -scaledRenderWidth * 0.5,
      -scaledRenderHeight * 0.5,
      scaledRenderWidth,
      scaledRenderHeight,
    );
    context.restore();
  });

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
};

export const useWorkspaceClipboardActions = ({
  activeGroup,
  clipboardItems,
  selectedItemIds,
  importFromPayload,
  addGroupItems,
  removeGroupItems,
  patchGroupItems,
  flipItems,
  setClipboardItems,
  setSelectedItemIds,
  pushToast,
  runHistoryBatch,
  ensureCanvasFitsItems,
}: UseWorkspaceClipboardActionsOptions) => {
  const lastSystemClipboardImageRef = useRef<string | null>(null);

  const syncSystemClipboardImage = useCallback(async (items: CanvasItem[]) => {
    const imageItems = items.filter(
      (item): item is ImageItem => item.type === "image",
    );

    const dataUrl = await renderClipboardSelectionDataUrl(imageItems);
    if (!dataUrl) {
      return false;
    }

    const didWrite = await window.desktopApi.clipboard.writeImageFromDataUrl({
      dataUrl,
    });
    if (didWrite) {
      lastSystemClipboardImageRef.current = dataUrl;
    }

    return didWrite;
  }, []);

  const copySelectedItemsToClipboard = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected items to copy.");
      return;
    }

    const selectedItems = activeGroup.items
      .filter((item) => selectedItemIds.includes(item.id))
      .sort((left, right) => left.zIndex - right.zIndex);

    if (selectedItems.length === 0) {
      pushToast("info", "No selected items to copy.");
      return;
    }

    setClipboardItems(structuredClone(selectedItems));
    void syncSystemClipboardImage(selectedItems);
    pushToast("success", `Copied ${selectedItems.length} item(s) to clipboard.`);
  }, [
    activeGroup,
    pushToast,
    selectedItemIds,
    setClipboardItems,
    syncSystemClipboardImage,
  ]);

  const cutSelectedItems = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected items to cut.");
      return;
    }

    if (activeGroup.locked) {
      pushToast("info", "Canvas is locked.");
      return;
    }

    const selectedItems = activeGroup.items
      .filter((item) => selectedItemIds.includes(item.id))
      .sort((left, right) => left.zIndex - right.zIndex);

    if (selectedItems.length === 0) {
      pushToast("info", "No selected items to cut.");
      return;
    }

    setClipboardItems(structuredClone(selectedItems));
    void syncSystemClipboardImage(selectedItems);
    runHistoryBatch(() => {
      removeGroupItems(activeGroup.id, selectedItemIds);
      setSelectedItemIds([]);
    });
    pushToast("success", "Selected item(s) cut.");
  }, [
    activeGroup,
    pushToast,
    removeGroupItems,
    runHistoryBatch,
    selectedItemIds,
    setClipboardItems,
    setSelectedItemIds,
    syncSystemClipboardImage,
  ]);

  const pasteClipboardItems = useCallback(() => {
    if (!activeGroup) {
      pushToast("info", "Clipboard is empty.");
      return;
    }

    if (activeGroup.locked) {
      pushToast("info", "Canvas is locked.");
      return;
    }

    void (async () => {
      const nativeClipboardImage = await window.desktopApi.clipboard
        .readImageAsDataUrl()
        .catch(() => null);

      const shouldPasteInternalClipboard =
        clipboardItems.length > 0 &&
        (
          nativeClipboardImage === null ||
          nativeClipboardImage === lastSystemClipboardImageRef.current
        );

      if (!shouldPasteInternalClipboard && nativeClipboardImage) {
        await importFromPayload({
          source: "clipboard",
          files: [],
          urls: [nativeClipboardImage],
        });
        return;
      }

      if (clipboardItems.length === 0) {
        pushToast("info", "Clipboard is empty.");
        return;
      }

      const maxExistingZ = activeGroup.items.reduce(
        (acc, item) => Math.max(acc, item.zIndex),
        -1,
      );

      const duplicates = clipboardItems.map((item, index) => ({
        ...structuredClone(item),
        id: crypto.randomUUID(),
        x: item.x + 24,
        y: item.y + 24,
        zIndex: maxExistingZ + index + 1,
      }));

      runHistoryBatch(() => {
        addGroupItems(activeGroup.id, duplicates);
        setSelectedItemIds(duplicates.map((item) => item.id));
        ensureCanvasFitsItems(
          activeGroup.id,
          [...activeGroup.items, ...duplicates],
          activeGroup.canvasSize,
          {
            zoom: activeGroup.zoom,
            panX: activeGroup.panX,
            panY: activeGroup.panY,
          },
        );
      });

      pushToast("success", `Pasted ${duplicates.length} item(s).`);
    })();
  }, [
    activeGroup,
    addGroupItems,
    clipboardItems,
    ensureCanvasFitsItems,
    importFromPayload,
    pushToast,
    runHistoryBatch,
    setSelectedItemIds,
  ]);

  const deleteSelectedItems = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected images to delete.");
      return;
    }

    if (activeGroup.locked) {
      pushToast("info", "Canvas is locked.");
      return;
    }

    runHistoryBatch(() => {
      removeGroupItems(activeGroup.id, selectedItemIds);
      setSelectedItemIds([]);
    });
    pushToast("success", "Selected image(s) deleted.");
  }, [
    activeGroup,
    pushToast,
    removeGroupItems,
    runHistoryBatch,
    selectedItemIds,
    setSelectedItemIds,
  ]);

  const flipSelectedItemsHorizontally = useCallback(() => {
    if (!activeGroup || selectedItemIds.length === 0) {
      pushToast("info", "No selected images to flip.");
      return;
    }

    if (activeGroup.locked) {
      pushToast("info", "Canvas is locked.");
      return;
    }

    runHistoryBatch(() => {
      flipItems(activeGroup.id, selectedItemIds);
    });
    pushToast("success", "Selected image(s) flipped horizontally.");
  }, [activeGroup, flipItems, pushToast, runHistoryBatch, selectedItemIds]);

  const applyCropToSelectedImage = useCallback(
    (cropRect: { left: number; top: number; right: number; bottom: number }) => {
      if (!activeGroup || selectedItemIds.length !== 1) {
        pushToast("info", "Select exactly one image to crop.");
        return;
      }

      if (activeGroup.locked) {
        pushToast("info", "Canvas is locked.");
        return;
      }

      const targetItem = activeGroup.items.find(
        (item): item is ImageItem =>
          item.id === selectedItemIds[0] && item.type === "image",
      );

      if (!targetItem) {
        pushToast("info", "Select exactly one image to crop.");
        return;
      }

      const safeScaleX =
        Number.isFinite(targetItem.scaleX) && targetItem.scaleX !== 0
          ? Math.abs(targetItem.scaleX)
          : 1;
      const safeScaleY =
        Number.isFinite(targetItem.scaleY) && targetItem.scaleY !== 0
          ? Math.abs(targetItem.scaleY)
          : 1;
      const currentCropX = targetItem.cropX ?? 0;
      const currentCropY = targetItem.cropY ?? 0;
      const currentCropWidth =
        targetItem.cropWidth ?? targetItem.originalWidth ?? targetItem.width;
      const currentCropHeight =
        targetItem.cropHeight ?? targetItem.originalHeight ?? targetItem.height;
      const normalizedLeft = Math.max(0, Math.min(cropRect.left, 0.98));
      const normalizedTop = Math.max(0, Math.min(cropRect.top, 0.98));
      const normalizedRight = Math.max(
        normalizedLeft + 0.02,
        Math.min(1, cropRect.right),
      );
      const normalizedBottom = Math.max(
        normalizedTop + 0.02,
        Math.min(1, cropRect.bottom),
      );
      const nextCropWidth = Math.max(
        1,
        Math.round((normalizedRight - normalizedLeft) * currentCropWidth),
      );
      const nextCropHeight = Math.max(
        1,
        Math.round((normalizedBottom - normalizedTop) * currentCropHeight),
      );
      const nextCropX = Math.round(
        currentCropX +
          (targetItem.flippedX ? 1 - normalizedRight : normalizedLeft) *
            currentCropWidth,
      );
      const nextCropY = Math.round(currentCropY + normalizedTop * currentCropHeight);

      const visualWidth = targetItem.width * safeScaleX;
      const visualHeight = targetItem.height * safeScaleY;
      const visualMinX = targetItem.x;
      const visualMinY = targetItem.y;
      const nextVisualMinX = visualMinX + normalizedLeft * visualWidth;
      const nextVisualMinY = visualMinY + normalizedTop * visualHeight;
      const nextVisualWidth = (normalizedRight - normalizedLeft) * visualWidth;
      const nextWidth = Math.max(12, Math.round(nextVisualWidth / safeScaleX));
      const nextHeight = Math.max(
        12,
        Math.round(((normalizedBottom - normalizedTop) * visualHeight) / safeScaleY),
      );
      const nextX = Math.round(nextVisualMinX);
      const nextY = Math.round(nextVisualMinY);

      runHistoryBatch(() => {
        patchGroupItems(activeGroup.id, {
          [targetItem.id]: {
            x: nextX,
            y: nextY,
            width: nextWidth,
            height: nextHeight,
            cropX: nextCropX,
            cropY: nextCropY,
            cropWidth: nextCropWidth,
            cropHeight: nextCropHeight,
          },
        });
      });

      pushToast("success", "Image cropped.");
    },
    [activeGroup, patchGroupItems, pushToast, runHistoryBatch, selectedItemIds],
  );

  return {
    copySelectedItemsToClipboard,
    cutSelectedItems,
    pasteClipboardItems,
    deleteSelectedItems,
    flipSelectedItemsHorizontally,
    applyCropToSelectedImage,
  };
};
