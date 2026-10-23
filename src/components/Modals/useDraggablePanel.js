import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const PANEL_EDGE = 8;
const DRAG_IGNORE_SELECTOR = "button, a, input, select, textarea, [data-no-drag]";

/**
 * Keep a panel fully inside the viewport. Panels larger than the viewport are
 * pinned to the top-left edge instead of being pushed off-screen.
 */
export function clampPanelPosition({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  edge = PANEL_EDGE
}) {
  const maxX = Math.max(edge, viewportWidth - width - edge);
  const maxY = Math.max(edge, viewportHeight - height - edge);
  return {
    x: Math.min(Math.max(edge, x), maxX),
    y: Math.min(Math.max(edge, y), maxY)
  };
}

/**
 * Free-position drag for HUD-style panels. The panel keeps its CSS default
 * position until the user grabs the handle. During a drag the element style is
 * updated directly so the heavy panel contents are not re-rendered per frame.
 */
export function useDraggablePanel(isOpen = true) {
  const panelRef = useRef(null);
  const posRef = useRef(null);
  const dragRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [dragging, setDragging] = useState(false);

  const clampToViewport = useCallback((x, y) => {
    const el = panelRef.current;
    if (!el) return { x, y };
    return clampPanelPosition({
      x,
      y,
      width: el.offsetWidth,
      height: el.offsetHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    });
  }, []);

  const applyPosition = useCallback((next, commit) => {
    posRef.current = next;
    const el = panelRef.current;
    if (el) {
      el.style.left = `${next.x}px`;
      el.style.top = `${next.y}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
    }
    if (commit) setPos(next);
  }, []);

  // Re-clamp when the panel reopens: the viewport may have shrunk while closed.
  useLayoutEffect(() => {
    if (!isOpen || !posRef.current) return;
    applyPosition(
      clampToViewport(posRef.current.x, posRef.current.y),
      true
    );
  }, [isOpen, applyPosition, clampToViewport]);

  useEffect(() => {
    const handleResize = () => {
      const current = posRef.current;
      if (!current) return;
      applyPosition(clampToViewport(current.x, current.y), true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [applyPosition, clampToViewport]);

  const onPointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      if (event.target.closest(DRAG_IGNORE_SELECTOR)) return;
      const el = panelRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: rect.left,
        originY: rect.top
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
      applyPosition({ x: rect.left, y: rect.top }, true);
    },
    [applyPosition]
  );

  const onPointerMove = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      applyPosition(
        clampToViewport(
          drag.originX + event.clientX - drag.startX,
          drag.originY + event.clientY - drag.startY
        ),
        false
      );
    },
    [applyPosition, clampToViewport]
  );

  const endDrag = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;

      const handle = event.currentTarget;
      if (handle.hasPointerCapture?.(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      setDragging(false);
      if (posRef.current) applyPosition(posRef.current, true);
    },
    [applyPosition]
  );

  return {
    panelRef,
    dragging,
    panelStyle: pos
      ? { left: `${pos.x}px`, top: `${pos.y}px`, right: "auto", bottom: "auto" }
      : undefined,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag
    }
  };
}
