"use client";

import { clsx } from "clsx";
import { t } from "../lib/i18n";
import { useGameStore } from "../lib/state/gameStore";

export function PlayerSidebar() {
  const { players, currentPlayerId, locale } = useGameStore((state) => ({
    players: state.players,
    currentPlayerId: state.currentPlayerId,
    locale: state.settings.locale
  }));

  const renderBankLoans = (player: (typeof players)[number]) => {
    const bankLoans = player.liabilities.filter((liability) => liability.metadata?.bank);
    if (bankLoans.length === 0) return null;
    const totalBalance = bankLoans.reduce((sum, loan) => sum + (loan.balance || 0), 0);
    const totalPayment = bankLoans.reduce((sum, loan) => sum + (loan.payment || 0), 0);
    return (
      <>
        <dt className="kv-key">{t(locale, "players.bankLoanBalance")}</dt>
        <dd className="kv-value">${totalBalance.toLocaleString()}</dd>
        <dt className="kv-key">{t(locale, "players.bankLoanPayment")}</dt>
        <dd className="kv-value">${totalPayment.toLocaleString()}</dd>
      </>
    );
  };

  return (
    <div className="panel panel-scrollable">
      <h3 className="text-base" style={{ margin: "0 0 0.75rem" }}>{t(locale, "players.title")}</h3>
      <div className="panel-body">
        {players.map((player) => (
          <div
            key={player.id}
            className={clsx("player-card", {
              "player-card-active": player.id === currentPlayerId && player.status !== "bankrupt",
              "player-card-bankrupt": player.status === "bankrupt"
            })}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="occupant-dot" style={{ background: player.color, width: 16, height: 16 }} />
              <strong>{player.name}</strong>
              {player.status === "bankrupt" && (
                <span className="chip" style={{ background: "rgba(239,68,68,0.25)", color: "var(--text)" }}>
                  {t(locale, "players.status.bankrupt")}
                </span>
              )}
              {player.track === "fastTrack" && (
                <span className="chip" style={{ background: "rgba(251,191,36,0.2)", color: "var(--text)" }}>
                  {t(locale, "players.track.fastTrack")}
                </span>
              )}
            </div>
            <dl className="kv-grid" style={{ marginTop: "0.5rem" }}>
              <dt className="kv-key">{t(locale, "players.cash")}</dt>
              <dd className="kv-value">${player.cash.toLocaleString()}</dd>
              <dt className="kv-key">{t(locale, "players.passive")}</dt>
              <dd className="kv-value">${player.passiveIncome.toLocaleString()}</dd>
              <dt className="kv-key">{t(locale, "players.payday")}</dt>
              <dd className="kv-value">${player.payday.toLocaleString()}</dd>
              <dt className="kv-key">{t(locale, "players.dream")}</dt>
              <dd className="kv-value">{player.dream ? t(locale, `dream.${player.dream.id}.title`) : "—"}</dd>
              {renderBankLoans(player)}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
