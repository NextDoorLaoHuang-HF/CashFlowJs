"use client";

import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";
import { translateCardText } from "../lib/cardTranslations";
import { getFastTrackEvent } from "../lib/data/fastTrackEvents";
import type { Locale, Player } from "../lib/types";
import type { BoardSquare, BoardSquareType } from "../lib/data/board";

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
  return name.charAt(0).toUpperCase();
}

/** Build rectangular ring order for Rat Race (24 squares) — clockwise
 *  Top: 7, Right: 5, Bottom: 7 (right-to-left), Left: 5 (bottom-to-top)
 */
function buildRatRaceRing(): number[] {
  const order: number[] = [];
  // top row left→right: 0..6
  for (let i = 0; i < 7; i++) order.push(i);
  // right column top→bottom: 7..11
  for (let i = 7; i < 12; i++) order.push(i);
  // bottom row right→left: 12..18
  for (let i = 12; i <= 18; i++) order.push(i);
  // left column bottom→top: 19..23
  for (let i = 19; i <= 23; i++) order.push(i);
  return order;
}

/** Build rectangular ring order for Fast Track (40 squares) — clockwise
 *  Top: 12, Right: 8, Bottom: 12 (right-to-left), Left: 8 (bottom-to-top)
 */
function buildFastTrackRing(): number[] {
  const order: number[] = [];
  // top row left→right: 0..11
  for (let i = 0; i < 12; i++) order.push(i);
  // right column top→bottom: 12..19
  for (let i = 12; i < 20; i++) order.push(i);
  // bottom row right→left: 20..31
  for (let i = 20; i <= 31; i++) order.push(i);
  // left column bottom→top: 32..39
  for (let i = 32; i <= 39; i++) order.push(i);
  return order;
}

function BoardTile({
  square,
  occupants,
  isCurrentPlayerHere,
  locale,
  fastTrackEventTitle,
}: {
  square: BoardSquare;
  occupants: Player[];
  isCurrentPlayerHere: boolean;
  locale: Locale;
  fastTrackEventTitle?: string;
}) {
  const label = t(locale, `board.square.${square.type.toLowerCase()}`);

  return (
    <div
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
}

function RatRaceBoard({
  squares,
  players,
  currentPlayerId,
  locale,
}: {
  squares: BoardSquare[];
  players: Player[];
  currentPlayerId: string | null;
  locale: Locale;
}) {
  const ring = buildRatRaceRing();
  const gridAreaMap = Object.fromEntries(ring.map((id) => [id, `s${id}`]));

  const gridTemplateAreas = `
    "s0 s1 s2 s3 s4 s5 s6"
    "s23 .  .  .  .  . s7"
    "s22 .  .  .  .  . s8"
    "s21 .  .  .  .  . s9"
    "s20 .  .  .  .  . s10"
    "s19 .  .  .  .  . s11"
    "s18 s17 s16 s15 s14 s13 s12"
  `;

  return (
    <div className="board-ring-wrapper">
      <div
        className="board-ring"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gridTemplateRows: "repeat(7, minmax(0, 1fr))",
          gridTemplateAreas,
          gap: "0.4rem",
        }}
      >
        {ring.map((squareId) => {
          const square = squares[squareId];
          if (!square) return null;
          const occupants = players.filter(
            (p) =>
              p.status !== "bankrupt" &&
              p.track === "ratRace" &&
              p.position === square.id
          );
          const isCurrentPlayerHere = occupants.some(
            (p) => p.id === currentPlayerId
          );
          return (
            <div key={`rr-${square.id}`} style={{ gridArea: gridAreaMap[square.id] }}>
              <BoardTile
                square={square}
                occupants={occupants}
                isCurrentPlayerHere={isCurrentPlayerHere}
                locale={locale}
              />
            </div>
          );
        })}
        {/* Center decorative label */}
        <div className="board-center-label" style={{ gridArea: "3 / 2 / 6 / 7" }}>
          <div className="board-center-text">
            <span className="board-center-icon">🐭</span>
            <span>{t(locale, "board.section.ratRace")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FastTrackBoard({
  squares,
  players,
  currentPlayerId,
  locale,
}: {
  squares: BoardSquare[];
  players: Player[];
  currentPlayerId: string | null;
  locale: Locale;
}) {
  const ring = buildFastTrackRing();
  const gridAreaMap = Object.fromEntries(ring.map((id) => [id, `f${id}`]));

  const gridTemplateAreas = `
    "f0 f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11"
    "f39 .  .  .  .  .  .  .  .  .  .  f12"
    "f38 .  .  .  .  .  .  .  .  .  .  f13"
    "f37 .  .  .  .  .  .  .  .  .  .  f14"
    "f36 .  .  .  .  .  .  .  .  .  .  f15"
    "f35 .  .  .  .  .  .  .  .  .  .  f16"
    "f34 .  .  .  .  .  .  .  .  .  .  f17"
    "f33 .  .  .  .  .  .  .  .  .  .  f18"
    "f32 .  .  .  .  .  .  .  .  .  .  f19"
    "f31 f30 f29 f28 f27 f26 f25 f24 f23 f22 f21 f20"
  `;

  return (
    <div className="board-ring-wrapper">
      <div
        className="board-ring"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gridTemplateRows: "repeat(10, minmax(0, 1fr))",
          gridTemplateAreas,
          gap: "0.35rem",
          aspectRatio: "12 / 10",
        }}
      >
        {ring.map((squareId) => {
          const square = squares[squareId];
          if (!square) return null;
          const occupants = players.filter(
            (p) =>
              p.status !== "bankrupt" &&
              p.track === "fastTrack" &&
              p.position === square.id
          );
          const isCurrentPlayerHere = occupants.some(
            (p) => p.id === currentPlayerId
          );
          const fastTrackEventTitle = (() => {
            const event = getFastTrackEvent(square.id);
            const params = event?.params;
            const title =
              params && typeof params === "object"
                ? (params as { title?: unknown }).title
                : undefined;
            return typeof title === "string"
              ? translateCardText(locale, title)
              : undefined;
          })();
          return (
            <div key={`ft-${square.id}`} style={{ gridArea: gridAreaMap[square.id] }}>
              <BoardTile
                square={square}
                occupants={occupants}
                isCurrentPlayerHere={isCurrentPlayerHere}
                locale={locale}
                fastTrackEventTitle={fastTrackEventTitle}
              />
            </div>
          );
        })}
        {/* Center decorative label */}
        <div className="board-center-label fast-track-center" style={{ gridArea: "3 / 3 / 9 / 11" }}>
          <div className="board-center-text">
            <span className="board-center-icon">🚀</span>
            <span>{t(locale, "board.section.fastTrack")}</span>
          </div>
        </div>
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

      <div className="board-section">
        <RatRaceBoard
          squares={board}
          players={players}
          currentPlayerId={currentPlayerId}
          locale={settings.locale}
        />
      </div>

      {hasFastTrack && (
        <div className="board-section" style={{ marginTop: "1rem" }}>
          <FastTrackBoard
            squares={fastTrackBoard}
            players={players}
            currentPlayerId={currentPlayerId}
            locale={settings.locale}
          />
        </div>
      )}
    </div>
  );
}
