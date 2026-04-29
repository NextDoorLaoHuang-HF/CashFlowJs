"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../lib/state/gameStore";
import { useMultiplayerStore } from "../lib/multiplayer/syncStore";
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
  const { players, currentPlayerId, settings, turnState, repayBankLoan, loans, repayLoan, sellFireSaleAsset } = useGameStore((state) => ({
    players: state.players,
    currentPlayerId: state.currentPlayerId,
    settings: state.settings,
    turnState: state.turnState,
    repayBankLoan: state.repayBankLoan,
    loans: state.loans,
    repayLoan: state.repayLoan,
    sellFireSaleAsset: state.sellFireSaleAsset
  }));

  const playerSlot = useMultiplayerStore((s) => s.playerSlot);

  const viewPlayer = useMemo(() => {
    if (playerSlot !== null) {
      return players[playerSlot];
    }
    return players.find((player) => player.id === currentPlayerId);
  }, [players, currentPlayerId, playerSlot]);

  const [fireSaleQuantities, setFireSaleQuantities] = useState<Record<string, number>>({});

  // P4: reset fire-sale quantities when the viewed player changes
  useEffect(() => {
    setFireSaleQuantities({});
  }, [viewPlayer?.id]);

  const assetsByCategory = useMemo(() => groupAssetsByCategory(viewPlayer?.assets ?? []), [viewPlayer?.assets]);

  const bankLoans = useMemo(
    () => (viewPlayer?.liabilities ?? []).filter((liability) => liability.metadata?.bank),
    [viewPlayer?.liabilities]
  );

  const otherLiabilities = useMemo(
    () => (viewPlayer?.liabilities ?? []).filter((liability) => !liability.metadata?.bank),
    [viewPlayer?.liabilities]
  );

  const viewPlayerId = viewPlayer?.id;

  const playerLoans = useMemo(() => {
    const borrowerLoans = loans.filter((loan) => loan.status === "active" && loan.borrowerId === viewPlayerId);
    const lenderLoans = loans.filter((loan) => loan.status === "active" && loan.lenderId === viewPlayerId);
    return { borrowerLoans, lenderLoans };
  }, [loans, viewPlayerId]);

  if (!viewPlayer) {
    return null;
  }

  const canRepayNow = turnState === "awaitEnd";
  const showLoanActions = viewPlayer.track === "ratRace";
  const canFireSaleNow =
    viewPlayer.track === "ratRace" &&
    turnState !== "awaitCard" &&
    turnState !== "awaitMarket" &&
    turnState !== "awaitCharity" &&
    turnState !== "awaitLiquidation" &&
    viewPlayer.status !== "bankrupt";

  const renderAssetRow = (asset: Asset) => {
    const quantity = typeof asset.quantity === "number" && Number.isFinite(asset.quantity) ? Math.floor(asset.quantity) : 1;
    const symbol = typeof asset.metadata?.symbol === "string" ? asset.metadata.symbol : undefined;
    const units = getNumberFromMetadata(asset.metadata?.units);
    const mortgage = getNumberFromMetadata(asset.metadata?.mortgage);

    const sellQtyRaw = fireSaleQuantities[asset.id];
    const sellQty = Math.min(Math.max(1, Number.isFinite(sellQtyRaw) ? Math.floor(sellQtyRaw) : 1), quantity);

    return (
      <div key={asset.id} className="asset-row">
        <div className="asset-row-header">
          <strong>{asset.name}</strong>
          <span className="text-muted text-sm">
            {t(settings.locale, "portfolio.asset.cashflow")}: {formatMoney(asset.cashflow)}
          </span>
        </div>
        <dl className="kv-grid">
          <dt className="kv-key">{t(settings.locale, "portfolio.asset.cost")}</dt>
          <dd className="kv-value">{formatMoney(asset.cost)}</dd>
          <dt className="kv-key">{t(settings.locale, "portfolio.asset.quantity")}</dt>
          <dd className="kv-value">{quantity}</dd>
          {symbol && (
            <>
              <dt className="kv-key">{t(settings.locale, "portfolio.asset.symbol")}</dt>
              <dd className="kv-value">{symbol}</dd>
            </>
          )}
          {typeof units === "number" && (
            <>
              <dt className="kv-key">{t(settings.locale, "portfolio.asset.units")}</dt>
              <dd className="kv-value">{units}</dd>
            </>
          )}
          {typeof mortgage === "number" && mortgage > 0 && (
            <>
              <dt className="kv-key">{t(settings.locale, "portfolio.asset.mortgage")}</dt>
              <dd className="kv-value">{formatMoney(mortgage)}</dd>
            </>
          )}
        </dl>

        {canFireSaleNow && (
          <div className="asset-row-input" style={{ marginTop: "0.4rem" }}>
            {quantity > 1 && (
              <input
                type="number"
                min={1}
                max={quantity}
                value={sellQty}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setFireSaleQuantities((prev) => ({ ...prev, [asset.id]: Number.isFinite(next) ? next : 1 }));
                }}
                aria-label={t(settings.locale, "portfolio.fireSale.quantity")}
                className="field-input"
                style={{ width: "110px" }}
              />
            )}
            <button
              onClick={() => sellFireSaleAsset(asset.id, sellQty)}
              className="btn btn-danger btn-sm"
            >
              {t(settings.locale, "portfolio.fireSale.sell")}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderLiabilityRow = (liability: Liability) => {
    const isBank = Boolean(liability.metadata?.bank);
    const canRepayStep = showLoanActions && isBank && canRepayNow && liability.balance >= REPAY_STEP && viewPlayer.cash >= REPAY_STEP;
    const canPayoff = showLoanActions && isBank && canRepayNow && liability.balance > 0 && viewPlayer.cash >= liability.balance;

    return (
      <div key={liability.id} className="asset-row">
        <div className="asset-row-header">
          <strong>
            {liability.name}
            {isBank && (
              <span className="text-muted text-xs" style={{ marginLeft: "0.5rem" }}>
                {t(settings.locale, "portfolio.liability.bankFlag")}
              </span>
            )}
          </strong>
          <span className="text-muted text-sm">
            {t(settings.locale, "portfolio.liability.category")}: {liability.category}
          </span>
        </div>
        <dl className="kv-grid">
          <dt className="kv-key">{t(settings.locale, "bankLoans.balance")}</dt>
          <dd className="kv-value">{formatMoney(liability.balance)}</dd>
          <dt className="kv-key">{t(settings.locale, "bankLoans.payment")}</dt>
          <dd className="kv-value">{formatMoney(liability.payment)}</dd>
        </dl>

        {isBank && (
          <div className="action-row" style={{ marginTop: "0.4rem" }}>
            <button
              onClick={() => repayBankLoan(liability.id, REPAY_STEP)}
              disabled={!canRepayStep}
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
            >
              {t(settings.locale, "bankLoans.repayStep")}
            </button>
            <button
              onClick={() => repayBankLoan(liability.id, liability.balance)}
              disabled={!canPayoff}
              className="btn btn-primary btn-sm"
              style={{ flex: 1 }}
            >
              {t(settings.locale, "bankLoans.payoff")}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="panel" data-tour="portfolio-panel">
      <div className="panel-header">
        <h3 className="text-base" style={{ margin: 0 }}>{t(settings.locale, "portfolio.title")}</h3>
        <span className="text-muted text-sm">
          {t(settings.locale, "portfolio.player")}: {viewPlayer.name}
        </span>
      </div>

      <div className="panel-body">
        <details open>
          <summary style={{ cursor: "pointer" }}>
            {t(settings.locale, "portfolio.assets.title")} · {viewPlayer.assets.length}
          </summary>
          {viewPlayer.track === "ratRace" && (
            <p className="text-muted text-sm" style={{ margin: "0.35rem 0 0" }}>
              {t(settings.locale, "portfolio.fireSale.hint")}
            </p>
          )}
          {viewPlayer.assets.length === 0 ? (
            <p className="text-muted text-sm" style={{ margin: "0.5rem 0 0" }}>
              {t(settings.locale, "portfolio.assets.empty")}
            </p>
          ) : (
            <div className="panel-scrollable" style={{ marginTop: "0.35rem" }}>
              {assetCategoryOrder.map((category) => {
                const assets = assetsByCategory[category];
                if (!assets || assets.length === 0) return null;
                return (
                  <div key={category} style={{ marginBottom: "0.75rem" }}>
                    <div className="text-muted text-sm" style={{ marginBottom: "0.25rem" }}>
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
            {t(settings.locale, "portfolio.liabilities.title")} · {viewPlayer.liabilities.length}
          </summary>
          {viewPlayer.liabilities.length === 0 ? (
            <p className="text-muted text-sm" style={{ margin: "0.5rem 0 0" }}>
              {t(settings.locale, "portfolio.liabilities.empty")}
            </p>
          ) : (
            <div className="panel-scrollable" style={{ marginTop: "0.35rem" }}>
              {bankLoans.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <div className="text-muted text-sm" style={{ marginBottom: "0.25rem" }}>
                    {t(settings.locale, "portfolio.liabilities.bankLoans")}
                  </div>
                  <div>{bankLoans.map(renderLiabilityRow)}</div>
                </div>
              )}
              {otherLiabilities.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <div className="text-muted text-sm" style={{ marginBottom: "0.25rem" }}>
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
            <p className="text-muted text-sm" style={{ margin: "0.5rem 0 0" }}>
              {t(settings.locale, "portfolio.playerLoans.empty")}
            </p>
          ) : (
            <div className="panel-scrollable" style={{ marginTop: "0.35rem" }}>
              {playerLoans.borrowerLoans.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <div className="text-muted text-sm" style={{ marginBottom: "0.25rem" }}>
                    {t(settings.locale, "portfolio.playerLoans.borrowed")}
                  </div>
                  {playerLoans.borrowerLoans.map((loan) => {
                    const counterparty = getLoanCounterparty(loan, players, "borrower");
                    const canPayoff = showLoanActions && canRepayNow && viewPlayer.cash >= loan.remaining;
                    return (
                      <div key={loan.id} className="asset-row">
                        <div className="asset-row-header">
                          <strong>{counterparty}</strong>
                          <span className="text-muted text-sm">
                            {t(settings.locale, "loans.remaining")}: {formatMoney(loan.remaining)}
                          </span>
                        </div>
                        <button
                          onClick={() => repayLoan(loan.id, loan.remaining)}
                          disabled={!canPayoff}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: "0.4rem", width: "100%" }}
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
                  <div className="text-muted text-sm" style={{ marginBottom: "0.25rem" }}>
                    {t(settings.locale, "portfolio.playerLoans.lent")}
                  </div>
                  {playerLoans.lenderLoans.map((loan) => {
                    const counterparty = getLoanCounterparty(loan, players, "lender");
                    return (
                      <div key={loan.id} className="asset-row">
                        <div className="asset-row-header">
                          <strong>{counterparty}</strong>
                          <span className="text-muted text-sm">
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
    </div>
  );
}
