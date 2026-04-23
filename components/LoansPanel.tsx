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
    <div className="panel">
      <h3 className="text-base" style={{ margin: 0 }}>{t(settings.locale, "loans.title")}</h3>
      <div className="panel-body">
        <select
          value={lender}
          onChange={(e) => setLender(e.target.value)}
          className="field-input"
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
          className="field-input"
        >
          <option value="">{t(settings.locale, "loans.borrower")}</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <div className="field-row">
          <div className="field">
            <input
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
              placeholder={t(settings.locale, "loans.principal")}
              className="field-input"
            />
          </div>
          <div className="field">
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value) || 0)}
              placeholder={t(settings.locale, "loans.apr")}
              className="field-input"
            />
          </div>
        </div>
        <button onClick={handleCreate} className="btn btn-primary">
          {t(settings.locale, "loans.new")}
        </button>
      </div>
      <div className="panel-scrollable">
        {loans.length === 0 && <p className="text-muted text-sm">{t(settings.locale, "loans.empty")}</p>}
        {loans.map((loan) => {
          const lenderPlayer = players.find((player) => player.id === loan.lenderId);
          const borrowerPlayer = players.find((player) => player.id === loan.borrowerId);
          return (
            <div key={loan.id} className="asset-row">
              <strong>
                {lenderPlayer?.name} → {borrowerPlayer?.name}
              </strong>
              <div className="text-muted text-sm">
                ${loan.principal.toLocaleString()} @ {loan.rate}%
              </div>
              <div className="action-row" style={{ marginTop: "0.35rem" }}>
                <span className="text-sm">
                  {t(settings.locale, "loans.remaining")}: ${loan.remaining.toLocaleString()}
                </span>
                {loan.status === "active" && (
                  <button
                    onClick={() => repayLoan(loan.id, loan.remaining)}
                    className="btn btn-primary btn-sm"
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
