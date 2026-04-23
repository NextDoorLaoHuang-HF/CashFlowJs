"use client";

import { clsx } from "clsx";
import { useId, useMemo, useState, type ReactNode } from "react";

export type AccordionItem = {
  id: string;
  title: ReactNode;
  body: ReactNode;
  defaultOpen?: boolean;
};

type AccordionProps = {
  items: AccordionItem[];
  className?: string;
};

export function Accordion({ items, className }: AccordionProps) {
  const baseId = useId();
  const initialOpenItems = useMemo(() => new Set(items.filter((item) => item.defaultOpen).map((item) => item.id)), [items]);
  const [openItems, setOpenItems] = useState<Set<string>>(initialOpenItems);

  const toggleItem = (itemId: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  return (
    <div className={clsx("accordion", className)}>
      {items.map((item) => {
        const isOpen = openItems.has(item.id);
        const contentId = `${baseId}-${item.id}-content`;
        const triggerId = `${baseId}-${item.id}-trigger`;

        return (
          <div key={item.id} className="accordion-item" data-state={isOpen ? "open" : "closed"}>
            <button
              id={triggerId}
              type="button"
              className="accordion-header"
              aria-expanded={isOpen}
              aria-controls={contentId}
              onClick={() => toggleItem(item.id)}
            >
              <span>{item.title}</span>
            </button>
            <div
              id={contentId}
              className="accordion-body"
              role="region"
              aria-labelledby={triggerId}
              data-state={isOpen ? "open" : "closed"}
            >
              <div className="accordion-bodyInner">{item.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
