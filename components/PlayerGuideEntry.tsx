"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "../lib/types";
import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";
import { GuideImage } from "./GuideImage";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { TourOverlay, type TourStep } from "./TourOverlay";

const guideUrlForLocale = (locale: Locale): string[] => {
  if (locale === "en") return ["/player-guide.en.md", "/player-guide.zh.md"];
  return ["/player-guide.zh.md"];
};

export function PlayerGuideEntry() {
  const { locale, phase, playersCount } = useGameStore((state) => ({
    locale: state.settings.locale,
    phase: state.phase,
    playersCount: state.players.length
  }));
  const [isOpen, setIsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const closeTour = () => setIsTourOpen(false);
  const startTour = () => {
    setIsOpen(false);
    setIsTourOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const guideUrls = useMemo(() => guideUrlForLocale(locale), [locale]);

  const tourSteps = useMemo<TourStep[]>(() => {
    const inSetup = phase === "setup" || playersCount === 0;
    if (inSetup) {
      return [
        { selector: '[data-tour="locale-toggle"]', title: t(locale, "tour.setup.locale.title"), body: t(locale, "tour.setup.locale.body"), padding: 10 },
        { selector: '[data-tour="setup-player-card"]', title: t(locale, "tour.setup.playerCard.title"), body: t(locale, "tour.setup.playerCard.body"), padding: 12 },
        { selector: '[data-tour="setup-add-player"]', title: t(locale, "tour.setup.addPlayer.title"), body: t(locale, "tour.setup.addPlayer.body"), padding: 10 },
        { selector: '[data-tour="setup-start-game"]', title: t(locale, "tour.setup.startGame.title"), body: t(locale, "tour.setup.startGame.body"), padding: 10 },
        { selector: '[data-tour="setup-settings"]', title: t(locale, "tour.setup.settings.title"), body: t(locale, "tour.setup.settings.body"), padding: 12 },
        { selector: '[data-tour="replay-panel"]', title: t(locale, "tour.setup.replay.title"), body: t(locale, "tour.setup.replay.body"), padding: 12 }
      ];
    }

    return [
      { selector: '[data-tour="locale-toggle"]', title: t(locale, "tour.game.locale.title"), body: t(locale, "tour.game.locale.body"), padding: 10 },
      { selector: '[data-tour="board-grid"]', title: t(locale, "tour.game.board.title"), body: t(locale, "tour.game.board.body"), padding: 12 },
      { selector: '[data-tour="control-panel"]', title: t(locale, "tour.game.controls.title"), body: t(locale, "tour.game.controls.body"), padding: 12 },
      { selector: '[data-tour="portfolio-panel"]', title: t(locale, "tour.game.portfolio.title"), body: t(locale, "tour.game.portfolio.body"), padding: 12 },
      { selector: '[data-tour="game-log"]', title: t(locale, "tour.game.log.title"), body: t(locale, "tour.game.log.body"), padding: 12 },
      { selector: '[data-tour="replay-panel"]', title: t(locale, "tour.game.replay.title"), body: t(locale, "tour.game.replay.body"), padding: 12 }
    ];
  }, [locale, phase, playersCount]);

  useEffect(() => {
    if (!isOpen) return;
    if (markdown || loadFailed) return;

    const controller = new AbortController();
    const load = async () => {
      for (const url of guideUrls) {
        try {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) continue;
          const text = await res.text();
          setMarkdown(text);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      setLoadFailed(true);
    };
    void load();

    return () => controller.abort();
  }, [guideUrls, isOpen, loadFailed, markdown]);

  return (
    <>
      <button className="pill pillMuted" onClick={open}>
        {t(locale, "guide.open")}
      </button>

      {isOpen ? (
        <div className="modalOverlay" onClick={close}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={t(locale, "guide.title")} onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <strong>{t(locale, "guide.title")}</strong>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button className="pill pillPrimary" onClick={startTour}>
                  {t(locale, "tour.start")}
                </button>
                <button className="pill" onClick={close}>
                  {t(locale, "guide.close")}
                </button>
              </div>
            </div>
            <div className="modalBody">
              {loadFailed ? (
                <p style={{ margin: 0, color: "var(--muted)" }}>{t(locale, "guide.loadFailed")}</p>
              ) : markdown ? (
                <MarkdownRenderer markdown={markdown} renderImage={(src, alt) => <GuideImage src={src} alt={alt} />} />
              ) : (
                <p style={{ margin: 0, color: "var(--muted)" }}>{t(locale, "guide.loading")}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <TourOverlay locale={locale} isOpen={isTourOpen} steps={tourSteps} onClose={closeTour} />
    </>
  );
}
