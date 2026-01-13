"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { t } from "../lib/i18n";
import type { Locale } from "../lib/types";

export type TourStep = {
  selector: string;
  title: string;
  body: string;
  padding?: number;
};

type TourOverlayProps = {
  locale: Locale;
  isOpen: boolean;
  steps: TourStep[];
  onClose: () => void;
};

type SpotlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getSpotlightRect = (target: Element, padding: number): SpotlightRect => {
  const rect = target.getBoundingClientRect();
  const left = Math.max(0, rect.left - padding);
  const top = Math.max(0, rect.top - padding);
  const width = Math.min(window.innerWidth - left, rect.width + padding * 2);
  const height = Math.min(window.innerHeight - top, rect.height + padding * 2);
  const radius = Math.min(18, Math.max(12, Math.min(width, height) / 8));
  return { left, top, width, height, radius };
};

export function TourOverlay({ locale, isOpen, steps, onClose }: TourOverlayProps) {
  const [index, setIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [missingTarget, setMissingTarget] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);

  const step = steps[index];
  const total = steps.length;

  const canPrev = index > 0;
  const canNext = index < total - 1;

  const resetToStart = () => setIndex(0);

  useEffect(() => {
    if (!isOpen) {
      resetToStart();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && canPrev) {
        setIndex((prev) => Math.max(0, prev - 1));
      }
      if (event.key === "ArrowRight" && canNext) {
        setIndex((prev) => Math.min(total - 1, prev + 1));
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canNext, canPrev, isOpen, onClose, total]);

  const padding = useMemo(() => (step?.padding ?? 10), [step?.padding]);

  useEffect(() => {
    if (!isOpen) return;
    if (!step) return;

    const update = () => {
      const el = document.querySelector(step.selector);
      if (!el) {
        setSpotlight(null);
        setMissingTarget(true);
        return;
      }
      setMissingTarget(false);
      setSpotlight(getSpotlightRect(el, padding));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, padding, step]);

  useEffect(() => {
    if (!isOpen) return;
    if (!step) return;

    const el = document.querySelector(step.selector);
    if (!el) return;
    try {
      el.scrollIntoView({ block: "center", inline: "center" });
    } catch {
      // ignore
    }
  }, [index, isOpen, step]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    if (!tooltipRef.current) return;

    const tip = tooltipRef.current;
    const tipWidth = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    const margin = 14;

    if (!spotlight) {
      setTooltipPos({ left: margin, top: margin });
      return;
    }

    const placeBelow = window.innerHeight - (spotlight.top + spotlight.height) > tipHeight + margin * 2;
    const top = placeBelow ? spotlight.top + spotlight.height + margin : Math.max(margin, spotlight.top - tipHeight - margin);
    const left = clamp(spotlight.left, margin, Math.max(margin, window.innerWidth - tipWidth - margin));
    setTooltipPos({ left, top });
  }, [index, isOpen, spotlight]);

  if (!isOpen || !step) return null;

  return (
    <div className="tourRoot" role="dialog" aria-modal="true" aria-label={t(locale, "tour.title")}>
      <div className="tourHitbox" />
      {spotlight ? (
        <div
          className="tourSpotlight"
          style={{
            left: spotlight.left,
            top: spotlight.top,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: spotlight.radius
          }}
        />
      ) : (
        <div className="tourBackdrop" />
      )}

      <div
        ref={tooltipRef}
        className="tourTooltip"
        style={{
          left: tooltipPos?.left ?? 16,
          top: tooltipPos?.top ?? 16
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem" }}>
          <strong style={{ fontSize: "1rem" }}>{step.title}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            {index + 1}/{total}
          </span>
        </div>
        <p style={{ margin: "0.5rem 0 0", color: missingTarget ? "#f97316" : "var(--muted)", lineHeight: 1.5 }}>
          {missingTarget ? t(locale, "tour.missingTarget") : step.body}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem" }}>
          <button className="pill pillMuted" onClick={onClose}>
            {t(locale, "tour.finish")}
          </button>
          <div style={{ flex: 1 }} />
          <button className="pill pillMuted" onClick={() => setIndex((prev) => Math.max(0, prev - 1))} disabled={!canPrev}>
            {t(locale, "tour.prev")}
          </button>
          {canNext ? (
            <button className="pill pillPrimary" onClick={() => setIndex((prev) => Math.min(total - 1, prev + 1))}>
              {t(locale, "tour.next")}
            </button>
          ) : (
            <button className="pill pillPrimary" onClick={onClose}>
              {t(locale, "tour.finish")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
