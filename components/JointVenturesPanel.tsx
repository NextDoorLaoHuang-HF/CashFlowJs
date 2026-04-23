"use client";

import { useState } from "react";
import { clsx } from "clsx";
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
    <div className="panel">
      <h3 className="text-base" style={{ margin: 0 }}>{t(settings.locale, "ventures.title")}</h3>
      <div className="panel-body">
        <div className="field">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(settings.locale, "ventures.namePlaceholder")}
            className="field-input"
          />
        </div>
        <div className="field">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(settings.locale, "ventures.notesPlaceholder")}
            className="field-input"
          />
        </div>
        <div className="field-row">
          <div className="field">
            <input
              type="number"
              value={cashNeeded}
              onChange={(e) => setCashNeeded(Number(e.target.value) || 0)}
              placeholder={t(settings.locale, "ventures.capitalLabel")}
              className="field-input"
            />
          </div>
          <div className="field">
            <input
              type="number"
              value={cashflow}
              onChange={(e) => setCashflow(Number(e.target.value) || 0)}
              placeholder={t(settings.locale, "ventures.cashflowLabel")}
              className="field-input"
            />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => togglePlayer(player.id)}
              className={clsx("btn btn-sm", selectedPlayers.includes(player.id) ? "btn-primary" : "btn-secondary")}
            >
              {player.name}
            </button>
          ))}
        </div>
        <button onClick={handleCreate} className="btn btn-primary">
          {t(settings.locale, "ventures.new")}
        </button>
      </div>
      <div className="panel-scrollable">
        {ventures.length === 0 && <p className="text-muted text-sm">{t(settings.locale, "ventures.empty")}</p>}
        {ventures.map((venture) => (
          <div key={venture.id} className="asset-row">
            <strong>{venture.name}</strong>
            <p className="text-muted text-sm" style={{ margin: "0.25rem 0" }}>{venture.description}</p>
            <dl className="kv-grid">
              <dt className="kv-key">{t(settings.locale, "ventures.capitalLabel")}</dt>
              <dd className="kv-value">${venture.cashNeeded.toLocaleString()}</dd>
              <dt className="kv-key">{t(settings.locale, "ventures.cashflowLabel")}</dt>
              <dd className="kv-value">${venture.cashflowImpact.toLocaleString()}</dd>
            </dl>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
              {venture.participants.map((part) => {
                const player = players.find((p) => p.id === part.playerId);
                return (
                  <span key={part.playerId} className="text-muted text-xs">
                    {player?.name}: ${part.contribution.toLocaleString()}
                  </span>
                );
              })}
            </div>
            <select
              value={venture.status}
              onChange={(e) => updateJointVenture(venture.id, { status: e.target.value as JointVenture["status"] })}
              className="field-input"
              style={{ marginTop: "0.25rem" }}
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
