"use client";

import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";

export function BoardGrid() {
  const { board, players, currentPlayerId, settings } = useGameStore((state) => ({
    board: state.board,
    players: state.players,
    currentPlayerId: state.currentPlayerId,
    settings: state.settings
  }));

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0 }}>Board</h3>
        {currentPlayerId && (
          <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            {t(settings.locale, "info.currentPlayer")}: {players.find((p) => p.id === currentPlayerId)?.name}
          </span>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: "0.5rem"
        }}
      >
        {board.map((square) => {
          const occupants = players.filter((player) => player.position === square.id);
          return (
            <div
              key={square.id}
              style={{
                borderRadius: 12,
                border: `1px solid ${square.color}`,
                padding: "0.5rem",
                minHeight: "90px",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.85rem" }}>{square.label}</strong>
                <span style={{ color: square.color }}>&#11044;</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>#{square.id + 1}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                {occupants.map((player) => (
                  <span
                    key={player.id}
                    title={player.name}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: player.color,
                      border: "1px solid rgba(0,0,0,0.3)"
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
