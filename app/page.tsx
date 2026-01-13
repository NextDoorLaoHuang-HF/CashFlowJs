"use client";

import { BoardGrid } from "../components/BoardGrid";
import { ControlPanel } from "../components/ControlPanel";
import { GameLog } from "../components/GameLog";
import { JointVenturesPanel } from "../components/JointVenturesPanel";
import { LLMPanel } from "../components/LLMPanel";
import { LocalizationToggle } from "../components/LocalizationToggle";
import { LoansPanel } from "../components/LoansPanel";
import { PlayerSidebar } from "../components/PlayerSidebar";
import { PlayerGuideEntry } from "../components/PlayerGuideEntry";
import { PortfolioPanel } from "../components/PortfolioPanel";
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
    <main style={{ padding: "2rem clamp(1rem, 5vw, 4rem)", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>{t(settings.locale, "app.title")}</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>{t(settings.locale, "app.subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <PlayerGuideEntry />
          <LocalizationToggle />
        </div>
      </header>

      {phase === "setup" || players.length === 0 ? (
        <div className="grid" style={{ gap: "1.25rem" }}>
          <SetupWizard
            locale={settings.locale}
            initialSettings={settings}
            onStart={(configuredPlayers, configuredSettings) => initGame({ players: configuredPlayers, settings: configuredSettings })}
          />
          <ReplayPanel />
        </div>
      ) : (
        <div className="grid dashboard" style={{ gridTemplateColumns: "2.1fr 0.9fr", gap: "1.25rem" }}>
          <div className="grid" style={{ gap: "1.25rem" }}>
            <BoardGrid />
            <ControlPanel />
            <GameLog />
          </div>
          <div className="grid" style={{ gap: "1.25rem" }}>
            <PlayerSidebar />
            <PortfolioPanel />
            <JointVenturesPanel />
            <LoansPanel />
            <LLMPanel />
            <ReplayPanel />
          </div>
        </div>
      )}
    </main>
  );
}
