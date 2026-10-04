"use client";
import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export function NavTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  function show(element: HTMLElement) {
    if (!enabled) return;
    const rect = element.getBoundingClientRect();
    setPosition({
      left: rect.right + 14,
      top: Math.min(
        window.innerHeight - 48,
        Math.max(24, rect.top + rect.height / 2),
      ),
    });
  }
  return (
    <span
      className="nav-tooltip-anchor"
      onPointerEnter={(e) => show(e.currentTarget)}
      onPointerLeave={() => setPosition(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPosition(null)}
      onClick={() => setPosition(null)}
      onWheel={() => setPosition(null)}
    >
      {isValidElement<{ "aria-describedby"?: string }>(children)
        ? cloneElement(children, {
            "aria-describedby": enabled && position ? id : undefined,
          })
        : children}
      {enabled &&
        position &&
        createPortal(
          <span id={id} role="tooltip" className="nav-tooltip" style={position}>
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
