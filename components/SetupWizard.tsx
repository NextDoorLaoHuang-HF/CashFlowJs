"use client";

import { useState } from "react";
import { dreams, scenarios } from "../lib/data/scenarios";
import { t } from "../lib/i18n";
import type { Locale } from "../lib/types";
import { useGameStore, type SetupPlayer } from "../lib/state/gameStore";
import type { GameSettings } from "../lib/types";
import { StepWizard } from "./StepWizard";
import { clsx } from "clsx";

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

const STEPS = [
  { id: "players", title: "players" },
  { id: "roles", title: "roles" },
  { id: "settings", title: "settings" }
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
  const [currentStep, setCurrentStep] = useState(0);

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

  const stepTitles = STEPS.map((s) => ({
    ...s,
    title: t(locale, `setup.step.${s.id}`)
  }));

  return (
    <StepWizard
      steps={stepTitles}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      nextLabel={t(locale, "setup.next")}
      prevLabel={t(locale, "setup.prev")}
    >
      {(controls) => (
        <div className="panel">
          {currentStep === 0 && (
            <div className="wizard-content">
              <h2 className="text-xl" style={{ margin: 0 }}>{t(locale, "setup.step.players")}</h2>
              <p className="text-muted text-sm">{t(locale, "setup.step.playersHint")}</p>

              {players.map((player, index) => (
                <div key={index} className="player-card" data-tour="setup-player-card">
                  <div className="panel-header">
                    <strong>{t(locale, "setup.playerName")} {index + 1}</strong>
                    {players.length > 1 && (
                      <button onClick={() => removePlayer(index)} className="btn btn-sm btn-danger">
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="field">
                    <label className="field-label">{t(locale, "setup.playerName")}</label>
                    <input
                      value={player.name}
                      onChange={(e) => updatePlayer(index, { name: e.target.value })}
                      className="field-input"
                    />
                  </div>

                  <div className="field">
                    <label className="field-label">{t(locale, "setup.playerColor")}</label>
                    <div className="field-row">
                      <select
                        value={player.color}
                        onChange={(e) => updatePlayer(index, { color: e.target.value })}
                        className="field-input"
                      >
                        {colorPalette.map((color) => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>
                      <span className="color-swatch" style={{ background: player.color }} />
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addPlayer} className="btn btn-secondary" data-tour="setup-add-player">
                {t(locale, "setup.addPlayer")}
              </button>
            </div>
          )}

          {currentStep === 1 && (
            <div className="wizard-content">
              <h2 className="text-xl" style={{ margin: 0 }}>{t(locale, "setup.step.roles")}</h2>
              <p className="text-muted text-sm">{t(locale, "setup.step.rolesHint")}</p>

              {players.map((player, index) => (
                <div key={index} className="player-card">
                  <div className="panel-header">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className="color-swatch" style={{ background: player.color }} />
                      <strong>{player.name}</strong>
                    </span>
                  </div>

                  <div className="field">
                    <label className="field-label">{t(locale, "setup.selectRole")}</label>
                    <select
                      value={player.scenarioId}
                      onChange={(e) => updatePlayer(index, { scenarioId: e.target.value })}
                      className="field-input"
                    >
                      {scenarios.map((scenario) => {
                        const label = t(locale, `scenario.${scenario.id}.label`);
                        return (
                          <option key={scenario.id} value={scenario.id}>
                            {label} - ${scenario.salary.toLocaleString()}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="field">
                    <label className="field-label">{t(locale, "setup.selectDream")}</label>
                    <select
                      value={player.dreamId}
                      onChange={(e) => updatePlayer(index, { dreamId: e.target.value })}
                      className="field-input"
                    >
                      {dreams.map((dream) => (
                        <option key={dream.id} value={dream.id}>
                          {t(locale, `dream.${dream.id}.title`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={player.isLLM ?? false}
                      onChange={(e) => updatePlayer(index, { isLLM: e.target.checked })}
                    />
                    <span>{t(locale, "setup.addLLM")}</span>
                  </label>

                  {player.isLLM && (
                    <div className="field">
                      <input
                        placeholder={t(locale, "setup.llmModelPlaceholder")}
                        value={player.llmModel ?? ""}
                        onChange={(e) => updatePlayer(index, { llmModel: e.target.value })}
                        className="field-input"
                      />
                      <textarea
                        placeholder={t(locale, "setup.llmPersonaPlaceholder")}
                        value={player.llmPersona ?? ""}
                        onChange={(e) => updatePlayer(index, { llmPersona: e.target.value })}
                        className="field-input"
                        style={{ minHeight: "60px" }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {currentStep === 2 && (
            <div className="wizard-content" data-tour="setup-settings">
              <h2 className="text-xl" style={{ margin: 0 }}>{t(locale, "setup.step.settings")}</h2>
              <p className="text-muted text-sm">{t(locale, "setup.settings.subtitle")}</p>

              <div className="field">
                <label className="field-label">{t(locale, "setup.settings.startingLabel")}</label>
                <select
                  value={settings.startingSavingsMode}
                  onChange={(e) => setSettings((prev) => ({ ...prev, startingSavingsMode: e.target.value as GameSettings["startingSavingsMode"] }))}
                  className="field-input"
                >
                  {savingsOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(locale, option.label)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={settings.enableSmallDeals ?? true}
                    onChange={(e) => setSettings((prev) => ({ ...prev, enableSmallDeals: e.target.checked }))}
                  />
                  <span>{t(locale, "setup.settings.enableSmallDeals")}</span>
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={settings.enableBigDeals ?? true}
                    onChange={(e) => setSettings((prev) => ({ ...prev, enableBigDeals: e.target.checked }))}
                  />
                  <span>{t(locale, "setup.settings.enableBigDeals")}</span>
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={settings.enablePreferredStock ?? true}
                    onChange={(e) => setSettings((prev) => ({ ...prev, enablePreferredStock: e.target.checked }))}
                  />
                  <span>{t(locale, "setup.settings.enablePreferredStock")}</span>
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={settings.useCashflowDice ?? true}
                    onChange={(e) => setSettings((prev) => ({ ...prev, useCashflowDice: e.target.checked }))}
                  />
                  <span>{t(locale, "setup.settings.cashflowDice")}</span>
                </label>
                <p className="text-muted text-xs">{t(locale, "setup.settings.cashflowDiceHint")}</p>
                {dealsDisabled && (
                  <p className="text-xs" style={{ color: "#f87171" }}>
                    {t(locale, "setup.settings.dealsDisabledWarning")}
                  </p>
                )}
              </div>

              <button
                onClick={() => onStart(players, settings)}
                disabled={dealsDisabled}
                className="btn btn-primary"
                data-tour="setup-start-game"
              >
                {t(locale, "setup.start")}
              </button>
            </div>
          )}
        </div>
      )}
    </StepWizard>
  );
}
