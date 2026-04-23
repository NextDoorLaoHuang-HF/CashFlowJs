"use client";

import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";
import { translateCardText } from "../lib/cardTranslations";
import { getFastTrackEvent } from "../lib/data/fastTrackEvents";
import type { BoardSquare, BoardSquareType, Player } from "../lib/types";

const SQUARE_ICONS: Record<BoardSquareType, string> = {
  OPPORTUNITY: "💡",
  LIABILITY: "⚡",
  CHARITY: "❤️",
  PAYCHECK: "💰",
  OFFER: "📈",
  CHILD: "👶",
  DOWNSIZE: "❌",
  FAST_PAYDAY: "💰",
  FAST_OPPORTUNITY: "🚀",
  FAST_DONATION: "🎁",
  FAST_PENALTY: "🔥",
  FAST_DREAM: "🏆",
};

function getPlayerInitials(player: Player): string {
  const name = player.name || "";
  if (!name) return "?";
  // Take first character, supporting CJK
  const first = name.charAt(0).toUpperCase();
  return first;
}

function buildSnakeOrder(rows: number, cols: number): number[] {
  const order: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const colIndex = r % 2 === 0 ? c : cols - 1 - c;
      order.push(r * cols + colIndex);
    }
  }
  return order;
}

function BoardSection({
  title,
  squares,
  track,
  players,
  currentPlayerId,
  locale,
  rows,
  cols,
}: {
  title: string;
  squares: BoardSquare[];
  track: "ratRace" | "fastTrack";
  players: Player[];
  currentPlayerId: string | null;
  locale: string;
  rows: number;
  cols: number;
}) {
  const snakeOrder = buildSnakeOrder(rows, cols);

  return (
    <div className="board-section">
      <h4 className="text-sm" style={{ margin: "0 0 0.5rem" }}>
        {title}
      </h4>
      <div
        className="board-track"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: "0.5rem",
        }}
      >
        {snakeOrder.map((squareId) => {
          const square = squares[squareId];
          if (!square) return <div key={`empty-${squareId}`} />;

          const occupants = players.filter(
            (p) =>
              p.status !== "bankrupt" &&
              p.track === track &&
              p.position === square.id
          );
          const isCurrentPlayerHere = occupants.some(
            (p) => p.id === currentPlayerId
          );
          const label = t(locale, `board.square.${square.type.toLowerCase()}`);
          const fastTrackEventTitle =
            track === "fastTrack"
              ? (() => {
                  const event = getFastTrackEvent(square.id);
                  const params = event?.params;
                  const title =
                    params && typeof params === "object"
                      ? (params as { title?: unknown }).title
                      : undefined;
                  return typeof title === "string"
                    ? translateCardText(locale, title)
                    : undefined;
                })()
              : undefined;

          return (
            <div
              key={`${track}-${square.id}`}
              className={`board-tile ${isCurrentPlayerHere ? "board-tile-active" : ""}`}
              style={{
                borderColor: square.color,
                background: isCurrentPlayerHere
                  ? `linear-gradient(180deg, rgba(19,27,51,0.98), rgba(${parseInt(square.color.slice(1, 3), 16)}, ${parseInt(square.color.slice(3, 5), 16)}, ${parseInt(square.color.slice(5, 7), 16)}, 0.12))`
                  : undefined,
              }}
            >
              <div className="board-tile-header">
                <span className="board-tile-icon">{SQUARE_ICONS[square.type]}</span>
                <span
                  className="text-xs text-muted"
                  style={{ fontWeight: 600, opacity: 0.6 }}
                >
                  #{square.id + 1}
                </span>
              </div>
              <strong className="text-sm" style={{ lineHeight: 1.2 }}>
                {label}
              </strong>
              {fastTrackEventTitle && (
                <div className="text-xs" style={{ lineHeight: 1.25, opacity: 0.8 }}>
                  {fastTrackEventTitle}
                </div>
              )}
              <div className="board-occupants">
                {occupants.map((player, idx) => (
                  <span
                    key={player.id}
                    title={player.name}
                    className="player-token"
                    style={{
                      background: player.color,
                      marginLeft: idx > 0 ? "-0.4rem" : 0,
                      zIndex: idx,
                    }}
                  >
                    {getPlayerInitials(player)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BoardGrid() {
  const { board, fastTrackBoard, players, currentPlayerId, settings } =
    useGameStore((state) => ({
      board: state.board,
      fastTrackBoard: state.fastTrackBoard,
      players: state.players,
      currentPlayerId: state.currentPlayerId,
      settings: state.settings,
    }));

  const hasFastTrack = players.some((player) => player.track === "fastTrack");

  return (
    <div className="panel" data-tour="board-grid">
      <div className="panel-header">
        <h3 className="text-lg" style={{ margin: 0 }}>
          {t(settings.locale, "board.title")}
        </h3>
        {currentPlayerId && (
          <span className="text-muted text-sm">
            {t(settings.locale, "info.currentPlayer")}:{" "}
            {players.find((p) => p.id === currentPlayerId)?.name}
          </span>
        )}
      </div>

      <BoardSection
        title={t(settings.locale, "board.section.ratRace")}
        squares={board}
        track="ratRace"
        players={players}
        currentPlayerId={currentPlayerId}
        locale={settings.locale}
        rows={4}
        cols={6}
      />

      {hasFastTrack && (
        <BoardSection
          title={t(settings.locale, "board.section.fastTrack")}
          squares={fastTrackBoard}
          track="fastTrack"
          players={players}
          currentPlayerId={currentPlayerId}
          locale={settings.locale}
          rows={5}
          cols={8}
        />
      )}
    </div>
  );
}
