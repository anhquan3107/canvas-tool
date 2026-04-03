import { useEffect } from "react";

const DRAG_THRESHOLD = 3;

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

export const useWindowRightDrag = () => {
  useEffect(() => {
    let dragToken = 0;
    let dragState:
      | {
          token: number;
          startScreenX: number;
          startScreenY: number;
          startWindowX: number | null;
          startWindowY: number | null;
          lastScreenX: number;
          lastScreenY: number;
          ready: boolean;
          moved: boolean;
        }
      | null = null;
    let pendingMove: { x: number; y: number } | null = null;
    let moveFrame: number | null = null;
    let suppressContextMenuUntil = 0;

    const flushMove = () => {
      moveFrame = null;
      if (!pendingMove) {
        return;
      }

      const nextMove = pendingMove;
      pendingMove = null;
      void window.desktopApi.window.setPosition(nextMove);
    };

    const clearDrag = () => {
      dragState = null;
      pendingMove = null;
      if (moveFrame !== null) {
        window.cancelAnimationFrame(moveFrame);
        moveFrame = null;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 2 || isTypingTarget(event.target)) {
        return;
      }

      const token = ++dragToken;
      dragState = {
        token,
        startScreenX: event.screenX,
        startScreenY: event.screenY,
        startWindowX: null,
        startWindowY: null,
        lastScreenX: event.screenX,
        lastScreenY: event.screenY,
        ready: false,
        moved: false,
      };

      void window.desktopApi.window.getPosition().then((position) => {
        if (token !== dragToken || dragState?.token !== token) {
          return;
        }

        dragState = {
          ...dragState,
          startWindowX: position.x,
          startWindowY: position.y,
          ready: true,
        };

        const deltaX = dragState.lastScreenX - dragState.startScreenX;
        const deltaY = dragState.lastScreenY - dragState.startScreenY;
        if (dragState.moved) {
          pendingMove = {
            x: position.x + deltaX,
            y: position.y + deltaY,
          };
          if (moveFrame === null) {
            moveFrame = window.requestAnimationFrame(flushMove);
          }
        }
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragState || (event.buttons & 2) === 0) {
        return;
      }

      const deltaX = event.screenX - dragState.startScreenX;
      const deltaY = event.screenY - dragState.startScreenY;
      dragState.lastScreenX = event.screenX;
      dragState.lastScreenY = event.screenY;
      if (
        !dragState.moved &&
        Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD
      ) {
        return;
      }

      dragState.moved = true;
      event.preventDefault();
      if (!dragState.ready || dragState.startWindowX === null || dragState.startWindowY === null) {
        return;
      }

      pendingMove = {
        x: dragState.startWindowX + deltaX,
        y: dragState.startWindowY + deltaY,
      };

      if (moveFrame === null) {
        moveFrame = window.requestAnimationFrame(flushMove);
      }
    };

    const handlePointerUp = () => {
      if (dragState?.moved) {
        suppressContextMenuUntil = performance.now() + 300;
      }
      dragToken += 1;
      clearDrag();
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (
        !dragState?.moved &&
        performance.now() > suppressContextMenuUntil
      ) {
        return;
      }

      event.preventDefault();
      clearDrag();
    };

    const handleWindowBlur = () => {
      dragToken += 1;
      clearDrag();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerUp, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerUp, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("blur", handleWindowBlur);
      clearDrag();
    };
  }, []);
};
