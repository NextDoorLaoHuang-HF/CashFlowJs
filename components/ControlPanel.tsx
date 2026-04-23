"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { t } from "../lib/i18n";
import { useIsMobile } from "../lib/hooks/useIsMobile";
import { translateCardText } from "../lib/cardTranslations";
import { type DeckKey, useGameStore } from "../lib/state/gameStore";
import {
  cardMentionsEveryone,
  getAssetAvailableQuantity,
  isOfferForcedLimitedSaleCard,
  isOfferImproveCard,
  isOfferSellCard,
  isStockSplitEventCard,
  isTradeableSecurityCard,
  matchesOffer
} from "../lib/state/marketRules";
import { BottomSheet } from "./BottomSheet";
import { DiceDisplay } from "./DiceDisplay";

const deckLabels: Record<DeckKey, string> = {
  smallDeals: "controls.drawSmall",
  bigDeals: "controls.drawBig",
  doodads: "controls.drawDoodad",
  offers: "controls.drawOffer"
};

const deckOrder: DeckKey[] = ["smallDeals", "bigDeals", "doodads", "offers"];

export function ControlPanel() {
  const {
    rollDice,
    drawCard,
    applySelectedCard,
    passSelectedCard,
    resolveMarket,
    marketSession,
    setMarketSellQuantity,
    setMarketBuyQuantity,
    confirmMarketStep,
    skipMarketAll,
    getCardPreview,
    selectedCard,
    dice,
    settings,
    nextPlayer,
    currentPlayerId,
    turnState,
    charityPrompt,
    donateCharity,
    skipCharity,
    board,
    fastTrackBoard,
    players,
    enterFastTrack,
    liquidationSession,
    sellLiquidationAsset,
    finalizeLiquidation
  } = useGameStore((state) => ({
    rollDice: state.rollDice,
    drawCard: state.drawCard,
    applySelectedCard: state.applySelectedCard,
    passSelectedCard: state.passSelectedCard,
    resolveMarket: state.resolveMarket,
    marketSession: state.marketSession,
    setMarketSellQuantity: state.setMarketSellQuantity,
    setMarketBuyQuantity: state.setMarketBuyQuantity,
    confirmMarketStep: state.confirmMarketStep,
    skipMarketAll: state.skipMarketAll,
    getCardPreview: state.getCardPreview,
    selectedCard: state.selectedCard,
    dice: state.dice,
    settings: state.settings,
    nextPlayer: state.nextPlayer,
    currentPlayerId: state.currentPlayerId,
    turnState: state.turnState,
    charityPrompt: state.charityPrompt,
    donateCharity: state.donateCharity,
    skipCharity: state.skipCharity,
    board: state.board,
    fastTrackBoard: state.fastTrackBoard,
    players: state.players,
    enterFastTrack: state.enterFastTrack,
    liquidationSession: state.liquidationSession,
    sellLiquidationAsset: state.sellLiquidationAsset,
    finalizeLiquidation: state.finalizeLiquidation
  }));

  const isMobile = useIsMobile();
  const [diceRolling, setDiceRolling] = useState(false);
  const currentPlayer = useMemo(() => players.find((player) => player.id === currentPlayerId), [players, currentPlayerId]);
  const [liquidationQuantities, setLiquidationQuantities] = useState<Record<string, number>>({});
  const currentSquare = useMemo(() => {
    if (!currentPlayer) return undefined;
    const trackSquares = currentPlayer.track === "fastTrack" ? fastTrackBoard : board;
    return trackSquares[currentPlayer.position];
  }, [board, fastTrackBoard, currentPlayer]);
  const cardPreview = useMemo(
    () => (selectedCard ? getCardPreview(selectedCard, currentPlayerId ?? undefined) : null),
    [selectedCard, getCardPreview, currentPlayerId]
  );
  const cardCost = cardPreview?.cost ?? 0;
  const cardCashflow = cardPreview?.cashflow ?? 0;
  const isOpportunitySquare = currentPlayer?.track === "ratRace" && currentSquare?.type === "OPPORTUNITY";
  const dealsDisabled = !settings.enableSmallDeals && !settings.enableBigDeals;
  const charityPending = charityPrompt && charityPrompt.playerId === currentPlayerId;
  const canRoll = turnState === "awaitRoll" && !charityPending && !selectedCard;
  const canEndTurn = (turnState === "awaitEnd" || turnState === "awaitCharity") && !selectedCard;

  const canDrawDeck = (deck: DeckKey) => {
    if (turnState !== "awaitAction") return false;
    if (!currentPlayer || currentPlayer.track === "fastTrack") return false;
    if (selectedCard) return false;
    if (deck === "smallDeals") return settings.enableSmallDeals && isOpportunitySquare;
    if (deck === "bigDeals") return settings.enableBigDeals && isOpportunitySquare;
    return false;
  };

  const primaryActionKey = useMemo(() => {
    if (!cardPreview) return "controls.buy";
    if (cardPreview.primaryAction === "pay") return "controls.pay";
    if (cardPreview.primaryAction === "resolve") return "controls.resolve";
    return "controls.buy";
  }, [cardPreview]);
  const isExpense = cardPreview?.primaryAction === "pay";
  const canPass = Boolean(cardPreview?.canPass) && turnState === "awaitCard";
  const requiresCashOnHand = currentPlayer?.track === "fastTrack";
  const canApply = turnState === "awaitCard" && (!requiresCashOnHand || cardCost <= (currentPlayer?.cash ?? 0));

  const selectedCardId = selectedCard?.id;
  const activeMarketSession = useMemo(() => {
    if (!selectedCardId || !marketSession) return undefined;
    return marketSession.cardId === selectedCardId ? marketSession : undefined;
  }, [marketSession, selectedCardId]);

  const hasActivePanel = Boolean(selectedCard) || (charityPrompt && charityPrompt.playerId === currentPlayerId) || (turnState === "awaitLiquidation" && liquidationSession?.playerId === currentPlayer?.id);

  const renderDiceRow = () => {
    if (!dice) return null;
    return (
      <div className="dice-row">
        <DiceDisplay
          dice={dice.dice}
          total={dice.total}
          isRolling={diceRolling}
          size="md"
        />
        <span className="text-muted text-sm">
          {t(settings.locale, "controls.playerId")}: {currentPlayerId?.slice(0, 4)}
        </span>
      </div>
    );
  };

  const renderCharity = () => {
    if (!charityPrompt || charityPrompt.playerId !== currentPlayerId) return null;
    return (
      <div className="charity-panel">
        <strong>{t(settings.locale, "controls.charity.title")}</strong>
        <p className="text-muted text-sm" style={{ margin: 0 }}>{t(settings.locale, "controls.charity.prompt")}</p>
        <div className="text-sm">
          {t(settings.locale, "controls.charity.amountLabel")}: ${charityPrompt.amount.toLocaleString()}
        </div>
        <div className="action-row">
          <button onClick={donateCharity} className="btn btn-primary" style={{ flex: 1 }}>
            {t(settings.locale, "controls.charity.donate")}
          </button>
          <button onClick={skipCharity} className="btn btn-secondary" style={{ flex: 1 }}>
            {t(settings.locale, "controls.charity.skip")}
          </button>
        </div>
      </div>
    );
  };

  const renderLiquidation = () => {
    if (turnState !== "awaitLiquidation" || !liquidationSession || !currentPlayer || liquidationSession.playerId !== currentPlayer.id) return null;
    const shortfall = Math.max(liquidationSession.requiredCash - currentPlayer.cash, 0);
    return (
      <div className="action-panel">
        <div className="panel-header">
          <div>
            <strong>{t(settings.locale, "liquidation.title")}</strong>
            <div className="text-muted text-sm">{t(settings.locale, "liquidation.hint")}</div>
          </div>
          <span className="text-muted text-sm">{t(settings.locale, "liquidation.windowTitle")}</span>
        </div>

        <dl className="kv-grid">
          <dt className="kv-key">{t(settings.locale, "liquidation.required")}</dt>
          <dd className="kv-value">${liquidationSession.requiredCash.toLocaleString()}</dd>
          <dt className="kv-key">{t(settings.locale, "liquidation.cash")}</dt>
          <dd className="kv-value">${currentPlayer.cash.toLocaleString()}</dd>
          <dt className="kv-key">{t(settings.locale, "liquidation.shortfall")}</dt>
          <dd className="kv-value">${shortfall.toLocaleString()}</dd>
        </dl>

        {currentPlayer.assets.length === 0 ? (
          <div className="panel" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="text-muted text-sm">{t(settings.locale, "liquidation.noAssets")}</div>
          </div>
        ) : (
          <div className="panel" style={{ background: "rgba(255,255,255,0.02)" }}>
            {currentPlayer.assets.map((asset) => {
              const available = getAssetAvailableQuantity(asset);
              const currentValue = liquidationQuantities[asset.id] ?? Math.min(1, available);
              const normalized = Math.min(Math.max(0, Math.floor(currentValue)), available);
              const canSell = normalized > 0 && available > 0;
              return (
                <div key={asset.id} className="asset-row">
                  <span className="asset-row-header">
                    <span>
                      {asset.name} <span className="text-muted">· {t(settings.locale, "market.available")}: {available}</span>
                    </span>
                    <span className="text-muted">{t(settings.locale, "market.cashflow")}: ${asset.cashflow.toLocaleString()}</span>
                  </span>
                  <div className="asset-row-input">
                    <input
                      type="number"
                      min={0}
                      max={available}
                      step={1}
                      value={normalized}
                      onChange={(e) => {
                        const raw = Math.floor(Number(e.target.value) || 0);
                        setLiquidationQuantities((prev) => ({ ...prev, [asset.id]: raw }));
                      }}
                      className="field-input"
                    />
                    <button
                      onClick={() => sellLiquidationAsset(asset.id, normalized)}
                      disabled={!canSell}
                      className="btn btn-danger btn-sm"
                    >
                      {t(settings.locale, "liquidation.sell")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="action-row">
          <button
            onClick={finalizeLiquidation}
            disabled={currentPlayer.cash < liquidationSession.requiredCash}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {t(settings.locale, "liquidation.pay")}
          </button>
          <button
            onClick={finalizeLiquidation}
            disabled={currentPlayer.cash >= liquidationSession.requiredCash}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            {t(settings.locale, "liquidation.bankrupt")}
          </button>
        </div>
      </div>
    );
  };

  const renderMarketSession = () => {
    if (!selectedCard || turnState !== "awaitMarket") return null;
    return (
      <div className="action-panel">
        <div className="panel-header">
          <div>
            <strong>{translateCardText(settings.locale, selectedCard.name)}</strong>
            <div className="text-muted text-sm">{translateCardText(settings.locale, selectedCard.description)}</div>
          </div>
          <span className="text-muted text-sm">{t(settings.locale, "market.windowTitle")}</span>
        </div>

        {(selectedCard.rule || selectedCard.rule1 || selectedCard.rule2) && (
          <div className="card-rules">
            {selectedCard.rule && <div className="text-accent text-sm" style={{ fontStyle: "italic" }}>{translateCardText(settings.locale, selectedCard.rule)}</div>}
            {selectedCard.rule1 && <div className="text-accent text-sm" style={{ fontStyle: "italic" }}>{translateCardText(settings.locale, selectedCard.rule1)}</div>}
            {selectedCard.rule2 && <div className="text-accent text-sm" style={{ fontStyle: "italic" }}>{translateCardText(settings.locale, selectedCard.rule2)}</div>}
          </div>
        )}

        {isTradeableSecurityCard(selectedCard) && (
          <div className="panel" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="panel-header">
              <div>
                <strong>{t(settings.locale, "market.stock.title")}</strong>
                <div className="text-muted text-sm">
                  {t(settings.locale, "market.stock.symbol")}: {String(selectedCard.symbol ?? "—")} · {t(settings.locale, "market.stock.price")}: $
                  {typeof selectedCard.price === "number" ? selectedCard.price.toLocaleString() : "—"}
                </div>
              </div>
              <div className="text-muted text-sm">
                {t(settings.locale, "market.stock.everyoneSell")}: {cardMentionsEveryone(selectedCard) ? t(settings.locale, "market.yes") : t(settings.locale, "market.no")}
              </div>
            </div>
          </div>
        )}

        {isStockSplitEventCard(selectedCard) && (
          <div className="text-muted text-sm">{t(settings.locale, "market.split.hint")}</div>
        )}

        {selectedCard.deckKey === "offers" && (
          <div className="text-muted text-sm">
            {isOfferImproveCard(selectedCard)
              ? t(settings.locale, "market.offer.improveHint")
              : isOfferForcedLimitedSaleCard(selectedCard)
                ? t(settings.locale, "market.offer.forcedHint")
                : isOfferSellCard(selectedCard)
                  ? cardMentionsEveryone(selectedCard)
                    ? t(settings.locale, "market.offer.everyoneSellHint")
                    : t(settings.locale, "market.offer.currentOnlyHint")
                  : t(settings.locale, "market.offer.unknownHint")}
          </div>
        )}

        {renderMarketFlow()}
      </div>
    );
  };

  const renderMarketFlow = () => {
    const session = activeMarketSession;
    const isOffer = selectedCard?.deckKey === "offers";
    const isSecurity = selectedCard ? isTradeableSecurityCard(selectedCard) : false;
    const isSellOffer = isOffer && selectedCard ? isOfferSellCard(selectedCard) : false;
    const shouldUseSession = Boolean(session) && ((isOffer && isSellOffer) || isSecurity);

    if (!shouldUseSession) {
      return (
        <div className="action-row">
          <button onClick={() => resolveMarket()} className="btn btn-primary" style={{ flex: 1 }}>
            {t(settings.locale, "controls.resolve")}
          </button>
          <button onClick={skipMarketAll} className="btn btn-secondary" style={{ flex: 1 }}>
            {t(settings.locale, "market.skipAll")}
          </button>
        </div>
      );
    }

    if (!session) return null;

    if (session.stage === "sell") {
      const responderId = session.responders[session.responderIndex];
      const responder = players.find((player) => player.id === responderId);
      const responderName = responder?.name ?? responderId?.slice(0, 4) ?? "—";
      const normalizedSymbol =
        isSecurity && selectedCard && typeof selectedCard.symbol === "string" ? selectedCard.symbol.toLowerCase() : "";

      const eligibleAssets = responder
        ? isOffer
          ? responder.assets.filter((asset) => selectedCard && matchesOffer(asset, selectedCard))
          : responder.assets.filter((asset) => {
              const assetSymbol = asset.metadata?.symbol;
              return (
                asset.category === "stock" &&
                typeof assetSymbol === "string" &&
                assetSymbol.toLowerCase() === normalizedSymbol
              );
            })
        : [];

      const isLastResponder = session.responderIndex >= session.responders.length - 1;
      const confirmLabel = isLastResponder
        ? isSecurity
          ? t(settings.locale, "market.proceedToBuy")
          : t(settings.locale, "controls.resolve")
        : t(settings.locale, "market.nextResponder");

      return (
        <div className="panel-body">
          <div className="panel-header">
            <strong>{t(settings.locale, "market.responder")}: {responderName}</strong>
            <span className="chip">{session.responderIndex + 1}/{session.responders.length}</span>
          </div>

          {eligibleAssets.length === 0 ? (
            <div className="panel" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-muted text-sm">{t(settings.locale, "market.noEligibleAssets")}</div>
            </div>
          ) : (
            <div className="panel" style={{ background: "rgba(255,255,255,0.02)" }}>
              {eligibleAssets.map((asset) => {
                const available = getAssetAvailableQuantity(asset);
                const currentValue = session.sell?.[responderId]?.[asset.id] ?? 0;
                return (
                  <label key={asset.id} className="field">
                    <span className="asset-row-header">
                      <span>{asset.name} <span className="text-muted">· {t(settings.locale, "market.available")}: {available}</span></span>
                      <span className="text-muted">{t(settings.locale, "market.cashflow")}: ${asset.cashflow.toLocaleString()}</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={available}
                      step={1}
                      value={currentValue}
                      onChange={(e) =>
                        setMarketSellQuantity(asset.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                      }
                      className="field-input"
                    />
                  </label>
                );
              })}
            </div>
          )}

          <div className="action-row">
            <button onClick={confirmMarketStep} className="btn btn-primary" style={{ flex: 1 }}>
              {confirmLabel}
            </button>
            <button onClick={skipMarketAll} className="btn btn-secondary" style={{ flex: 1 }}>
              {t(settings.locale, "market.skipAll")}
            </button>
          </div>
        </div>
      );
    }

    if (session.stage === "buy" && isSecurity && currentPlayer && currentPlayer.id === currentPlayerId) {
      const buyQuantity = session.buyQuantity ?? 0;
      return (
        <div className="panel-body">
          <label className="field">
            <span className="field-label">{t(settings.locale, "market.stock.buyQuantity")}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={buyQuantity}
              onChange={(e) => setMarketBuyQuantity(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className="field-input"
            />
            <span className="text-muted text-sm">
              {t(settings.locale, "market.stock.buyCost")}: $
              {selectedCard && typeof selectedCard.price === "number" ? (selectedCard.price * buyQuantity).toLocaleString() : "—"}
            </span>
          </label>

          <div className="action-row">
            <button onClick={confirmMarketStep} className="btn btn-primary" style={{ flex: 1 }}>
              {t(settings.locale, "controls.resolve")}
            </button>
            <button onClick={skipMarketAll} className="btn btn-secondary" style={{ flex: 1 }}>
              {t(settings.locale, "market.skipAll")}
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderSelectedCard = () => {
    if (!selectedCard || turnState === "awaitMarket") return null;
    return (
      <div className="action-panel">
        <div className="panel-header">
          <strong>{translateCardText(settings.locale, selectedCard.name)}</strong>
          <button
            onClick={passSelectedCard}
            disabled={!canPass}
            className="btn btn-sm btn-secondary"
          >
            ✕
          </button>
        </div>
        <p className="text-muted text-sm" style={{ margin: 0 }}>{translateCardText(settings.locale, selectedCard.description)}</p>
        {selectedCard.rule && <p className="text-accent text-sm" style={{ fontStyle: "italic", margin: 0 }}>{translateCardText(settings.locale, selectedCard.rule)}</p>}
        {selectedCard.rule1 && <p className="text-accent text-sm" style={{ fontStyle: "italic", margin: 0 }}>{translateCardText(settings.locale, selectedCard.rule1)}</p>}
        {selectedCard.rule2 && <p className="text-accent text-sm" style={{ fontStyle: "italic", margin: 0 }}>{translateCardText(settings.locale, selectedCard.rule2)}</p>}

        <dl className="kv-grid">
          <dt className="kv-key">{t(settings.locale, "controls.card.type")}</dt>
          <dd className="kv-value">{translateCardText(settings.locale, selectedCard.type)}</dd>
          <dt className="kv-key">{t(settings.locale, "controls.card.cost")}</dt>
          <dd className="kv-value">${cardCost.toLocaleString()}</dd>
          <dt className="kv-key">{t(settings.locale, "controls.card.cashflow")}</dt>
          <dd className="kv-value">${cardCashflow.toLocaleString()}</dd>
        </dl>

        <div className="action-row">
          <button
            onClick={applySelectedCard}
            disabled={!canApply}
            className={clsx("btn", isExpense ? "btn-danger" : "btn-primary")}
            style={{ flex: 1 }}
          >
            {t(settings.locale, primaryActionKey) ?? "Apply"}
          </button>
          <button
            onClick={passSelectedCard}
            disabled={!canPass}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            {t(settings.locale, "controls.pass")}
          </button>
        </div>
      </div>
    );
  };

  const activePanelContent = (
    <>
      {renderCharity()}
      {renderLiquidation()}
      {renderMarketSession()}
      {renderSelectedCard()}
    </>
  );

  const hasContent = charityPending || (turnState === "awaitLiquidation" && liquidationSession?.playerId === currentPlayer?.id) || Boolean(selectedCard);

  return (
    <div className="panel" data-tour="control-panel">
      <div className="action-row">
        <button
          onClick={() => {
            setDiceRolling(true);
            rollDice();
            setTimeout(() => setDiceRolling(false), 600);
          }}
          disabled={!canRoll}
          className="btn btn-primary"
          style={{ flex: "1 1 150px" }}
        >
          {t(settings.locale, "controls.roll")}
        </button>
        <button onClick={nextPlayer} disabled={!canEndTurn} className="btn btn-secondary" style={{ flex: "1 1 150px" }}>
          {t(settings.locale, "controls.endTurn")}
        </button>
        {currentPlayer && currentPlayer.fastTrackUnlocked && currentPlayer.track === "ratRace" && (
          <button
            onClick={() => enterFastTrack(currentPlayer.id)}
            disabled={!canEndTurn}
            className="btn btn-secondary"
            style={{ flex: "1 1 150px", borderColor: "rgba(251,191,36,0.3)" }}
          >
            {t(settings.locale, "controls.fastTrack")}
          </button>
        )}
      </div>

      {settings.useCashflowDice && (
        <p className="text-muted text-sm" style={{ margin: 0 }}>{t(settings.locale, "controls.roll.cashflowModeInfo")}</p>
      )}

      {renderDiceRow()}

      <div className="deck-row">
        {deckOrder.map((deck) => {
          const enabled = canDrawDeck(deck) && !charityPending;
          return (
            <button
              key={deck}
              onClick={() => drawCard(deck)}
              disabled={!enabled}
              className={clsx("btn", enabled ? "btn-secondary" : "btn-secondary deck-disabled")}
            >
              {t(settings.locale, deckLabels[deck])}
            </button>
          );
        })}
      </div>

      {isOpportunitySquare && dealsDisabled && (
        <p className="text-sm" style={{ margin: 0, color: "#f97316" }}>{t(settings.locale, "controls.draw.noDealsWarning")}</p>
      )}

      {isMobile && hasContent ? (
        <BottomSheet open={Boolean(hasActivePanel)} onClose={() => {}} closeLabel={t(settings.locale, "common.close")} title={selectedCard ? translateCardText(settings.locale, selectedCard.name) : undefined}>
          {activePanelContent}
        </BottomSheet>
      ) : (
        activePanelContent
      )}

      {!selectedCard && !charityPending && turnState !== "awaitLiquidation" && (
        <p className="text-muted text-sm" style={{ margin: 0 }}>{t(settings.locale, "controls.emptyPrompt")}</p>
      )}
    </div>
  );
}
