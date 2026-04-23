"use client";

import { useCallback, useMemo } from "react";
import type { GamePhase } from "../lib/types";
import type { GameReplayExportV1 } from "../lib/types";
import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";

const phaseAccent: Record<GamePhase, string> = {
  setup: "rgba(96, 165, 250, 0.25)",
  dream: "rgba(167, 139, 250, 0.25)",
  ratRace: "rgba(74, 222, 128, 0.25)",
  fastTrack: "rgba(251, 191, 36, 0.25)",
  finished: "rgba(248, 113, 113, 0.25)"
};

export function GameLog() {
  const { logs, replayFrames, settings, players, clearLog } = useGameStore((state) => ({
    logs: state.logs,
    replayFrames: state.replayFrames,
    settings: state.settings,
    players: state.players,
    clearLog: state.clearLog
  }));

  const handleExport = useCallback(() => {
    const exportPayload: GameReplayExportV1 = {
      format: "cashflowjs-replay-v1",
      exportedAt: new Date().toISOString(),
      logs,
      frames: replayFrames
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow-replay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs, replayFrames]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(settings.locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }),
    [settings.locale]
  );

  const playerLookup = useMemo(
    () =>
      players.reduce<Record<string, { name: string; color: string }>>((acc, player) => {
        acc[player.id] = { name: player.name, color: player.color };
        return acc;
      }, {}),
    [players]
  );

  return (
    <div className="panel" data-tour="game-log">
      <div className="panel-header">
        <h3 className="text-base" style={{ margin: 0 }}>{t(settings.locale, "log.title")}</h3>
        <div className="action-row">
          <button onClick={handleExport} className="btn btn-secondary btn-sm">
            {t(settings.locale, "records.export")}
          </button>
          <button onClick={clearLog} className="btn btn-danger btn-sm">
            {t(settings.locale, "records.clear")}
          </button>
        </div>
      </div>
      <div className="panel-scrollable" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {logs.length === 0 && <p className="text-muted">{t(settings.locale, "log.empty")}</p>}
        {logs.map((log) => {
          const timestamp = new Date(log.timestamp);
          const player = log.playerId ? playerLookup[log.playerId] : undefined;
          const phaseLabel = t(settings.locale, `info.phase.${log.phase}`);
          const message = t(settings.locale, log.message);
          return (
            <article
              key={log.id}
              className="log-entry"
            >
              <header className="log-entry-header">
                <div className="log-entry-meta">
                  <span title={timestamp.toLocaleString(settings.locale)}>{timeFormatter.format(timestamp)}</span>
                  <span>
                    {t(settings.locale, "log.turnLabel")} #{log.turn}
                  </span>
                </div>
                <span
                  className="chip"
                  style={{ background: phaseAccent[log.phase] ?? "rgba(255,255,255,0.08)" }}
                >
                  {phaseLabel}
                </span>
              </header>

              {player && (
                <div className="log-entry-player">
                  <span>{t(settings.locale, "log.playerLabel")}</span>
                  <span style={{ width: "0.5rem", height: "0.5rem", borderRadius: 999, background: player.color }} />
                  <span style={{ fontWeight: 600 }}>{player.name}</span>
                </div>
              )}

              <p className="text-sm" style={{ margin: "0.35rem 0", lineHeight: 1.4 }}>{message}</p>

              {log.payload && (
                <details style={{ marginTop: "0.5rem" }}>
                  <summary className="text-muted text-xs" style={{ cursor: "pointer" }}>{t(settings.locale, "log.payloadSummary")}</summary>
                  <pre className="replay-payload">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
