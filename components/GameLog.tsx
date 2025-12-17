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
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>{t(settings.locale, "log.title")}</h3>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleExport} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "0.35rem 0.75rem" }}>
            {t(settings.locale, "records.export")}
          </button>
          <button onClick={clearLog} style={{ background: "rgba(248,113,113,0.2)", borderRadius: 999, padding: "0.35rem 0.75rem" }}>
            {t(settings.locale, "records.clear")}
          </button>
        </div>
      </div>
      <div className="scrollable" style={{ maxHeight: "260px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {logs.length === 0 && <p style={{ color: "var(--muted)" }}>{t(settings.locale, "log.empty")}</p>}
        {logs.map((log) => {
          const timestamp = new Date(log.timestamp);
          const player = log.playerId ? playerLookup[log.playerId] : undefined;
          const phaseLabel = t(settings.locale, `info.phase.${log.phase}`);
          const message = t(settings.locale, log.message);
          return (
            <article
              key={log.id}
              style={{
                padding: "0.75rem",
                borderRadius: "0.75rem",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
                boxShadow: "0 5px 20px rgba(2,6,23,0.45)"
              }}
            >
              <header
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  alignItems: "center",
                  marginBottom: "0.35rem"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                  <span title={timestamp.toLocaleString(settings.locale)}>{timeFormatter.format(timestamp)}</span>
                  <span>
                    {t(settings.locale, "log.turnLabel")} #{log.turn}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.15rem 0.55rem",
                    borderRadius: 999,
                    background: phaseAccent[log.phase] ?? "rgba(255,255,255,0.08)",
                    color: "var(--text)"
                  }}
                >
                  {phaseLabel}
                </span>
              </header>

              {player && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                  <span>{t(settings.locale, "log.playerLabel")}</span>
                  <span style={{ width: "0.5rem", height: "0.5rem", borderRadius: 999, background: player.color }} />
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>{player.name}</span>
                </div>
              )}

              <p style={{ margin: "0.35rem 0", fontSize: "0.95rem", lineHeight: 1.4 }}>{message}</p>

              {log.payload && (
                <details style={{ marginTop: "0.5rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: "var(--muted)" }}>{t(settings.locale, "log.payloadSummary")}</summary>
                  <pre
                    style={{
                      margin: "0.35rem 0 0",
                      padding: "0.5rem",
                      borderRadius: "0.5rem",
                      background: "rgba(8,11,24,0.6)",
                      whiteSpace: "pre-wrap",
                      fontSize: "0.75rem",
                      color: "var(--muted)"
                    }}
                  >
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
