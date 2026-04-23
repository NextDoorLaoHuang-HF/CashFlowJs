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
    if (!Number.isFinite(value) || value === 0) return <span className="text-muted">0</span>;
    const formatted = `${value > 0 ? "+" : ""}${value.toLocaleString()}`;
    return <span style={{ color: value > 0 ? "rgba(34,197,94,0.9)" : "rgba(248,113,113,0.9)" }}>{formatted}</span>;
  };

  return (
    <div className="panel" data-tour="replay-panel">
      <div className="panel-header">
        <h3 className="text-base" style={{ margin: 0 }}>{t(locale, "replay.title")}</h3>
        <div className="action-row">
          <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
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
            className="btn btn-danger btn-sm"
          >
            {t(locale, "replay.clear")}
          </button>
        </div>
      </div>

      {!replay && <p className="text-muted text-sm" style={{ margin: 0 }}>{t(locale, "replay.empty")}</p>}
      {error && <p className="text-sm" style={{ margin: 0, color: "#f97316" }}>{error}</p>}

      {replay && (
        <div className="panel-body">
          <div className="replay-controls">
            <button onClick={goPrevTurn} disabled={currentTurnIndex <= 0} className="btn btn-sm btn-secondary">
              {t(locale, "replay.prevTurn")}
            </button>
            <button onClick={goPrevLog} disabled={cursor <= 0} className="btn btn-sm btn-secondary">
              {t(locale, "replay.prevLog")}
            </button>
            <div className="replay-slider">
              <input
                type="range"
                min={0}
                max={Math.max(0, replay.logs.length - 1)}
                value={cursor}
                onChange={(event) => jumpToLog(Number(event.target.value))}
              />
              <div className="replay-slider-info">
                <span className="text-xs text-muted">
                  {t(locale, "replay.logIndex")} {cursor + 1}/{replay.logs.length}
                </span>
                {typeof currentLog?.turn === "number" && (
                  <span className="text-xs text-muted">
                    {t(locale, "log.turnLabel")} #{currentLog.turn}
                  </span>
                )}
              </div>
            </div>
            <button onClick={goNextLog} disabled={cursor >= replay.logs.length - 1} className="btn btn-sm btn-secondary">
              {t(locale, "replay.nextLog")}
            </button>
            <button onClick={goNextTurn} disabled={currentTurnIndex < 0 || currentTurnIndex >= turnBounds.length - 1} className="btn btn-sm btn-secondary">
              {t(locale, "replay.nextTurn")}
            </button>
            {turnBounds.length > 0 && (
              <select
                value={typeof currentLog?.turn === "number" ? String(currentLog.turn) : ""}
                onChange={(event) => jumpToTurn(Number(event.target.value))}
                className="field-input"
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
            <div className="action-panel">
              <div className="panel-header">
                <div>
                  <strong className="text-sm">{t(locale, currentLog.message)}</strong>
                  <div className="text-xs text-muted">
                    {new Date(currentLog.timestamp).toLocaleString(locale)}
                  </div>
                </div>
                <div className="text-sm text-muted">
                  <span>{t(locale, `info.phase.${currentLog.phase}`)}</span>
                  {currentLog.playerId && <span>· {currentLog.playerId.slice(0, 4)}</span>}
                </div>
              </div>

              {currentLog.payload && (
                <details>
                  <summary className="text-xs text-muted" style={{ cursor: "pointer" }}>{t(locale, "log.payloadSummary")}</summary>
                  <pre className="replay-payload">
                    {JSON.stringify(currentLog.payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {!framesReady && (
            <p className="text-muted text-sm" style={{ margin: 0 }}>{t(locale, "replay.import.missingFramesHint")}</p>
          )}

          {framesReady && currentFrame && (
            <div className="panel-body">
              <div className="replay-table-wrap">
                <table className="replay-table">
                  <thead>
                    <tr>
                      <th>{t(locale, "replay.player")}</th>
                      <th>{t(locale, "players.cash")}</th>
                      <th>Δ</th>
                      <th>{t(locale, "players.passive")}</th>
                      <th>Δ</th>
                      <th>{t(locale, "players.payday")}</th>
                      <th>Δ</th>
                      <th>{t(locale, "portfolio.assets.title")}</th>
                      <th>{t(locale, "portfolio.liabilities.title")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentFrame.players.map((player) => {
                      const previous = previousFrame?.players.find((p) => p.id === player.id);
                      const cashDelta = previous ? player.cash - previous.cash : 0;
                      const passiveDelta = previous ? player.passiveIncome - previous.passiveIncome : 0;
                      const paydayDelta = previous ? player.payday - previous.payday : 0;
                      return (
                        <tr key={player.id}>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                              <span className="occupant-dot" style={{ background: player.color }} />
                              <span style={{ fontWeight: 600 }}>{player.name}</span>
                            </span>
                          </td>
                          <td>${player.cash.toLocaleString()}</td>
                          <td>{renderDelta(cashDelta)}</td>
                          <td>${player.passiveIncome.toLocaleString()}</td>
                          <td>{renderDelta(passiveDelta)}</td>
                          <td>${player.payday.toLocaleString()}</td>
                          <td>{renderDelta(paydayDelta)}</td>
                          <td>{player.assets.length}</td>
                          <td>{player.liabilities.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="panel-header">
                <strong className="text-sm">{t(locale, "replay.portfolioTitle")}</strong>
                <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                  <span className="text-muted text-sm">{t(locale, "replay.selectPlayer")}</span>
                  <select
                    value={effectivePlayerId}
                    onChange={(event) => setSelectedPlayerId(event.target.value)}
                    className="field-input"
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
                  <div className="panel-body">
                    <div className="kv-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                      <div className="panel" style={{ padding: "0.6rem 0.75rem" }}>
                        <div className="text-muted text-xs">{t(locale, "players.cash")}</div>
                        <div style={{ fontWeight: 700 }}>${player.cash.toLocaleString()}</div>
                      </div>
                      <div className="panel" style={{ padding: "0.6rem 0.75rem" }}>
                        <div className="text-muted text-xs">{t(locale, "players.payday")}</div>
                        <div style={{ fontWeight: 700 }}>${player.payday.toLocaleString()}</div>
                      </div>
                    </div>

                    <details open>
                      <summary style={{ cursor: "pointer" }}>
                        {t(locale, "portfolio.assets.title")} · {player.assets.length}
                      </summary>
                      {player.assets.length === 0 ? (
                        <p className="text-muted text-sm" style={{ margin: "0.5rem 0 0" }}>{t(locale, "portfolio.assets.empty")}</p>
                      ) : (
                        <div className="panel-scrollable">
                          {assetCategoryOrder.map((category) => {
                            const assets = assetsByCategory[category];
                            if (!assets || assets.length === 0) return null;
                            return (
                              <div key={category} style={{ marginBottom: "0.75rem" }}>
                                <div className="text-muted text-sm" style={{ marginBottom: "0.25rem" }}>
                                  {t(locale, `portfolio.assetCategory.${category}`)}
                                </div>
                                {assets.map((asset) => (
                                  <div key={asset.id} className="asset-row">
                                    <div className="asset-row-header">
                                      <strong>{asset.name}</strong>
                                      <span className="text-muted text-sm">
                                        {t(locale, "portfolio.asset.cashflow")}: ${asset.cashflow.toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="text-muted text-sm">
                                      {t(locale, "portfolio.asset.cost")}: ${asset.cost.toLocaleString()}
                                    </div>
                                  </div>
                                ))}
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
                        <p className="text-muted text-sm" style={{ margin: "0.5rem 0 0" }}>{t(locale, "portfolio.liabilities.empty")}</p>
                      ) : (
                        <div className="panel-scrollable">
                          {player.liabilities.map((liability) => (
                            <div key={liability.id} className="asset-row">
                              <div className="asset-row-header">
                                <strong>{liability.name}</strong>
                                <span className="text-muted text-sm">
                                  {t(locale, "bankLoans.payment")}: ${liability.payment.toLocaleString()}
                                </span>
                              </div>
                              <div className="text-muted text-sm">
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
