"use client";

import { useEffect, useMemo, useState } from "react";
import { t } from "../lib/i18n";
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
    enterFastTrack
  } = useGameStore((state) => ({
    rollDice: state.rollDice,
    drawCard: state.drawCard,
    applySelectedCard: state.applySelectedCard,
    passSelectedCard: state.passSelectedCard,
    resolveMarket: state.resolveMarket,
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
    enterFastTrack: state.enterFastTrack
  }));

  const currentPlayer = useMemo(() => players.find((player) => player.id === currentPlayerId), [players, currentPlayerId]);
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
    if (turnState !== "awaitAction") {
      return false;
    }
    if (!currentPlayer || currentPlayer.track === "fastTrack") {
      return false;
    }
    if (selectedCard) {
      return false;
    }
    if (deck === "smallDeals") {
      return settings.enableSmallDeals && isOpportunitySquare;
    }
    if (deck === "bigDeals") {
      return settings.enableBigDeals && isOpportunitySquare;
    }
    // Liability/Offer 会在落点事件中自动抽取，无需手动点击抽牌。
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
  const canApply = turnState === "awaitCard";

  const [marketBuyQuantity, setMarketBuyQuantity] = useState(0);
  const [marketSell, setMarketSell] = useState<Record<string, Record<string, number>>>({});
  const selectedCardId = selectedCard?.id;

  useEffect(() => {
    if (turnState !== "awaitMarket" || !selectedCardId) {
      setMarketBuyQuantity(0);
      setMarketSell({});
      return;
    }
    setMarketBuyQuantity(0);
    setMarketSell({});
  }, [turnState, selectedCardId]);

  const setMarketSellQuantity = (playerId: string, assetId: string, quantity: number) => {
    setMarketSell((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {}),
        [assetId]: quantity
      }
    }));
  };

  return (
    <div className="card grid" style={{ gap: "0.8rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={rollDice}
          disabled={!canRoll}
          style={{ flex: "1 1 150px", padding: "0.75rem", borderRadius: 12, background: "rgba(68, 208, 123, 0.2)", color: "#fff" }}
        >
          {t(settings.locale, "controls.roll")}
        </button>
        <button
          onClick={nextPlayer}
          disabled={!canEndTurn}
          style={{ flex: "1 1 150px", padding: "0.75rem", borderRadius: 12, background: "rgba(250, 204, 21, 0.15)", color: "#fff" }}
        >
          {t(settings.locale, "controls.endTurn")}
        </button>
        {currentPlayer && currentPlayer.fastTrackUnlocked && currentPlayer.track === "ratRace" && (
          <button
            onClick={() => enterFastTrack(currentPlayer.id)}
            disabled={!canEndTurn}
            style={{ flex: "1 1 150px", padding: "0.75rem", borderRadius: 12, background: "rgba(251, 191, 36, 0.2)", color: "#fff" }}
          >
            {t(settings.locale, "controls.fastTrack")}
          </button>
        )}
      </div>
      {settings.useCashflowDice && (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{t(settings.locale, "controls.roll.cashflowModeInfo")}</p>
      )}

      {dice && (
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: 12,
            padding: "0.5rem 0.75rem",
            display: "flex",
            justifyContent: "space-between"
          }}
        >
          <span>🎲 {dice.dice.join(" + ")} = {dice.total}</span>
          <span>
            {t(settings.locale, "controls.playerId")}: {currentPlayerId?.slice(0, 4)}
          </span>
        </div>
      )}

      {charityPrompt && charityPrompt.playerId === currentPlayerId && (
        <div
          className="card"
          style={{
            background: "rgba(14,165,233,0.08)",
            border: "1px solid rgba(14,165,233,0.25)",
            borderRadius: 12,
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem"
          }}
        >
          <strong>{t(settings.locale, "controls.charity.title")}</strong>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>{t(settings.locale, "controls.charity.prompt")}</p>
          <div style={{ fontSize: "0.85rem", color: "var(--text)" }}>
            {t(settings.locale, "controls.charity.amountLabel")}: ${charityPrompt.amount.toLocaleString()}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={donateCharity}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: 10,
                flex: 1,
                background: "rgba(34,197,94,0.25)",
                color: "#fff"
              }}
            >
              {t(settings.locale, "controls.charity.donate")}
            </button>
            <button
              onClick={skipCharity}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: 10,
                flex: 1,
                background: "rgba(255,255,255,0.08)",
                color: "#fff"
              }}
            >
              {t(settings.locale, "controls.charity.skip")}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {deckOrder.map((deck) => {
          const enabled = canDrawDeck(deck) && !charityPending;
          return (
            <button
              key={deck}
              onClick={() => drawCard(deck)}
              disabled={!enabled}
              style={{
                padding: "0.65rem",
                borderRadius: 10,
                flex: "1 1 calc(50% - 0.5rem)",
                background: enabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                color: enabled ? "#fff" : "rgba(255,255,255,0.4)",
                cursor: enabled ? "pointer" : "not-allowed",
                border: enabled ? "1px solid transparent" : "1px dashed rgba(255,255,255,0.1)"
              }}
            >
              {t(settings.locale, deckLabels[deck])}
            </button>
          );
        })}
      </div>
      {isOpportunitySquare && dealsDisabled && (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#f97316" }}>{t(settings.locale, "controls.draw.noDealsWarning")}</p>
      )}

      {selectedCard ? (
        turnState === "awaitMarket" ? (
          <div style={{ borderRadius: 12, border: "1px dashed rgba(255,255,255,0.2)", padding: "0.75rem", display: "grid", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
              <div>
                <strong>{translateCardText(settings.locale, selectedCard.name)}</strong>
                <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{translateCardText(settings.locale, selectedCard.description)}</div>
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{t(settings.locale, "market.windowTitle")}</div>
            </div>

            {(selectedCard.rule || selectedCard.rule1 || selectedCard.rule2) && (
              <div style={{ display: "grid", gap: "0.25rem" }}>
                {selectedCard.rule && (
                  <div style={{ color: "var(--accent)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    {translateCardText(settings.locale, selectedCard.rule)}
                  </div>
                )}
                {selectedCard.rule1 && (
                  <div style={{ color: "var(--accent)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    {translateCardText(settings.locale, selectedCard.rule1)}
                  </div>
                )}
                {selectedCard.rule2 && (
                  <div style={{ color: "var(--accent)", fontSize: "0.85rem", fontStyle: "italic" }}>
                    {translateCardText(settings.locale, selectedCard.rule2)}
                  </div>
                )}
              </div>
            )}

            {isTradeableSecurityCard(selectedCard) && (
              <div className="card" style={{ background: "rgba(255,255,255,0.03)", display: "grid", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div>
                    <strong>{t(settings.locale, "market.stock.title")}</strong>
                    <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                      {t(settings.locale, "market.stock.symbol")}: {String(selectedCard.symbol ?? "—")} · {t(settings.locale, "market.stock.price")}: $
                      {typeof selectedCard.price === "number" ? selectedCard.price.toLocaleString() : "—"}
                    </div>
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                    {t(settings.locale, "market.stock.everyoneSell")}: {cardMentionsEveryone(selectedCard) ? t(settings.locale, "market.yes") : t(settings.locale, "market.no")}
                  </div>
                </div>

                {currentPlayer && currentPlayer.id === currentPlayerId && (
                  <label className="grid" style={{ gap: "0.35rem" }}>
                    <span style={{ color: "var(--muted)" }}>{t(settings.locale, "market.stock.buyQuantity")}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={marketBuyQuantity}
                      onChange={(e) => setMarketBuyQuantity(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.08)",
                        padding: "0.5rem 0.75rem",
                        color: "var(--text)"
                      }}
                    />
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                      {t(settings.locale, "market.stock.buyCost")}: $
                      {typeof selectedCard.price === "number" ? (selectedCard.price * marketBuyQuantity).toLocaleString() : "—"}
                    </span>
                  </label>
                )}
              </div>
            )}

            {isStockSplitEventCard(selectedCard) && (
              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{t(settings.locale, "market.split.hint")}</div>
            )}

            {selectedCard.deckKey === "offers" && (
              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
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

            {(() => {
              const isOffer = selectedCard.deckKey === "offers";
              const isSecurity = isTradeableSecurityCard(selectedCard);
              const isSellOffer = isOffer && isOfferSellCard(selectedCard);
              const shouldShowSellInputs = (isOffer && isSellOffer) || isSecurity;
              if (!shouldShowSellInputs) return null;

              const allowAllPlayers = cardMentionsEveryone(selectedCard);
              const eligiblePlayers = allowAllPlayers ? players : currentPlayer ? [currentPlayer] : [];
              const normalizedSymbol =
                isSecurity && typeof selectedCard.symbol === "string" ? selectedCard.symbol.toLowerCase() : "";

              return (
                <div className="grid" style={{ gap: "0.75rem" }}>
                  {eligiblePlayers.map((player) => {
                    const eligibleAssets = isOffer
                      ? player.assets.filter((asset) => matchesOffer(asset, selectedCard))
                      : player.assets.filter((asset) => {
                          const assetSymbol = asset.metadata?.symbol;
                          return (
                            asset.category === "stock" &&
                            typeof assetSymbol === "string" &&
                            assetSymbol.toLowerCase() === normalizedSymbol
                          );
                        });

                    if (eligibleAssets.length === 0) {
                      return (
                        <div key={player.id} className="card" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <strong>{player.name}</strong>
                          <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{t(settings.locale, "market.noEligibleAssets")}</div>
                        </div>
                      );
                    }

                    return (
                      <div key={player.id} className="card grid" style={{ background: "rgba(255,255,255,0.02)", gap: "0.6rem" }}>
                        <strong>{player.name}</strong>
                        {eligibleAssets.map((asset) => {
                          const available = getAssetAvailableQuantity(asset);
                          const currentValue = marketSell[player.id]?.[asset.id] ?? 0;
                          return (
                            <label key={asset.id} className="grid" style={{ gap: "0.35rem" }}>
                              <span style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                                <span>
                                  {asset.name}{" "}
                                  <span style={{ color: "var(--muted)" }}>
                                    · {t(settings.locale, "market.available")}: {available}
                                  </span>
                                </span>
                                <span style={{ color: "var(--muted)" }}>
                                  {t(settings.locale, "market.cashflow")}: ${asset.cashflow.toLocaleString()}
                                </span>
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={available}
                                step={1}
                                value={currentValue}
                                onChange={(e) => setMarketSellQuantity(player.id, asset.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                                style={{
                                  background: "rgba(255,255,255,0.05)",
                                  borderRadius: 8,
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  padding: "0.5rem 0.75rem",
                                  color: "var(--text)"
                                }}
                              />
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => resolveMarket({ buyQuantity: marketBuyQuantity, sell: marketSell })}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: 10,
                  flex: 1,
                  background: "rgba(34,197,94,0.25)",
                  color: "#fff"
                }}
              >
                {t(settings.locale, "controls.resolve")}
              </button>
              <button
                onClick={() => {
                  setMarketBuyQuantity(0);
                  setMarketSell({});
                  resolveMarket({ buyQuantity: 0, sell: {} });
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: 10,
                  flex: 1,
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff"
                }}
              >
                {t(settings.locale, "market.skipAll")}
              </button>
            </div>
          </div>
        ) : (
        <div style={{ borderRadius: 12, border: "1px dashed rgba(255,255,255,0.2)", padding: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{translateCardText(settings.locale, selectedCard.name)}</strong>
            <button
              onClick={passSelectedCard}
              disabled={!canPass}
              style={{ background: "transparent", color: "var(--muted)", opacity: canPass ? 1 : 0.5, cursor: canPass ? "pointer" : "not-allowed" }}
            >
              ✕
            </button>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{translateCardText(settings.locale, selectedCard.description)}</p>
          {selectedCard.rule && (
            <p style={{ color: "var(--accent)", fontSize: "0.85rem", fontStyle: "italic" }}>
              {translateCardText(settings.locale, selectedCard.rule)}
            </p>
          )}
          {selectedCard.rule1 && (
            <p style={{ color: "var(--accent)", fontSize: "0.85rem", fontStyle: "italic" }}>
              {translateCardText(settings.locale, selectedCard.rule1)}
            </p>
          )}
          {selectedCard.rule2 && (
            <p style={{ color: "var(--accent)", fontSize: "0.85rem", fontStyle: "italic" }}>
              {translateCardText(settings.locale, selectedCard.rule2)}
            </p>
          )}
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.35rem",
              fontSize: "0.85rem"
            }}
          >
            <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "controls.card.type")}</dt>
            <dd style={{ margin: 0, textAlign: "right" }}>{translateCardText(settings.locale, selectedCard.type)}</dd>
            <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "controls.card.cost")}</dt>
            <dd style={{ margin: 0, textAlign: "right" }}>${cardCost.toLocaleString()}</dd>
            <dt style={{ color: "var(--muted)" }}>{t(settings.locale, "controls.card.cashflow")}</dt>
            <dd style={{ margin: 0, textAlign: "right" }}>${cardCashflow.toLocaleString()}</dd>
          </dl>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              onClick={applySelectedCard}
              disabled={!canApply}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 10,
                flex: 1,
                background: isExpense ? "rgba(248,113,113,0.2)" : "rgba(34,197,94,0.25)",
                color: "#fff",
                opacity: canApply ? 1 : 0.5,
                cursor: canApply ? "pointer" : "not-allowed"
              }}
            >
              {t(settings.locale, primaryActionKey) ?? "Apply"}
            </button>
            <button
              onClick={passSelectedCard}
              disabled={!canPass}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 10,
                flex: 1,
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                opacity: canPass ? 1 : 0.5,
                cursor: canPass ? "pointer" : "not-allowed"
              }}
            >
              {t(settings.locale, "controls.pass")}
            </button>
          </div>
        </div>
        )
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{t(settings.locale, "controls.emptyPrompt")}</p>
      )}
    </div>
  );
}
