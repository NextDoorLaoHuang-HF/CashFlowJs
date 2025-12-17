"use client";

import { useMemo } from "react";
import { useGameStore } from "../lib/state/gameStore";
import { t } from "../lib/i18n";
import type { Asset, Liability, PlayerLoan } from "../lib/types";

const REPAY_STEP = 1000;

const formatMoney = (value: number) => `$${value.toLocaleString()}`;

const getNumberFromMetadata = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const assetCategoryOrder: Array<Asset["category"]> = ["stock", "realEstate", "business", "collectible", "other"];

const groupAssetsByCategory = (assets: Asset[]): Record<Asset["category"], Asset[]> =>
  assets.reduce<Record<Asset["category"], Asset[]>>(
    (acc, asset) => {
      acc[asset.category].push(asset);
      return acc;
    },
    { stock: [], realEstate: [], business: [], collectible: [], other: [] }
  );

const getLoanCounterparty = (loan: PlayerLoan, players: Array<{ id: string; name: string }>, perspective: "lender" | "borrower") => {
  const counterpartyId = perspective === "lender" ? loan.borrowerId : loan.lenderId;
  const player = players.find((p) => p.id === counterpartyId);
  return player?.name ?? counterpartyId.slice(0, 4);
};

export function PortfolioPanel() {
  const { players, currentPlayerId, settings, turnState, repayBankLoan, loans, repayLoan } = useGameStore((state) => ({
    players: state.players,
    currentPlayerId: state.currentPlayerId,
    settings: state.settings,
    turnState: state.turnState,
    repayBankLoan: state.repayBankLoan,
    loans: state.loans,
    repayLoan: state.repayLoan
  }));

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === currentPlayerId),
    [players, currentPlayerId]
  );

  const assetsByCategory = useMemo(() => groupAssetsByCategory(currentPlayer?.assets ?? []), [currentPlayer?.assets]);

  const bankLoans = useMemo(
    () => (currentPlayer?.liabilities ?? []).filter((liability) => liability.metadata?.bank),
    [currentPlayer?.liabilities]
  );

  const otherLiabilities = useMemo(
    () => (currentPlayer?.liabilities ?? []).filter((liability) => !liability.metadata?.bank),
    [currentPlayer?.liabilities]
  );

  const playerLoans = useMemo(() => {
    const borrowerLoans = loans.filter((loan) => loan.status === "active" && loan.borrowerId === currentPlayerId);
    const lenderLoans = loans.filter((loan) => loan.status === "active" && loan.lenderId === currentPlayerId);
    return { borrowerLoans, lenderLoans };
  }, [loans, currentPlayerId]);

  if (!currentPlayer) {
    return null;
  }

  const canRepayNow = turnState === "awaitEnd";
  const showLoanActions = currentPlayer.track === "ratRace";

  const renderAssetRow = (asset: Asset) => {
    const quantity = typeof asset.quantity === "number" && Number.isFinite(asset.quantity) ? Math.floor(asset.quantity) : 1;
    const symbol = typeof asset.metadata?.symbol === "string" ? asset.metadata.symbol : undefined;
    const units = getNumberFromMetadata(asset.metadata?.units);
    const mortgage = getNumberFromMetadata(asset.metadata?.mortgage);

    return (
      <div key={asset.id} style={{ padding: "0.55rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
          <strong>{asset.name}</strong>
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            {t(settings.locale, "portfolio.asset.cashflow")}: {formatMoney(asset.cashflow)}
          </span>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
          <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "portfolio.asset.cost")}</dt>
          <dd style={{ margin: 0, textAlign: "right" }}>{formatMoney(asset.cost)}</dd>
          <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "portfolio.asset.quantity")}</dt>
          <dd style={{ margin: 0, textAlign: "right" }}>{quantity}</dd>
          {symbol && (
            <>
              <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "portfolio.asset.symbol")}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>{symbol}</dd>
            </>
          )}
          {typeof units === "number" && (
            <>
              <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "portfolio.asset.units")}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>{units}</dd>
            </>
          )}
          {typeof mortgage === "number" && mortgage > 0 && (
            <>
              <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "portfolio.asset.mortgage")}</dt>
              <dd style={{ margin: 0, textAlign: "right" }}>{formatMoney(mortgage)}</dd>
            </>
          )}
        </dl>
      </div>
    );
  };

  const renderLiabilityRow = (liability: Liability) => {
    const isBank = Boolean(liability.metadata?.bank);
    const canRepayStep = showLoanActions && isBank && canRepayNow && liability.balance >= REPAY_STEP && currentPlayer.cash >= REPAY_STEP;
    const canPayoff = showLoanActions && isBank && canRepayNow && liability.balance > 0 && currentPlayer.cash >= liability.balance;

    return (
      <div key={liability.id} style={{ padding: "0.55rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
          <strong>
            {liability.name}
            {isBank && (
              <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                {t(settings.locale, "portfolio.liability.bankFlag")}
              </span>
            )}
          </strong>
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            {t(settings.locale, "portfolio.liability.category")}: {liability.category}
          </span>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
          <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "bankLoans.balance")}</dt>
          <dd style={{ margin: 0, textAlign: "right" }}>{formatMoney(liability.balance)}</dd>
          <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "bankLoans.payment")}</dt>
          <dd style={{ margin: 0, textAlign: "right" }}>{formatMoney(liability.payment)}</dd>
        </dl>

        {isBank && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
            <button
              onClick={() => repayBankLoan(liability.id, REPAY_STEP)}
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
              onClick={() => repayBankLoan(liability.id, liability.balance)}
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
        )}
      </div>
    );
  };

  return (
    <div className="card grid" style={{ gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>{t(settings.locale, "portfolio.title")}</h3>
        <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          {t(settings.locale, "portfolio.player")}: {currentPlayer.name}
        </div>
      </div>

      <details open>
        <summary style={{ cursor: "pointer" }}>
          {t(settings.locale, "portfolio.assets.title")} · {currentPlayer.assets.length}
        </summary>
        {currentPlayer.assets.length === 0 ? (
          <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            {t(settings.locale, "portfolio.assets.empty")}
          </p>
        ) : (
          <div className="scrollable" style={{ marginTop: "0.35rem", maxHeight: "260px" }}>
            {assetCategoryOrder.map((category) => {
              const assets = assetsByCategory[category];
              if (!assets || assets.length === 0) return null;
              return (
                <div key={category} style={{ marginBottom: "0.75rem" }}>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                    {t(settings.locale, `portfolio.assetCategory.${category}`)}
                  </div>
                  <div>{assets.map(renderAssetRow)}</div>
                </div>
              );
            })}
          </div>
        )}
      </details>

      <details open>
        <summary style={{ cursor: "pointer" }}>
          {t(settings.locale, "portfolio.liabilities.title")} · {currentPlayer.liabilities.length}
        </summary>
        {currentPlayer.liabilities.length === 0 ? (
          <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            {t(settings.locale, "portfolio.liabilities.empty")}
          </p>
        ) : (
          <div className="scrollable" style={{ marginTop: "0.35rem", maxHeight: "260px" }}>
            {bankLoans.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  {t(settings.locale, "portfolio.liabilities.bankLoans")}
                </div>
                <div>{bankLoans.map(renderLiabilityRow)}</div>
              </div>
            )}
            {otherLiabilities.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  {t(settings.locale, "portfolio.liabilities.other")}
                </div>
                <div>{otherLiabilities.map(renderLiabilityRow)}</div>
              </div>
            )}
          </div>
        )}
      </details>

      <details>
        <summary style={{ cursor: "pointer" }}>{t(settings.locale, "portfolio.playerLoans.title")}</summary>
        {playerLoans.borrowerLoans.length === 0 && playerLoans.lenderLoans.length === 0 ? (
          <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            {t(settings.locale, "portfolio.playerLoans.empty")}
          </p>
        ) : (
          <div className="scrollable" style={{ marginTop: "0.35rem", maxHeight: "220px" }}>
            {playerLoans.borrowerLoans.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  {t(settings.locale, "portfolio.playerLoans.borrowed")}
                </div>
                {playerLoans.borrowerLoans.map((loan) => {
                  const counterparty = getLoanCounterparty(loan, players, "borrower");
                  const canPayoff = showLoanActions && canRepayNow && currentPlayer.cash >= loan.remaining;
                  return (
                    <div key={loan.id} style={{ padding: "0.55rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                        <strong>{counterparty}</strong>
                        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                          {t(settings.locale, "loans.remaining")}: {formatMoney(loan.remaining)}
                        </span>
                      </div>
                      <button
                        onClick={() => repayLoan(loan.id, loan.remaining)}
                        disabled={!canPayoff}
                        style={{
                          marginTop: "0.4rem",
                          width: "100%",
                          borderRadius: 10,
                          padding: "0.4rem 0.75rem",
                          background: canPayoff ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)",
                          color: canPayoff ? "#fff" : "rgba(255,255,255,0.35)",
                          cursor: canPayoff ? "pointer" : "not-allowed"
                        }}
                      >
                        {t(settings.locale, "loans.payoff")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {playerLoans.lenderLoans.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  {t(settings.locale, "portfolio.playerLoans.lent")}
                </div>
                {playerLoans.lenderLoans.map((loan) => {
                  const counterparty = getLoanCounterparty(loan, players, "lender");
                  return (
                    <div key={loan.id} style={{ padding: "0.55rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                        <strong>{counterparty}</strong>
                        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                          {t(settings.locale, "loans.remaining")}: {formatMoney(loan.remaining)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </details>
    </div>
  );
}

