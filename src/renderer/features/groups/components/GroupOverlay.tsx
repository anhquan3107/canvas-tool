import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CanvasItem, ReferenceGroup } from "@shared/types/project";

interface GroupOverlayProps {
  groups: ReferenceGroup[];
  activeGroupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

interface PreviewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface GroupPreviewEntry {
  assetPath: string | null;
  flippedX: boolean;
  rect: PreviewRect;
}

const PREVIEW_WIDTH = 220;
const PREVIEW_HEIGHT = 72;
const PREVIEW_INSET = 0;
const PREVIEW_GAP = 0;
const AUTO_HIDE_DELAY_MS = 5000;
const CONTEXT_MENU_WIDTH = 144;
const CONTEXT_MENU_HEIGHT = 80;
const CONTEXT_MENU_MARGIN = 10;
const CUSTOM_ASSET_PROTOCOL_PREFIX = "canvastool-asset://";
const GROUP_PREVIEW_PREWARM_CONCURRENCY = 4;

const groupPreviewResolvedSrcCache = new Map<string, Promise<string>>();
const groupPreviewObjectUrlCache = new Map<string, string>();
const groupPreviewDecodedImageCache = new Map<string, Promise<string>>();
const groupPreviewPinnedImageCache = new Map<string, HTMLImageElement>();
const groupPreviewCompositeSrcCache = new Map<string, string>();
const groupPreviewCompositePromiseCache = new Map<string, Promise<string>>();

const resolveGroupPreviewSrc = async (assetPath: string) => {
  if (!assetPath.startsWith(CUSTOM_ASSET_PROTOCOL_PREFIX)) {
    return assetPath;
  }

  const existingObjectUrl = groupPreviewObjectUrlCache.get(assetPath);
  if (existingObjectUrl) {
    return existingObjectUrl;
  }

  const cachedPromise = groupPreviewResolvedSrcCache.get(assetPath);
  if (cachedPromise) {
    return cachedPromise;
  }

  const resolvePromise = fetch(assetPath)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load preview asset: ${assetPath}`);
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      groupPreviewObjectUrlCache.set(assetPath, objectUrl);
      return objectUrl;
    })
    .catch(() => assetPath);

  groupPreviewResolvedSrcCache.set(assetPath, resolvePromise);
  return resolvePromise;
};

const warmGroupPreviewSrc = async (assetPath: string) => {
  const cachedDecodedImage = groupPreviewDecodedImageCache.get(assetPath);
  if (cachedDecodedImage) {
    return cachedDecodedImage;
  }

  const decodePromise = resolveGroupPreviewSrc(assetPath).then(
    (resolvedSrc) =>
      new Promise<string>((resolve) => {
        const existingImage = groupPreviewPinnedImageCache.get(assetPath);
        if (existingImage) {
          resolve(resolvedSrc);
          return;
        }

        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          groupPreviewPinnedImageCache.set(assetPath, image);
          resolve(resolvedSrc);
        };
        image.onerror = () => resolve(resolvedSrc);
        image.src = resolvedSrc;

        if (typeof image.decode === "function") {
          void image.decode().then(
            () => {
              groupPreviewPinnedImageCache.set(assetPath, image);
              resolve(resolvedSrc);
            },
            () => undefined,
          );
        }
      }),
  );

  groupPreviewDecodedImageCache.set(assetPath, decodePromise);
  return decodePromise;
};

const drawPreviewImageCover = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: PreviewRect,
  flippedX: boolean,
) => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    context.fillStyle = "rgba(255, 255, 255, 0.07)";
    context.fillRect(rect.left, rect.top, rect.width, rect.height);
    return;
  }

  const scale = Math.max(rect.width / sourceWidth, rect.height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = rect.left + (rect.width - drawWidth) * 0.5;
  const drawY = rect.top + (rect.height - drawHeight) * 0.5;

  context.save();

  if (flippedX) {
    const centerX = rect.left + rect.width * 0.5;
    context.translate(centerX, 0);
    context.scale(-1, 1);
    context.translate(-centerX, 0);
  }

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  context.restore();
};

const buildGroupPreviewComposite = async (
  group: ReferenceGroup,
  previewKey: string,
) => {
  const cachedComposite = groupPreviewCompositeSrcCache.get(previewKey);
  if (cachedComposite) {
    return cachedComposite;
  }

  const cachedPromise = groupPreviewCompositePromiseCache.get(previewKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  const compositePromise = (async () => {
    const entries = getGroupPreviewEntries(group);
    const canvas = document.createElement("canvas");
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;

    const context = canvas.getContext("2d");
    if (!context) {
      return "";
    }

    context.fillStyle = group.backgroundColor || "#1e1e1e";
    context.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

    const warmedEntries = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.assetPath) {
          return { entry, image: null as HTMLImageElement | null };
        }

        await warmGroupPreviewSrc(entry.assetPath);
        return {
          entry,
          image: groupPreviewPinnedImageCache.get(entry.assetPath) ?? null,
        };
      }),
    );

    warmedEntries.forEach(({ entry, image }) => {
      if (!image) {
        context.fillStyle = "rgba(255, 255, 255, 0.07)";
        context.fillRect(
          entry.rect.left,
          entry.rect.top,
          entry.rect.width,
          entry.rect.height,
        );
        return;
      }

      drawPreviewImageCover(context, image, entry.rect, entry.flippedX);
    });

    const compositeSrc = canvas.toDataURL("image/jpeg", 0.82);
    groupPreviewCompositeSrcCache.set(previewKey, compositeSrc);
    return compositeSrc;
  })();

  groupPreviewCompositePromiseCache.set(previewKey, compositePromise);
  return compositePromise;
};

const getPreviewRects = (items: CanvasItem[]) => {
  const visibleItems = items
    .filter((item) => item.visible)
    .sort((left, right) => left.zIndex - right.zIndex)
    .slice(-5);

  if (visibleItems.length === 0) {
    return [];
  }

  const contentWidth = PREVIEW_WIDTH - PREVIEW_INSET * 2;
  const contentHeight = PREVIEW_HEIGHT - PREVIEW_INSET * 2;
  const count = visibleItems.length;
  const usableWidth = contentWidth - PREVIEW_GAP * Math.max(0, count - 1);
  const baseTileWidth = Math.floor(usableWidth / count);
  const tileHeight = contentHeight;

  return visibleItems.map((item, index) => {
    const left = PREVIEW_INSET + index * (baseTileWidth + PREVIEW_GAP);
    const width =
      index === count - 1
        ? Math.max(6, PREVIEW_INSET + contentWidth - left)
        : Math.max(6, baseTileWidth);

    return {
      item,
      rect: {
        left,
        top: PREVIEW_INSET,
        width,
        height: Math.max(6, tileHeight),
      } satisfies PreviewRect,
    };
  });
};

const getGroupPreviewEntries = (group: ReferenceGroup): GroupPreviewEntry[] =>
  getPreviewRects(group.items).map(({ item, rect }) => ({
    assetPath:
      item.type === "image" && item.assetPath
        ? item.thumbnailAssetPath ?? item.previewAssetPath ?? item.assetPath
        : null,
    flippedX: Boolean(item.flippedX),
    rect,
  }));

const getGroupPreviewCompositeKey = (group: ReferenceGroup) =>
  JSON.stringify({
    id: group.id,
    backgroundColor: group.backgroundColor,
    entries: getGroupPreviewEntries(group).map((entry) => ({
      assetPath: entry.assetPath,
      flippedX: entry.flippedX,
      left: entry.rect.left,
      top: entry.rect.top,
      width: entry.rect.width,
      height: entry.rect.height,
    })),
  });

const GroupPreviewCard = ({
  group,
  active,
  collapsed,
  showCount,
  onClick,
}: {
  group: ReferenceGroup;
  active: boolean;
  collapsed: boolean;
  showCount: boolean;
  onClick: () => void;
}) => {
  const isCanvasCard = group.kind === "canvas";
  const previewKey = useMemo(() => getGroupPreviewCompositeKey(group), [group]);
  const [previewSrc, setPreviewSrc] = useState(
    groupPreviewCompositeSrcCache.get(previewKey) ?? "",
  );
  const itemCount = group.items.length;

  useEffect(() => {
    if (isCanvasCard) {
      return;
    }

    let cancelled = false;

    void buildGroupPreviewComposite(group, previewKey).then((nextSrc) => {
      if (!cancelled) {
        setPreviewSrc(nextSrc);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [group, isCanvasCard, previewKey]);

  return (
    <button
      type="button"
      className={[
        "group-preview-row",
        active && !collapsed ? "group-preview-row-active" : "",
        collapsed ? "group-preview-row-collapsed" : "",
        isCanvasCard ? "group-preview-row-canvas" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      <div
        className="group-preview-row-visual"
        style={{ backgroundColor: group.backgroundColor }}
      >
        {!isCanvasCard && previewSrc ? (
          <img
            className="group-preview-composite"
            src={previewSrc}
            alt=""
            draggable={false}
          />
        ) : !isCanvasCard ? (
          <div className="group-preview-empty" />
        ) : null}
        {!isCanvasCard ? <div className="group-preview-overlay" /> : null}
        <div
          className={
            isCanvasCard
              ? "group-preview-content group-preview-content-canvas"
              : "group-preview-content"
          }
        >
          <span className="group-preview-title">{group.name}</span>
          {showCount && !isCanvasCard ? (
            <span className="group-preview-count">{itemCount}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
};

export const GroupOverlay = ({
  groups,
  activeGroupId,
  open,
  onOpenChange,
  onSelectGroup,
  onRenameGroup,
  onDeleteGroup,
}: GroupOverlayProps) => {
  const [menuState, setMenuState] = useState<{
    groupId: string;
    x: number;
    y: number;
  } | null>(null);
  const autoHideTimerRef = useRef<number | null>(null);

  const getMenuPosition = useCallback((x: number, y: number) => {
    const maxLeft = Math.max(
      CONTEXT_MENU_MARGIN,
      window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN,
    );
    const maxTop = Math.max(
      CONTEXT_MENU_MARGIN,
      window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN,
    );

    return {
      x: Math.min(x, maxLeft),
      y:
        y + CONTEXT_MENU_HEIGHT + CONTEXT_MENU_MARGIN > window.innerHeight
          ? Math.max(CONTEXT_MENU_MARGIN, y - CONTEXT_MENU_HEIGHT)
          : Math.min(y, maxTop),
    };
  }, []);

  const orderedGroups = useMemo(
    () =>
      [...groups].sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === "canvas" ? -1 : 1;
        }

        return left.order - right.order;
      }),
    [groups],
  );

  const handleSelectGroup = (groupId: string) => {
    startTransition(() => {
      onSelectGroup(groupId);
    });
  };

  const activeGroup =
    orderedGroups.find((group) => group.id === activeGroupId) ?? orderedGroups[0];

  const clearAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    clearAutoHideTimer();
    if (!open || menuState) {
      return;
    }

    autoHideTimerRef.current = window.setTimeout(() => {
      setMenuState(null);
      onOpenChange(false);
    }, AUTO_HIDE_DELAY_MS);
  }, [clearAutoHideTimer, menuState, onOpenChange, open]);

  const registerInteraction = useCallback(() => {
    if (!open) {
      onOpenChange(true);
      return;
    }

    scheduleAutoHide();
  }, [onOpenChange, open, scheduleAutoHide]);

  useEffect(() => {
    if (!open) {
      setMenuState(null);
      clearAutoHideTimer();
      return;
    }

    scheduleAutoHide();
    return clearAutoHideTimer;
  }, [clearAutoHideTimer, menuState, open, scheduleAutoHide]);

  useEffect(() => {
    if (!menuState) {
      return;
    }

    const closeMenu = () => setMenuState(null);
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("blur", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("blur", closeMenu);
    };
  }, [menuState]);

  useEffect(() => {
    const previewGroups = orderedGroups.map((group) => ({
      group,
      previewKey: getGroupPreviewCompositeKey(group),
      assetPaths: getGroupPreviewEntries(group)
        .map((entry) => entry.assetPath)
        .filter((assetPath): assetPath is string => Boolean(assetPath)),
    }));

    if (previewGroups.length === 0) {
      return;
    }

    let cancelled = false;
    let nextIndex = 0;
    const workerCount = Math.min(
      GROUP_PREVIEW_PREWARM_CONCURRENCY,
      previewGroups.length,
    );

    const workers = Array.from({ length: workerCount }, async () => {
      while (!cancelled) {
        const previewGroup = previewGroups[nextIndex];
        nextIndex += 1;

        if (!previewGroup) {
          return;
        }

        try {
          await Promise.all(
            previewGroup.assetPaths.map((assetPath) => warmGroupPreviewSrc(assetPath)),
          );
          await buildGroupPreviewComposite(
            previewGroup.group,
            previewGroup.previewKey,
          );
        } catch {
          return;
        }
      }
    });

    void Promise.all(workers);

    return () => {
      cancelled = true;
    };
  }, [orderedGroups]);

  return (
    <div
      className={
        open ? "group-overlay-shell group-overlay-shell-open" : "group-overlay-shell"
      }
      onPointerEnter={registerInteraction}
      onPointerMove={registerInteraction}
      onPointerDown={registerInteraction}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="group-preview-stack" aria-hidden={!open}>
        {orderedGroups.map((group) => (
          <div
            key={group.id}
            className={
              !open && activeGroup?.id !== group.id
                ? "group-preview-entry-hidden"
                : undefined
            }
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              registerInteraction();
              if (group.kind !== "group") {
                setMenuState(null);
                return;
              }

              const position = getMenuPosition(event.clientX, event.clientY);
              setMenuState({
                groupId: group.id,
                x: position.x,
                y: position.y,
              });
            }}
          >
            <GroupPreviewCard
              group={group}
              active={group.id === activeGroupId}
              collapsed={!open}
              showCount={open}
              onClick={() => {
                handleSelectGroup(group.id);
                registerInteraction();
              }}
            />
          </div>
        ))}
      </div>
      {menuState ? (
        <div
          className="group-preview-context-menu"
          style={{ left: `${menuState.x}px`, top: `${menuState.y}px` }}
          onPointerDown={(event) => {
            event.stopPropagation();
            registerInteraction();
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={() => {
              onRenameGroup(menuState.groupId);
              setMenuState(null);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              onDeleteGroup(menuState.groupId);
              setMenuState(null);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
};
