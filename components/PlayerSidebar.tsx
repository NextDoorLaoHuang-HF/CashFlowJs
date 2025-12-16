"use client";

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
        <dt style={{ color: "var(--muted)" }}>{t(locale, "players.bankLoanBalance")}</dt>
        <dd style={{ margin: 0, textAlign: "right" }}>${totalBalance.toLocaleString()}</dd>
        <dt style={{ color: "var(--muted)" }}>{t(locale, "players.bankLoanPayment")}</dt>
        <dd style={{ margin: 0, textAlign: "right" }}>${totalPayment.toLocaleString()}</dd>
      </>
    );
  };

  return (
    <div className="card scrollable" style={{ maxHeight: "600px" }}>
      <h3 style={{ marginTop: 0 }}>{t(locale, "players.title")}</h3>
      <div className="grid" style={{ gap: "0.75rem" }}>
        {players.map((player) => (
          <div
            key={player.id}
            style={{
              padding: "0.75rem",
              borderRadius: 12,
              background:
                player.status === "bankrupt"
                  ? "rgba(239,68,68,0.12)"
                  : player.id === currentPlayerId
                    ? "rgba(68, 208, 123, 0.15)"
                    : "rgba(255,255,255,0.03)",
              border:
                player.status === "bankrupt"
                  ? "1px solid rgba(239,68,68,0.45)"
                  : player.id === currentPlayerId
                    ? "1px solid rgba(68,208,123,0.5)"
                    : "1px solid rgba(255,255,255,0.05)",
              opacity: player.status === "bankrupt" ? 0.7 : 1
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: player.color,
                  border: "1px solid rgba(0,0,0,0.4)"
                }}
              />
              <strong>{player.name}</strong>
              {player.status === "bankrupt" && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: 999,
                    background: "rgba(239,68,68,0.25)",
                    color: "var(--text)"
                  }}
                >
                  {t(locale, "players.status.bankrupt")}
                </span>
              )}
              {player.track === "fastTrack" && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: 999,
                    background: "rgba(251,191,36,0.2)",
                    color: "var(--text)"
                  }}
                >
                  {t(locale, "players.track.fastTrack")}
                </span>
              )}
            </div>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0.25rem",
                margin: "0.5rem 0 0",
                fontSize: "0.85rem"
              }}
            >
              <dt style={{ color: "var(--muted)" }}>{t(locale, "players.cash")}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>${player.cash.toLocaleString()}</dd>
              <dt style={{ color: "var(--muted)" }}>{t(locale, "players.passive")}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>${player.passiveIncome.toLocaleString()}</dd>
              <dt style={{ color: "var(--muted)" }}>{t(locale, "players.payday")}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>${player.payday.toLocaleString()}</dd>
              <dt style={{ color: "var(--muted)" }}>{t(locale, "players.dream")}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>
                {player.dream ? t(locale, `dream.${player.dream.id}.title`) : "—"}
              </dd>
              {renderBankLoans(player)}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
