"use client";

import { useRef, useState } from "react";

// Click-and-drag for pins placed as x/y fractions of a page (reference pins on
// the script, note pins on the art). The pin follows the pointer; on release,
// if it moved, `onMove` saves the new spot and the pin keeps it locally until
// the server data catches up. A press that barely moves stays a click.

const DRAG_THRESHOLD_PX = 4;

type Pos = { x: number; y: number };

export function usePinDrag(onMove: (id: string, pos: Pos) => void) {
  const [dragging, setDragging] = useState<({ id: string } & Pos) | null>(null);
  const [placed, setPlaced] = useState<Record<string, Pos>>({});
  const drag = useRef<{ id: string; startX: number; startY: number; rect: DOMRect; last: Pos | null } | null>(null);
  // Set when a drag just ended, so the click that follows pointerup is ignored.
  const suppressClick = useRef(false);

  const posFor = (id: string, x: number, y: number): Pos => {
    if (dragging && dragging.id === id) return dragging;
    return placed[id] ?? { x, y };
  };

  const handlers = (id: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const layer = e.currentTarget.parentElement;
      if (!layer) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id, startX: e.clientX, startY: e.clientY, rect: layer.getBoundingClientRect(), last: null };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      if (!d.last && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
      const clamp = (n: number) => Math.min(1, Math.max(0, n));
      d.last = {
        x: clamp((e.clientX - d.rect.left) / d.rect.width),
        y: clamp((e.clientY - d.rect.top) / d.rect.height),
      };
      setDragging({ id, ...d.last });
    },
    onPointerUp: () => {
      const d = drag.current;
      drag.current = null;
      setDragging(null);
      if (!d?.last) return;
      const pos = d.last;
      setPlaced((prev) => ({ ...prev, [id]: pos }));
      suppressClick.current = true;
      onMove(id, pos);
    },
    onPointerCancel: () => {
      drag.current = null;
      setDragging(null);
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    "data-dragging": dragging?.id === id ? "true" : undefined,
  });

  return { posFor, handlers };
}
