"use client";

import { clsx } from "clsx";
import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";
import { translateCardText } from "../lib/cardTranslations";
import { getFastTrackEvent } from "../lib/data/fastTrackEvents";

export function BoardGrid() {
  const { board, fastTrackBoard, players, currentPlayerId, settings } = useGameStore((state) => ({
    board: state.board,
    fastTrackBoard: state.fastTrackBoard,
    players: state.players,
    currentPlayerId: state.currentPlayerId,
    settings: state.settings
  }));
  const hasFastTrack = players.some((player) => player.track === "fastTrack");

  const sections: Array<{ title: string; squares: typeof board; track: "ratRace" | "fastTrack" }> = [
    { title: t(settings.locale, "board.section.ratRace"), squares: board, track: "ratRace" }
  ];
  if (hasFastTrack) {
    sections.push({ title: t(settings.locale, "board.section.fastTrack"), squares: fastTrackBoard, track: "fastTrack" });
  }

  return (
    <div className="panel" data-tour="board-grid">
      <div className="panel-header">
        <h3 className="text-lg" style={{ margin: 0 }}>{t(settings.locale, "board.title")}</h3>
        {currentPlayerId && (
          <span className="text-muted text-sm">
            {t(settings.locale, "info.currentPlayer")}: {players.find((p) => p.id === currentPlayerId)?.name}
          </span>
        )}
      </div>
      {sections.map((section, index) => {
        const isLast = index === sections.length - 1;
        return (
          <div
            key={section.track}
            className="board-section"
            style={{ marginBottom: isLast ? 0 : undefined, borderBottom: isLast ? "none" : undefined }}
          >
            <h4 className="text-sm" style={{ margin: "0 0 0.5rem" }}>{section.title}</h4>
            <div className="board-grid">
              {section.squares.map((square) => {
                const occupants = players.filter(
                  (player) => player.status !== "bankrupt" && player.track === section.track && player.position === square.id
                );
                const label = t(settings.locale, `board.square.${square.type.toLowerCase()}`);
                const fastTrackEventTitle =
                  section.track === "fastTrack"
                    ? (() => {
                        const event = getFastTrackEvent(square.id);
                        const params = event?.params;
                        const title = params && typeof params === "object" ? (params as { title?: unknown }).title : undefined;
                        return typeof title === "string" ? translateCardText(settings.locale, title) : undefined;
                      })()
                    : undefined;
                return (
                  <div
                    key={`${section.track}-${square.id}`}
                    className="board-tile"
                    style={{ borderColor: square.color }}
                  >
                    <div className="board-tile-header">
                      <strong className="text-sm">{label}</strong>
                      <span style={{ color: square.color }}>&#11044;</span>
                    </div>
                    {fastTrackEventTitle && (
                      <div className="text-xs" style={{ lineHeight: 1.25 }}>{fastTrackEventTitle}</div>
                    )}
                    <div className="text-xs text-muted">#{square.id + 1}</div>
                    <div className="board-occupants">
                      {occupants.map((player) => (
                        <span
                          key={player.id}
                          title={player.name}
                          className="occupant-dot"
                          style={{ background: player.color }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
