"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import { useIsMobile } from "../lib/hooks/useIsMobile";

type PanelSectionProps = {
  title: string;
  badge?: string | number;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  tour?: string;
};

export function PanelSection({ title, badge, collapsible = false, defaultOpen = true, children, className, tour }: PanelSectionProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen);

  if (isMobile && collapsible) {
    return (
      <section className={clsx("accordion-item", className)} data-state={open ? "open" : "closed"} data-tour={tour}>
        <button type="button" className="accordion-header" aria-expanded={open} onClick={() => setOpen((prev) => !prev)}>
          <span>{title}</span>
          {badge !== undefined ? <span className="chip chip-active">{badge}</span> : null}
        </button>
        <div className="accordion-body" data-state={open ? "open" : "closed"}>
          <div className="accordion-bodyInner">
            <div className="panel-body">{children}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={clsx("card", "panel", className)} data-tour={tour}>
      <div className="panel-header">
        <strong className="text-base">{title}</strong>
        {badge !== undefined ? <span className="chip chip-active">{badge}</span> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
