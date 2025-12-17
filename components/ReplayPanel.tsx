"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { t } from "../lib/i18n";
import { useGameStore } from "../lib/state/gameStore";
import type { Asset, GameLogEntry, GameReplayFrame } from "../lib/types";

type ImportedReplay = {
  format?: string;
  exportedAt?: string;
  logs: GameLogEntry[];
  frames?: GameReplayFrame[];
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const parseImportedReplay = (raw: unknown): ImportedReplay | null => {
  if (Array.isArray(raw)) {
    return { logs: raw as GameLogEntry[] };
  }
  if (!isObject(raw)) return null;
  const logs = raw.logs;
  if (!Array.isArray(logs)) return null;
  const frames = Array.isArray(raw.frames) ? (raw.frames as GameReplayFrame[]) : undefined;
  const format = typeof raw.format === "string" ? raw.format : undefined;
  const exportedAt = typeof raw.exportedAt === "string" ? raw.exportedAt : undefined;
  return { logs: logs as GameLogEntry[], frames, format, exportedAt };
};

const groupAssetsByCategory = (assets: Asset[]): Record<Asset["category"], Asset[]> =>
  assets.reduce<Record<Asset["category"], Asset[]>>(
    (acc, asset) => {
      acc[asset.category].push(asset);
      return acc;
    },
    { stock: [], realEstate: [], business: [], collectible: [], other: [] }
  );

const assetCategoryOrder: Array<Asset["category"]> = ["stock", "realEstate", "business", "collectible", "other"];

export function ReplayPanel() {
  const locale = useGameStore((state) => state.settings.locale);
  const [replay, setReplay] = useState<ImportedReplay | null>(null);
  const [cursor, setCursor] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const framesReady = Boolean(
    replay?.frames && replay.frames.length > 0 && replay.frames.length === replay.logs.length
  );

  const turnBounds = useMemo(() => {
    if (!replay) return [];
    const bounds = new Map<number, { turn: number; first: number; last: number }>();
    replay.logs.forEach((log, index) => {
      const entryTurn = typeof log.turn === "number" ? log.turn : 0;
      const existing = bounds.get(entryTurn);
      if (!existing) {
        bounds.set(entryTurn, { turn: entryTurn, first: index, last: index });
      } else {
        existing.last = index;
      }
    });
    return Array.from(bounds.values()).sort((a, b) => a.turn - b.turn);
  }, [replay]);

  const currentLog = replay?.logs[cursor];
  const currentFrame = framesReady ? replay?.frames?.[cursor] : undefined;
  const previousFrame = framesReady && cursor > 0 ? replay?.frames?.[cursor - 1] : undefined;

  const currentTurnIndex = useMemo(() => {
    const turn = currentLog?.turn;
    if (typeof turn !== "number") return -1;
    return turnBounds.findIndex((bound) => bound.turn === turn);
  }, [currentLog?.turn, turnBounds]);

  const effectivePlayerId = useMemo(() => {
    const players = currentFrame?.players ?? [];
    if (players.length === 0) return "";
    if (selectedPlayerId && players.some((player) => player.id === selectedPlayerId)) return selectedPlayerId;
    const fallback = currentFrame?.currentPlayerId && players.some((player) => player.id === currentFrame.currentPlayerId) ? currentFrame.currentPlayerId : "";
    return fallback || players[0].id;
  }, [currentFrame?.currentPlayerId, currentFrame?.players, selectedPlayerId]);

  const handleFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const imported = parseImportedReplay(parsed);
      if (!imported) {
        setError(t(locale, "replay.import.invalid"));
        setReplay(null);
        return;
      }
      if (imported.frames && imported.frames.length !== imported.logs.length) {
        setError(t(locale, "replay.import.frameMismatch"));
      } else if (!imported.frames || imported.frames.length === 0) {
        setError(t(locale, "replay.import.missingFrames"));
      } else {
        setError("");
      }
      setReplay(imported);
      setCursor(0);
      setSelectedPlayerId("");
    } catch {
      setError(t(locale, "replay.import.invalid"));
      setReplay(null);
    }
  }, [locale]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      void handleFile(file);
      event.target.value = "";
    },
    [handleFile]
  );

  const jumpToLog = useCallback(
    (index: number) => {
      if (!replay) return;
      const clamped = Math.min(Math.max(0, Math.floor(index)), Math.max(0, replay.logs.length - 1));
      setCursor(clamped);
    },
    [replay]
  );

  const jumpToTurn = useCallback(
    (turn: number) => {
      const bound = turnBounds.find((b) => b.turn === turn);
      if (!bound) return;
      jumpToLog(bound.last);
    },
    [jumpToLog, turnBounds]
  );

  const goPrevLog = useCallback(() => jumpToLog(cursor - 1), [cursor, jumpToLog]);
  const goNextLog = useCallback(() => jumpToLog(cursor + 1), [cursor, jumpToLog]);

  const goPrevTurn = useCallback(() => {
    if (currentTurnIndex <= 0) return;
    const previous = turnBounds[currentTurnIndex - 1];
    if (!previous) return;
    jumpToLog(previous.last);
  }, [currentTurnIndex, jumpToLog, turnBounds]);

  const goNextTurn = useCallback(() => {
    if (currentTurnIndex < 0) return;
    const next = turnBounds[currentTurnIndex + 1];
    if (!next) return;
    jumpToLog(next.last);
  }, [currentTurnIndex, jumpToLog, turnBounds]);

  const renderDelta = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return <span style={{ color: "var(--muted)" }}>0</span>;
    const formatted = `${value > 0 ? "+" : ""}${value.toLocaleString()}`;
    return <span style={{ color: value > 0 ? "rgba(34,197,94,0.9)" : "rgba(248,113,113,0.9)" }}>{formatted}</span>;
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>{t(locale, "replay.title")}</h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0.75rem",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer"
            }}
          >
            <input type="file" accept="application/json" onChange={handleFileChange} style={{ display: "none" }} />
            {t(locale, "replay.import")}
          </label>
          <button
            onClick={() => {
              setReplay(null);
              setCursor(0);
              setSelectedPlayerId("");
              setError("");
            }}
            style={{ background: "rgba(248,113,113,0.2)", borderRadius: 999, padding: "0.35rem 0.75rem" }}
          >
            {t(locale, "replay.clear")}
          </button>
        </div>
      </div>

      {!replay && <p style={{ margin: 0, color: "var(--muted)" }}>{t(locale, "replay.empty")}</p>}
      {error && <p style={{ margin: 0, color: "#f97316" }}>{error}</p>}

      {replay && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <button
              onClick={goPrevTurn}
              disabled={currentTurnIndex <= 0}
              style={{ padding: "0.35rem 0.6rem", borderRadius: 10, background: "rgba(255,255,255,0.06)" }}
            >
              {t(locale, "replay.prevTurn")}
            </button>
            <button
              onClick={goPrevLog}
              disabled={cursor <= 0}
              style={{ padding: "0.35rem 0.6rem", borderRadius: 10, background: "rgba(255,255,255,0.06)" }}
            >
              {t(locale, "replay.prevLog")}
            </button>
            <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <input
                type="range"
                min={0}
                max={Math.max(0, replay.logs.length - 1)}
                value={cursor}
                onChange={(event) => jumpToLog(Number(event.target.value))}
              />
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "0.8rem" }}>
                <span>
                  {t(locale, "replay.logIndex")} {cursor + 1}/{replay.logs.length}
                </span>
                {typeof currentLog?.turn === "number" && (
                  <span>
                    {t(locale, "log.turnLabel")} #{currentLog.turn}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={goNextLog}
              disabled={cursor >= replay.logs.length - 1}
              style={{ padding: "0.35rem 0.6rem", borderRadius: 10, background: "rgba(255,255,255,0.06)" }}
            >
              {t(locale, "replay.nextLog")}
            </button>
            <button
              onClick={goNextTurn}
              disabled={currentTurnIndex < 0 || currentTurnIndex >= turnBounds.length - 1}
              style={{ padding: "0.35rem 0.6rem", borderRadius: 10, background: "rgba(255,255,255,0.06)" }}
            >
              {t(locale, "replay.nextTurn")}
            </button>
            {turnBounds.length > 0 && (
              <select
                value={typeof currentLog?.turn === "number" ? String(currentLog.turn) : ""}
                onChange={(event) => jumpToTurn(Number(event.target.value))}
                style={{ padding: "0.35rem 0.6rem", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "#fff" }}
              >
                {turnBounds.map((bound) => (
                  <option key={bound.turn} value={bound.turn}>
                    {t(locale, "log.turnLabel")} #{bound.turn}
                  </option>
                ))}
              </select>
            )}
          </div>

          {currentLog && (
            <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "0.75rem", background: "rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <strong style={{ fontSize: "0.95rem" }}>{t(locale, currentLog.message)}</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {new Date(currentLog.timestamp).toLocaleString(locale)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
                  <span>{t(locale, `info.phase.${currentLog.phase}`)}</span>
                  {currentLog.playerId && <span>· {currentLog.playerId.slice(0, 4)}</span>}
                </div>
              </div>

              {currentLog.payload && (
                <details style={{ marginTop: "0.5rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: "var(--muted)" }}>{t(locale, "log.payloadSummary")}</summary>
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
                    {JSON.stringify(currentLog.payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {!framesReady && (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>{t(locale, "replay.import.missingFramesHint")}</p>
          )}

          {framesReady && currentFrame && (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                      <th style={{ padding: "0.35rem 0.5rem" }}>{t(locale, "replay.player")}</th>
                      <th style={{ padding: "0.35rem 0.5rem" }}>{t(locale, "players.cash")}</th>
                      <th style={{ padding: "0.35rem 0.5rem" }}>Δ</th>
                      <th style={{ padding: "0.35rem 0.5rem" }}>{t(locale, "players.passive")}</th>
                      <th style={{ padding: "0.35rem 0.5rem" }}>Δ</th>
                      <th style={{ padding: "0.35rem 0.5rem" }}>{t(locale, "players.payday")}</th>
                      <th style={{ padding: "0.35rem 0.5rem" }}>Δ</th>
                      <th style={{ padding: "0.35rem 0.5rem" }}>{t(locale, "portfolio.assets.title")}</th>
                      <th style={{ padding: "0.35rem 0.5rem" }}>{t(locale, "portfolio.liabilities.title")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentFrame.players.map((player) => {
                      const previous = previousFrame?.players.find((p) => p.id === player.id);
                      const cashDelta = previous ? player.cash - previous.cash : 0;
                      const passiveDelta = previous ? player.passiveIncome - previous.passiveIncome : 0;
                      const paydayDelta = previous ? player.payday - previous.payday : 0;
                      return (
                        <tr key={player.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <td style={{ padding: "0.4rem 0.5rem" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: player.color }} />
                              <span style={{ color: "var(--text)", fontWeight: 600 }}>{player.name}</span>
                            </span>
                          </td>
                          <td style={{ padding: "0.4rem 0.5rem" }}>${player.cash.toLocaleString()}</td>
                          <td style={{ padding: "0.4rem 0.5rem" }}>{renderDelta(cashDelta)}</td>
                          <td style={{ padding: "0.4rem 0.5rem" }}>${player.passiveIncome.toLocaleString()}</td>
                          <td style={{ padding: "0.4rem 0.5rem" }}>{renderDelta(passiveDelta)}</td>
                          <td style={{ padding: "0.4rem 0.5rem" }}>${player.payday.toLocaleString()}</td>
                          <td style={{ padding: "0.4rem 0.5rem" }}>{renderDelta(paydayDelta)}</td>
                          <td style={{ padding: "0.4rem 0.5rem" }}>{player.assets.length}</td>
                          <td style={{ padding: "0.4rem 0.5rem" }}>{player.liabilities.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                <strong>{t(locale, "replay.portfolioTitle")}</strong>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
                  {t(locale, "replay.selectPlayer")}
                  <select
                    value={effectivePlayerId}
                    onChange={(event) => setSelectedPlayerId(event.target.value)}
                    style={{ padding: "0.35rem 0.6rem", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "#fff" }}
                  >
                    {currentFrame.players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {(() => {
                const player = currentFrame.players.find((p) => p.id === effectivePlayerId);
                if (!player) return null;
                const assetsByCategory = groupAssetsByCategory(player.assets);
                return (
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
                      <div style={{ padding: "0.6rem 0.75rem", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{t(locale, "players.cash")}</div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>${player.cash.toLocaleString()}</div>
                      </div>
                      <div style={{ padding: "0.6rem 0.75rem", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{t(locale, "players.payday")}</div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>${player.payday.toLocaleString()}</div>
                      </div>
                    </div>

                    <details open>
                      <summary style={{ cursor: "pointer" }}>
                        {t(locale, "portfolio.assets.title")} · {player.assets.length}
                      </summary>
                      {player.assets.length === 0 ? (
                        <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                          {t(locale, "portfolio.assets.empty")}
                        </p>
                      ) : (
                        <div className="scrollable" style={{ marginTop: "0.35rem", maxHeight: "220px" }}>
                          {assetCategoryOrder.map((category) => {
                            const assets = assetsByCategory[category];
                            if (!assets || assets.length === 0) return null;
                            return (
                              <div key={category} style={{ marginBottom: "0.75rem" }}>
                                <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                                  {t(locale, `portfolio.assetCategory.${category}`)}
                                </div>
                                <div>
                                  {assets.map((asset) => (
                                    <div key={asset.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                                        <strong>{asset.name}</strong>
                                        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                                          {t(locale, "portfolio.asset.cashflow")}: ${asset.cashflow.toLocaleString()}
                                        </span>
                                      </div>
                                      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                                        {t(locale, "portfolio.asset.cost")}: ${asset.cost.toLocaleString()}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </details>

                    <details open>
                      <summary style={{ cursor: "pointer" }}>
                        {t(locale, "portfolio.liabilities.title")} · {player.liabilities.length}
                      </summary>
                      {player.liabilities.length === 0 ? (
                        <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                          {t(locale, "portfolio.liabilities.empty")}
                        </p>
                      ) : (
                        <div className="scrollable" style={{ marginTop: "0.35rem", maxHeight: "220px" }}>
                          {player.liabilities.map((liability) => (
                            <div key={liability.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                                <strong>{liability.name}</strong>
                                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                                  {t(locale, "bankLoans.payment")}: ${liability.payment.toLocaleString()}
                                </span>
                              </div>
                              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                                {t(locale, "bankLoans.balance")}: ${liability.balance.toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </details>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
