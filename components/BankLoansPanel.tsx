"use client";

import { useMemo } from "react";
import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";

const REPAY_STEP = 1000;

export function BankLoansPanel() {
  const { players, currentPlayerId, repayBankLoan, settings, turnState } = useGameStore((state) => ({
    players: state.players,
    currentPlayerId: state.currentPlayerId,
    repayBankLoan: state.repayBankLoan,
    settings: state.settings,
    turnState: state.turnState
  }));

  const currentPlayer = useMemo(() => players.find((player) => player.id === currentPlayerId), [players, currentPlayerId]);
  const bankLoans = useMemo(
    () => currentPlayer?.liabilities.filter((liability) => liability.metadata?.bank) ?? [],
    [currentPlayer]
  );

  if (!currentPlayer || currentPlayer.track !== "ratRace") {
    return null;
  }

  if (bankLoans.length === 0) {
    return null;
  }

  const canRepayNow = turnState === "awaitEnd";

  return (
    <div className="card grid" style={{ gap: "0.6rem" }}>
      <h3 style={{ margin: 0 }}>{t(settings.locale, "bankLoans.title")}</h3>
      <div className="scrollable" style={{ maxHeight: "220px" }}>
        {bankLoans.map((loan) => {
          const canRepayStep = canRepayNow && loan.balance >= REPAY_STEP && currentPlayer.cash >= REPAY_STEP;
          const canPayoff = canRepayNow && loan.balance > 0 && currentPlayer.cash >= loan.balance;
          return (
            <div key={loan.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <strong>{loan.name}</strong>
              <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "bankLoans.balance")}</dt>
                <dd style={{ margin: 0, textAlign: "right" }}>${loan.balance.toLocaleString()}</dd>
                <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "bankLoans.payment")}</dt>
                <dd style={{ margin: 0, textAlign: "right" }}>${loan.payment.toLocaleString()}</dd>
              </dl>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                <button
                  onClick={() => repayBankLoan(loan.id, REPAY_STEP)}
                  disabled={!canRepayStep}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    padding: "0.4rem 0.75rem",
                    background: canRepayStep ? "rgba(14,165,233,0.28)" : "rgba(255,255,255,0.06)",
                    color: canRepayStep ? "#fff" : "rgba(255,255,255,0.35)",
                    cursor: canRepayStep ? "pointer" : "not-allowed"
                  }}
                >
                  {t(settings.locale, "bankLoans.repayStep")}
                </button>
                <button
                  onClick={() => repayBankLoan(loan.id, loan.balance)}
                  disabled={!canPayoff}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    padding: "0.4rem 0.75rem",
                    background: canPayoff ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)",
                    color: canPayoff ? "#fff" : "rgba(255,255,255,0.35)",
                    cursor: canPayoff ? "pointer" : "not-allowed"
                  }}
                >
                  {t(settings.locale, "bankLoans.payoff")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

