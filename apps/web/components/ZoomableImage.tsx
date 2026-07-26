"use client";

import { useRef, useState, type CSSProperties, type MouseEvent, type WheelEvent } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_CLICK_SCALE = 2.5;
const WHEEL_ZOOM_STEP = 0.0015;

/**
 * Desktop-web equivalent of mobile's ZoomableImage: wheel to zoom, drag to
 * pan once zoomed, double-click to toggle — plain React state rather than a
 * library, since this is the only place in the app that needs it.
 *
 * Every handler stops propagation so a click/drag on the image itself never
 * bubbles to the backdrop's onClick (which closes the viewer) — that's also
 * why there's no click-to-close on the image anymore, same tradeoff as
 * mobile's ZoomableImage: closing goes through the × button.
 */
export function ZoomableImage({ src, alt, style }: { src: string; alt: string; style?: CSSProperties }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const reset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s - e.deltaY * WHEEL_ZOOM_STEP));
      if (next <= 1.001) setTranslate({ x: 0, y: 0 });
      return next;
    });
  };

  const onDoubleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (scale > 1.01) {
      reset();
    } else {
      setScale(DOUBLE_CLICK_SCALE);
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (scale <= 1.001) return;
    e.stopPropagation();
    dragging.current = { startX: e.clientX, startY: e.clientY, originX: translate.x, originY: translate.y };
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging.current) return;
    e.stopPropagation();
    setTranslate({
      x: dragging.current.originX + (e.clientX - dragging.current.startX),
      y: dragging.current.originY + (e.clientY - dragging.current.startY),
    });
  };

  const endDrag = () => {
    dragging.current = null;
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL, see ReceiptDrawer
    <img
      src={src}
      alt={alt}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      draggable={false}
      style={{
        ...style,
        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
        cursor: scale > 1.001 ? "grab" : "zoom-in",
        transition: dragging.current ? "none" : "transform 0.15s ease-out",
        userSelect: "none",
      }}
    />
  );
}
