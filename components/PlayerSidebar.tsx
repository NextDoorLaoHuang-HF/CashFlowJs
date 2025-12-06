"use client";

import { useGameStore } from "../lib/state/gameStore";

export function PlayerSidebar() {
  const { players, currentPlayerId } = useGameStore((state) => ({
    players: state.players,
    currentPlayerId: state.currentPlayerId
  }));

  return (
    <div className="card scrollable" style={{ maxHeight: "600px" }}>
      <h3 style={{ marginTop: 0 }}>Players</h3>
      <div className="grid" style={{ gap: "0.75rem" }}>
        {players.map((player) => (
          <div
            key={player.id}
            style={{
              padding: "0.75rem",
              borderRadius: 12,
              background: player.id === currentPlayerId ? "rgba(68, 208, 123, 0.15)" : "rgba(255,255,255,0.03)",
              border: player.id === currentPlayerId ? "1px solid rgba(68,208,123,0.5)" : "1px solid rgba(255,255,255,0.05)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: player.color,
                  border: "1px solid rgba(0,0,0,0.4)"
                }}
              />
              <strong>{player.name}</strong>
            </div>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0.25rem",
                margin: "0.5rem 0 0",
                fontSize: "0.85rem"
              }}
            >
              <dt style={{ color: "var(--muted)" }}>Cash</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>${player.cash.toLocaleString()}</dd>
              <dt style={{ color: "var(--muted)" }}>Passive</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>${player.passiveIncome.toLocaleString()}</dd>
              <dt style={{ color: "var(--muted)" }}>Payday</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>${player.payday.toLocaleString()}</dd>
              <dt style={{ color: "var(--muted)" }}>Dream</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>{player.dream?.title ?? "—"}</dd>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
