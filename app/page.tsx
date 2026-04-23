"use client";

import { BoardGrid } from "../components/BoardGrid";
import { ControlPanel } from "../components/ControlPanel";
import { DashboardAside } from "../components/DashboardAside";
import { GameLog } from "../components/GameLog";
import { LocalizationToggle } from "../components/LocalizationToggle";
import { PlayerGuideEntry } from "../components/PlayerGuideEntry";
import { ReplayPanel } from "../components/ReplayPanel";
import { SetupWizard } from "../components/SetupWizard";
import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";

export default function Page() {
  const { phase, players, settings, initGame } = useGameStore((state) => ({
    phase: state.phase,
    players: state.players,
    settings: state.settings,
    initGame: state.initGame
  }));

  return (
    <main className="shell">
      <header className="shell-header">
        <div>
          <h1>{t(settings.locale, "app.title")}</h1>
          <p className="shell-subtitle">{t(settings.locale, "app.subtitle")}</p>
        </div>
        <div className="shell-header-controls">
          <PlayerGuideEntry />
          <LocalizationToggle />
        </div>
      </header>

      {phase === "setup" || players.length === 0 ? (
        <div className="setup-layout">
          <SetupWizard
            locale={settings.locale}
            initialSettings={settings}
            onStart={(configuredPlayers, configuredSettings) => initGame({ players: configuredPlayers, settings: configuredSettings })}
          />
          <ReplayPanel />
        </div>
      ) : (
        <div className="dashboard-layout">
          <div className="dashboard-main">
            <BoardGrid />
            <ControlPanel />
            <GameLog />
          </div>
          <DashboardAside locale={settings.locale} />
        </div>
      )}
    </main>
  );
}
