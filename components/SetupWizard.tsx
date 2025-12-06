"use client";

import { useState } from "react";
import { dreams, scenarios } from "../lib/data/scenarios";
import { t } from "../lib/i18n";
import type { Locale } from "../lib/types";
import type { SetupPlayer } from "../lib/state/gameStore";

const colorPalette = ["#10b981", "#f97316", "#f43f5e", "#3b82f6", "#a855f7", "#eab308", "#0ea5e9", "#facc15"];

type SetupWizardProps = {
  locale: Locale;
  onStart: (players: SetupPlayer[]) => void;
};

type PlayerForm = SetupPlayer;

const defaultPlayer = (index: number): PlayerForm => ({
  name: `Player ${index + 1}`,
  color: colorPalette[index % colorPalette.length],
  scenarioId: scenarios[index % scenarios.length].id,
  dreamId: dreams[index % dreams.length].id
});

export function SetupWizard({ locale, onStart }: SetupWizardProps) {
  const [players, setPlayers] = useState<PlayerForm[]>([defaultPlayer(0)]);

  const updatePlayer = (index: number, patch: Partial<PlayerForm>) => {
    setPlayers((prev) => prev.map((player, idx) => (idx === index ? { ...player, ...patch } : player)));
  };

  const addPlayer = () => {
    setPlayers((prev) => [...prev, defaultPlayer(prev.length)]);
  };

  const removePlayer = (index: number) => {
    setPlayers((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="card grid" style={{ gap: "1.5rem" }}>
      <div>
        <h2 style={{ margin: 0 }}>{t(locale, "setup.start")}</h2>
        <p style={{ color: "var(--muted)", marginTop: "0.35rem" }}>{t(locale, "app.subtitle")}</p>
      </div>

      {players.map((player, index) => (
        <div key={index} className="card" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <strong>{`${t(locale, "setup.playerName")} ${index + 1}`}</strong>
            {players.length > 1 && (
              <button onClick={() => removePlayer(index)} style={{ background: "transparent", color: "var(--muted)" }}>
                ✕
              </button>
            )}
          </div>

          <div className="grid" style={{ gap: "0.75rem" }}>
            <label className="grid" style={{ gap: "0.35rem" }}>
              <span style={{ color: "var(--muted)" }}>{t(locale, "setup.playerName")}</span>
              <input
                value={player.name}
                onChange={(e) => updatePlayer(index, { name: e.target.value })}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "0.5rem 0.75rem",
                  color: "var(--text)"
                }}
              />
            </label>

            <label className="grid" style={{ gap: "0.35rem" }}>
              <span style={{ color: "var(--muted)" }}>{t(locale, "setup.playerColor")}</span>
              <select
                value={player.color}
                onChange={(e) => updatePlayer(index, { color: e.target.value })}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "0.5rem 0.75rem",
                  color: "var(--text)"
                }}
              >
                {colorPalette.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid" style={{ gap: "0.35rem" }}>
              <span style={{ color: "var(--muted)" }}>{t(locale, "setup.selectRole")}</span>
              <select
                value={player.scenarioId}
                onChange={(e) => updatePlayer(index, { scenarioId: e.target.value })}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "0.5rem 0.75rem",
                  color: "var(--text)"
                }}
              >
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>{`${scenario.label} - $${scenario.salary}`}</option>
                ))}
              </select>
            </label>

            <label className="grid" style={{ gap: "0.35rem" }}>
              <span style={{ color: "var(--muted)" }}>{t(locale, "setup.selectDream")}</span>
              <select
                value={player.dreamId}
                onChange={(e) => updatePlayer(index, { dreamId: e.target.value })}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "0.5rem 0.75rem",
                  color: "var(--text)"
                }}
              >
                {dreams.map((dream) => (
                  <option key={dream.id} value={dream.id}>
                    {dream.title}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={player.isLLM ?? false}
                onChange={(e) => updatePlayer(index, { isLLM: e.target.checked })}
              />
              <span>{t(locale, "setup.addLLM")}</span>
            </label>

            {player.isLLM && (
              <div className="grid" style={{ gap: "0.35rem" }}>
                <input
                  placeholder="Model (e.g. gpt-4o-mini)"
                  value={player.llmModel ?? ""}
                  onChange={(e) => updatePlayer(index, { llmModel: e.target.value })}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "0.5rem 0.75rem",
                    color: "var(--text)"
                  }}
                />
                <textarea
                  placeholder="Persona / strategy prompt"
                  value={player.llmPersona ?? ""}
                  onChange={(e) => updatePlayer(index, { llmPersona: e.target.value })}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "0.5rem 0.75rem",
                    color: "var(--text)",
                    minHeight: "60px"
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          onClick={addPlayer}
          style={{
            padding: "0.65rem 1.25rem",
            background: "rgba(255,255,255,0.06)",
            borderRadius: 999,
            color: "var(--text)"
          }}
        >
          {t(locale, "setup.addPlayer")}
        </button>
        <button
          onClick={() => onStart(players)}
          style={{
            padding: "0.65rem 1.25rem",
            background: "linear-gradient(120deg, var(--accent), var(--accent-strong))",
            borderRadius: 999,
            color: "#04101f",
            fontWeight: 600
          }}
        >
          {t(locale, "setup.start")}
        </button>
      </div>
    </div>
  );
}
