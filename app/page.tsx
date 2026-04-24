"use client";

import { useState } from "react";
import { BoardGrid } from "../components/BoardGrid";
import { ControlPanel } from "../components/ControlPanel";
import { DashboardAside } from "../components/DashboardAside";
import { GameLog } from "../components/GameLog";
import { LocalizationToggle } from "../components/LocalizationToggle";
import { PlayerGuideEntry } from "../components/PlayerGuideEntry";
import { ReplayPanel } from "../components/ReplayPanel";
import { SetupWizard } from "../components/SetupWizard";
import { MultiplayerLobby } from "../components/MultiplayerLobby";
import { RoomScreen } from "../components/RoomScreen";
import { useGameStore } from "../lib/state/gameStore";
import { useMultiplayerStore } from "../lib/multiplayer/syncStore";
import { useMultiplayer } from "../lib/multiplayer/useMultiplayer";
import { t } from "../lib/i18n";

type AppMode = "menu" | "local" | "multiplayer";

export default function Page() {
  const { phase, players, settings, initGame } = useGameStore((state) => ({
    phase: state.phase,
    players: state.players,
    settings: state.settings,
    initGame: state.initGame
  }));

  const mpStore = useMultiplayerStore();
  const [appMode, setAppMode] = useState<AppMode>("menu");

  // Activate multiplayer realtime subscription when in a room
  useMultiplayer();

  // In a room (lobby or playing)
  const inRoom = mpStore.roomId !== null;
  // isMultiplayerActive: true when the server has pushed an active game state
  // (phase moved out of setup OR players array is non-empty).
  // This lets us switch from the RoomScreen lobby to the actual game board.
  const isMultiplayerActive = inRoom && (mpStore.phase !== "setup" || mpStore.players.length > 0);

  // Determine what to render
  const renderContent = () => {
    // If we're in a multiplayer room but game hasn't started, show room screen
    if (inRoom && phase === "setup" && players.length === 0 && !isMultiplayerActive) {
      return <RoomScreen />;
    }

    // If game is active (local or multiplayer)
    if (phase !== "setup" && players.length > 0) {
      return (
        <div className="dashboard-layout">
          <div className="dashboard-main">
            <BoardGrid />
            <ControlPanel />
            <GameLog />
          </div>
          <DashboardAside locale={settings.locale} />
        </div>
      );
    }

    // Mode selection
    if (appMode === "menu") {
      return (
        <div className="setup-layout">
          <div className="panel mode-selection" style={{ maxWidth: "480px", margin: "0 auto" }}>
            <h2>{t(settings.locale, "app.title")}</h2>
            <p className="text-muted text-sm" style={{ marginBottom: "1.5rem" }}>
              {t(settings.locale, "app.subtitle")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setAppMode("local")}
                style={{ justifyContent: "center", padding: "1rem" }}
              >
                {t(settings.locale, "mode.local") || "本地游戏"}
                <span className="text-muted text-sm" style={{ display: "block", marginTop: "0.25rem" }}>
                  {t(settings.locale, "mode.localDesc") || "同一设备上轮流操作"}
                </span>
              </button>
              <button
                className="btn btn-secondary btn-lg"
                onClick={() => setAppMode("multiplayer")}
                style={{ justifyContent: "center", padding: "1rem" }}
              >
                {t(settings.locale, "mode.multiplayer") || "联机游戏"}
                <span className="text-muted text-sm" style={{ display: "block", marginTop: "0.25rem" }}>
                  {t(settings.locale, "mode.multiplayerDesc") || "多设备实时联机"}
                </span>
              </button>
            </div>
          </div>
          <ReplayPanel />
        </div>
      );
    }

    if (appMode === "local") {
      return (
        <div className="setup-layout">
          <SetupWizard
            locale={settings.locale}
            initialSettings={settings}
            onStart={(configuredPlayers, configuredSettings) =>
              initGame({ players: configuredPlayers, settings: configuredSettings })
            }
          />
          <ReplayPanel />
        </div>
      );
    }

    if (appMode === "multiplayer") {
      return (
        <div className="setup-layout">
          <MultiplayerLobby />
          <ReplayPanel />
        </div>
      );
    }

    return null;
  };

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
          {appMode !== "menu" && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setAppMode("menu");
                mpStore.clearRoom();
              }}
            >
              {t(settings.locale, "nav.back") || "返回"}
            </button>
          )}
        </div>
      </header>

      {renderContent()}
    </main>
  );
}
