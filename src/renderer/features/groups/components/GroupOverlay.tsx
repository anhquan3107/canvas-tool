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

const PREVIEW_WIDTH = 220;
const PREVIEW_HEIGHT = 72;
const PREVIEW_INSET = 0;
const PREVIEW_GAP = 0;
const AUTO_HIDE_DELAY_MS = 5000;
const CONTEXT_MENU_WIDTH = 144;
const CONTEXT_MENU_HEIGHT = 80;
const CONTEXT_MENU_MARGIN = 10;

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
  const previewItems = useMemo(() => getPreviewRects(group.items), [group.items]);
  const itemCount = group.items.length;

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
        {!isCanvasCard && previewItems.length > 0 ? (
          previewItems.map(({ item, rect }) => (
            <div
              key={item.id}
              className="group-preview-item"
              style={{
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                transform: item.flippedX ? "scaleX(-1)" : undefined,
              }}
            >
              {item.type === "image" && item.assetPath ? (
                <img
                  src={item.thumbnailAssetPath ?? item.previewAssetPath ?? item.assetPath}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="group-preview-fallback" />
              )}
            </div>
          ))
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
  const visibleGroups = open
    ? orderedGroups
      : activeGroup
      ? [activeGroup]
      : [];

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
        {visibleGroups.map((group) => (
          <div
            key={group.id}
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
