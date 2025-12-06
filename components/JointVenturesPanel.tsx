"use client";

import { useState } from "react";
import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";
import type { JointVenture } from "../lib/types";

export function JointVenturesPanel() {
  const { ventures, players, addJointVenture, updateJointVenture, settings } = useGameStore((state) => ({
    ventures: state.ventures,
    players: state.players,
    addJointVenture: state.addJointVenture,
    updateJointVenture: state.updateJointVenture,
    settings: state.settings
  }));

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cashNeeded, setCashNeeded] = useState(10000);
  const [cashflow, setCashflow] = useState(1000);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers((prev) => (prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]));
  };

  const handleCreate = () => {
    if (!name || selectedPlayers.length < 1) return;
    const contribution = cashNeeded / selectedPlayers.length;
    addJointVenture({
      name,
      description,
      cashNeeded,
      cashflowImpact: cashflow,
      participants: selectedPlayers.map((playerId) => ({
        playerId,
        contribution,
        equity: 100 / selectedPlayers.length
      }))
    });
    setName("");
    setDescription("");
    setSelectedPlayers([]);
  };

  return (
    <div className="card grid" style={{ gap: "0.6rem" }}>
      <h3 style={{ margin: 0 }}>{t(settings.locale, "ventures.title")}</h3>
      <div className="grid" style={{ gap: "0.5rem" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(settings.locale, "ventures.namePlaceholder")}
          style={{ borderRadius: 8, padding: "0.45rem 0.65rem", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff" }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(settings.locale, "ventures.notesPlaceholder")}
          style={{
            borderRadius: 8,
            padding: "0.45rem 0.65rem",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "#fff",
            minHeight: "60px"
          }}
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="number"
            value={cashNeeded}
            onChange={(e) => setCashNeeded(Number(e.target.value) || 0)}
            placeholder={t(settings.locale, "ventures.capitalLabel")}
            style={{
              flex: 1,
              borderRadius: 8,
              padding: "0.45rem 0.65rem",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff"
            }}
          />
          <input
            type="number"
            value={cashflow}
            onChange={(e) => setCashflow(Number(e.target.value) || 0)}
            placeholder={t(settings.locale, "ventures.cashflowLabel")}
            style={{
              flex: 1,
              borderRadius: 8,
              padding: "0.45rem 0.65rem",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff"
            }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => togglePlayer(player.id)}
              style={{
                borderRadius: 30,
                padding: "0.35rem 0.9rem",
                border: selectedPlayers.includes(player.id) ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.08)",
                background: selectedPlayers.includes(player.id) ? "rgba(68,208,123,0.15)" : "transparent",
                color: "#fff"
              }}
            >
              {player.name}
            </button>
          ))}
        </div>
        <button
          onClick={handleCreate}
          style={{
            borderRadius: 10,
            padding: "0.5rem 0.75rem",
            background: "rgba(59,130,246,0.3)",
            color: "#fff"
          }}
        >
          {t(settings.locale, "ventures.new")}
        </button>
      </div>
      <div className="scrollable" style={{ maxHeight: "200px" }}>
        {ventures.length === 0 && <p style={{ color: "var(--muted)" }}>{t(settings.locale, "ventures.empty")}</p>}
        {ventures.map((venture) => (
          <div key={venture.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <strong>{venture.name}</strong>
            <p style={{ margin: "0.25rem 0", color: "var(--muted)", fontSize: "0.85rem" }}>{venture.description}</p>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: 0, fontSize: "0.8rem" }}>
              <dt>{t(settings.locale, "ventures.capitalLabel")}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>${venture.cashNeeded.toLocaleString()}</dd>
              <dt>{t(settings.locale, "ventures.cashflowLabel")}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>${venture.cashflowImpact.toLocaleString()}</dd>
            </dl>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
              {venture.participants.map((part) => {
                const player = players.find((p) => p.id === part.playerId);
                return (
                  <span key={part.playerId} style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {player?.name}: ${part.contribution.toLocaleString()}
                  </span>
                );
              })}
            </div>
            <select
              value={venture.status}
              onChange={(e) => updateJointVenture(venture.id, { status: e.target.value as JointVenture["status"] })}
              style={{
                marginTop: "0.25rem",
                background: "rgba(255,255,255,0.05)",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
                padding: "0.35rem"
              }}
            >
              <option value="forming">{t(settings.locale, "ventures.status.forming")}</option>
              <option value="active">{t(settings.locale, "ventures.status.active")}</option>
              <option value="closed">{t(settings.locale, "ventures.status.closed")}</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
