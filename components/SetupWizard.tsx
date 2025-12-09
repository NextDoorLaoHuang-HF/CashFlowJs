"use client";

import { useState } from "react";
import { dreams, scenarios } from "../lib/data/scenarios";
import { t } from "../lib/i18n";
import type { Locale } from "../lib/types";
import { useGameStore, type SetupPlayer } from "../lib/state/gameStore";
import type { GameSettings } from "../lib/types";

const colorPalette = ["#10b981", "#f97316", "#f43f5e", "#3b82f6", "#a855f7", "#eab308", "#0ea5e9", "#facc15"];

type SetupWizardProps = {
  locale: Locale;
  initialSettings?: GameSettings;
  onStart: (players: SetupPlayer[], settings: Partial<GameSettings>) => void;
};

type PlayerForm = SetupPlayer;

const defaultPlayer = (index: number): PlayerForm => ({
  name: `Player ${index + 1}`,
  color: colorPalette[index % colorPalette.length],
  scenarioId: scenarios[index % scenarios.length].id,
  dreamId: dreams[index % dreams.length].id
});

const savingsOptions: Array<{ value: GameSettings["startingSavingsMode"]; label: string }> = [
  { value: "normal", label: "setup.settings.starting.normal" },
  { value: "salary", label: "setup.settings.starting.salary" },
  { value: "double-salary", label: "setup.settings.starting.double" },
  { value: "none", label: "setup.settings.starting.none" }
];

export function SetupWizard({ locale, initialSettings, onStart }: SetupWizardProps) {
  const [players, setPlayers] = useState<PlayerForm[]>([defaultPlayer(0)]);
  const storeSettings = useGameStore((state) => state.settings);
  const [settings, setSettings] = useState<Partial<GameSettings>>({
    startingSavingsMode: initialSettings?.startingSavingsMode ?? storeSettings.startingSavingsMode,
    enableBigDeals: initialSettings?.enableBigDeals ?? storeSettings.enableBigDeals,
    enableSmallDeals: initialSettings?.enableSmallDeals ?? storeSettings.enableSmallDeals,
    enablePreferredStock: initialSettings?.enablePreferredStock ?? storeSettings.enablePreferredStock,
    useCashflowDice: initialSettings?.useCashflowDice ?? storeSettings.useCashflowDice
  });

  const updatePlayer = (index: number, patch: Partial<PlayerForm>) => {
    setPlayers((prev) => prev.map((player, idx) => (idx === index ? { ...player, ...patch } : player)));
  };

  const addPlayer = () => {
    setPlayers((prev) => [...prev, defaultPlayer(prev.length)]);
  };

  const removePlayer = (index: number) => {
    setPlayers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const dealsDisabled = !(settings.enableSmallDeals ?? true) && !(settings.enableBigDeals ?? true);

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
                {scenarios.map((scenario) => {
                  const label = t(locale, `scenario.${scenario.id}.label`);
                  return (
                    <option key={scenario.id} value={scenario.id}>{`${label} - $${scenario.salary.toLocaleString()}`}</option>
                  );
                })}
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
                    {t(locale, `dream.${dream.id}.title`)}
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
                  placeholder={t(locale, "setup.llmModelPlaceholder")}
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
                  placeholder={t(locale, "setup.llmPersonaPlaceholder")}
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
          onClick={() => onStart(players, settings)}
          disabled={dealsDisabled}
          style={{
            padding: "0.65rem 1.25rem",
            background: dealsDisabled ? "rgba(255,255,255,0.08)" : "linear-gradient(120deg, var(--accent), var(--accent-strong))",
            borderRadius: 999,
            color: dealsDisabled ? "var(--muted)" : "#04101f",
            fontWeight: 600,
            cursor: dealsDisabled ? "not-allowed" : "pointer"
          }}
        >
          {t(locale, "setup.start")}
        </button>
      </div>

      <div className="card" style={{ background: "rgba(255,255,255,0.02)", display: "grid", gap: "0.75rem" }}>
        <div>
          <strong>{t(locale, "setup.settings.title")}</strong>
          <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>{t(locale, "setup.settings.subtitle")}</p>
        </div>

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span style={{ color: "var(--muted)" }}>{t(locale, "setup.settings.startingLabel")}</span>
          <select
            value={settings.startingSavingsMode}
            onChange={(e) => setSettings((prev) => ({ ...prev, startingSavingsMode: e.target.value as GameSettings["startingSavingsMode"] }))}
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "0.5rem 0.75rem",
              color: "var(--text)"
            }}
          >
            {savingsOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(locale, option.label)}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={settings.enableSmallDeals ?? true}
              onChange={(e) => setSettings((prev) => ({ ...prev, enableSmallDeals: e.target.checked }))}
            />
            <span>{t(locale, "setup.settings.enableSmallDeals")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={settings.enableBigDeals ?? true}
              onChange={(e) => setSettings((prev) => ({ ...prev, enableBigDeals: e.target.checked }))}
            />
            <span>{t(locale, "setup.settings.enableBigDeals")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={settings.enablePreferredStock ?? true}
              onChange={(e) => setSettings((prev) => ({ ...prev, enablePreferredStock: e.target.checked }))}
            />
            <span>{t(locale, "setup.settings.enablePreferredStock")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={settings.useCashflowDice ?? true}
              onChange={(e) => setSettings((prev) => ({ ...prev, useCashflowDice: e.target.checked }))}
            />
            <span>{t(locale, "setup.settings.cashflowDice")}</span>
          </label>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>{t(locale, "setup.settings.cashflowDiceHint")}</p>
          {dealsDisabled && (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#f87171" }}>
              {t(locale, "setup.settings.dealsDisabledWarning")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
