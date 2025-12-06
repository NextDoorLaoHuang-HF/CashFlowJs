"use client";

import { useState } from "react";
import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";

export function LoansPanel() {
  const { players, loans, addLoan, repayLoan, settings } = useGameStore((state) => ({
    players: state.players,
    loans: state.loans,
    addLoan: state.addLoan,
    repayLoan: state.repayLoan,
    settings: state.settings
  }));

  const [lender, setLender] = useState("");
  const [borrower, setBorrower] = useState("");
  const [principal, setPrincipal] = useState(5000);
  const [rate, setRate] = useState(10);

  const handleCreate = () => {
    if (!lender || !borrower || lender === borrower) return;
    addLoan({ lenderId: lender, borrowerId: borrower, principal, rate, issuedTurn: 0 });
    setLender("");
    setBorrower("");
  };

  return (
    <div className="card grid" style={{ gap: "0.6rem" }}>
      <h3 style={{ margin: 0 }}>{t(settings.locale, "loans.title")}</h3>
      <div className="grid" style={{ gap: "0.45rem" }}>
        <select
          value={lender}
          onChange={(e) => setLender(e.target.value)}
          style={{ borderRadius: 8, padding: "0.45rem 0.65rem", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff" }}
        >
          <option value="">{t(settings.locale, "loans.lender")}</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <select
          value={borrower}
          onChange={(e) => setBorrower(e.target.value)}
          style={{ borderRadius: 8, padding: "0.45rem 0.65rem", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff" }}
        >
          <option value="">{t(settings.locale, "loans.borrower")}</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
            placeholder={t(settings.locale, "loans.principal")}
            style={{
              flex: 1,
              borderRadius: 8,
              padding: "0.45rem 0.65rem",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff"
            }}
          />
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
            placeholder={t(settings.locale, "loans.apr")}
            style={{
              width: "120px",
              borderRadius: 8,
              padding: "0.45rem 0.65rem",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff"
            }}
          />
        </div>
        <button
          onClick={handleCreate}
          style={{
            borderRadius: 10,
            padding: "0.5rem",
            background: "rgba(14,165,233,0.3)",
            color: "#fff"
          }}
        >
          {t(settings.locale, "loans.new")}
        </button>
      </div>
      <div className="scrollable" style={{ maxHeight: "200px" }}>
        {loans.length === 0 && <p style={{ color: "var(--muted)" }}>{t(settings.locale, "loans.empty")}</p>}
        {loans.map((loan) => {
          const lenderPlayer = players.find((player) => player.id === loan.lenderId);
          const borrowerPlayer = players.find((player) => player.id === loan.borrowerId);
          return (
            <div key={loan.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <strong>
                {lenderPlayer?.name} → {borrowerPlayer?.name}
              </strong>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                ${loan.principal.toLocaleString()} @ {loan.rate}%
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.35rem" }}>
                <span style={{ fontSize: "0.85rem" }}>
                  {t(settings.locale, "loans.remaining")}: ${loan.remaining.toLocaleString()}
                </span>
                {loan.status === "active" && (
                  <button
                    onClick={() => repayLoan(loan.id, loan.remaining)}
                    style={{ borderRadius: 999, padding: "0.3rem 0.75rem", background: "rgba(34,197,94,0.3)", color: "#fff" }}
                  >
                    {t(settings.locale, "loans.payoff")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
