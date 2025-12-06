"use client";

import { useCallback } from "react";
import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";

export function GameLog() {
  const { logs, settings, clearLog } = useGameStore((state) => ({
    logs: state.logs,
    settings: state.settings,
    clearLog: state.clearLog
  }));

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

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
      <div className="scrollable" style={{ maxHeight: "260px" }}>
        {logs.length === 0 && <p style={{ color: "var(--muted)" }}>{t(settings.locale, "log.empty")}</p>}
        {logs.map((log) => (
          <div key={log.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted)" }}>
              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span>
                Turn {log.turn} · {log.phase}
              </span>
            </div>
            <div style={{ fontSize: "0.95rem" }}>{log.message}</div>
            {log.payload && (
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", color: "var(--muted)" }}>
                {JSON.stringify(log.payload, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
