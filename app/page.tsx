"use client";

import { BoardGrid } from "../components/BoardGrid";
import { BankLoansPanel } from "../components/BankLoansPanel";
import { ControlPanel } from "../components/ControlPanel";
import { GameLog } from "../components/GameLog";
import { JointVenturesPanel } from "../components/JointVenturesPanel";
import { LLMPanel } from "../components/LLMPanel";
import { LocalizationToggle } from "../components/LocalizationToggle";
import { LoansPanel } from "../components/LoansPanel";
import { PlayerSidebar } from "../components/PlayerSidebar";
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
        <LocalizationToggle />
      </header>

      {phase === "setup" || players.length === 0 ? (
        <SetupWizard
          locale={settings.locale}
          initialSettings={settings}
          onStart={(configuredPlayers, configuredSettings) => initGame({ players: configuredPlayers, settings: configuredSettings })}
        />
      ) : (
        <div className="grid dashboard" style={{ gridTemplateColumns: "2.1fr 0.9fr", gap: "1.25rem" }}>
          <div className="grid" style={{ gap: "1.25rem" }}>
            <BoardGrid />
            <ControlPanel />
            <GameLog />
          </div>
          <div className="grid" style={{ gap: "1.25rem" }}>
            <PlayerSidebar />
            <BankLoansPanel />
            <JointVenturesPanel />
            <LoansPanel />
            <LLMPanel />
          </div>
        </div>
      )}
    </main>
  );
}
