"use client";

import { clsx } from "clsx";
import { useEffect, useId, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useIsMobile } from "../lib/hooks/useIsMobile";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

export function BottomSheet({ open, onClose, title, children, className, closeLabel = "关闭" }: BottomSheetProps) {
  const isMobile = useIsMobile();
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const desktopTitleId = useMemo(() => `${titleId}-desktop`, [titleId]);

  useEffect(() => {
    if (!open || !isMobile) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = contentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();
    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
      previousActive?.focus();
    };
  }, [isMobile, onClose, open]);

  if (!open) {
    return null;
  }

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const nodes = contentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!nodes || nodes.length === 0) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const content = (
    <div
      ref={contentRef}
      className={clsx("sheet", !isMobile && "panel", className)}
      role={isMobile ? "dialog" : "region"}
      aria-modal={isMobile ? true : undefined}
      aria-labelledby={title ? (isMobile ? titleId : desktopTitleId) : undefined}
      onKeyDown={isMobile ? trapFocus : undefined}
    >
      <div className="sheet-content">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="panel-header">
          {title ? <h2 id={isMobile ? titleId : desktopTitleId} className="text-lg">{title}</h2> : <span />}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="关闭">
            {closeLabel}
          </button>
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );

  if (!isMobile) {
    return content;
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()}>{content}</div>
    </div>
  );
}
