"use client";

import { useMemo } from "react";
import { t } from "../lib/i18n";
import type { BaseCard } from "../lib/types";
import { type DeckKey, useGameStore } from "../lib/state/gameStore";

const deckLabels: Record<DeckKey, string> = {
  smallDeals: "controls.drawSmall",
  bigDeals: "controls.drawBig",
  doodads: "controls.drawDoodad",
  offers: "controls.drawOffer"
};

const deckOrder: DeckKey[] = ["smallDeals", "bigDeals", "doodads", "offers"];

const extractCardCost = (card: BaseCard) => {
  const fields = ["downPayment", "cost", "price", "amount", "deposit"];
  for (const field of fields) {
    const value = typeof card[field] === "number" ? (card[field] as number) : undefined;
    if (value !== undefined) {
      return value;
    }
  }
  return 0;
};

const extractCardCashflow = (card: BaseCard) => {
  const fields = ["cashFlow", "dividend", "payout", "savings"];
  for (const field of fields) {
    const value = typeof card[field] === "number" ? (card[field] as number) : undefined;
    if (value !== undefined) {
      return value;
    }
  }
  return 0;
};

export function ControlPanel() {
  const { rollDice, drawCard, completeDeal, clearCard, selectedCard, dice, settings, nextPlayer, currentPlayerId } =
    useGameStore((state) => ({
      rollDice: state.rollDice,
      drawCard: state.drawCard,
      completeDeal: state.completeDeal,
      clearCard: state.clearCard,
      selectedCard: state.selectedCard,
      dice: state.dice,
      settings: state.settings,
      nextPlayer: state.nextPlayer,
      currentPlayerId: state.currentPlayerId
    }));

  const cardCost = useMemo(() => (selectedCard ? extractCardCost(selectedCard) : 0), [selectedCard]);
  const cardCashflow = useMemo(() => (selectedCard ? extractCardCashflow(selectedCard) : 0), [selectedCard]);

  const isExpense = selectedCard ? cardCashflow <= 0 && selectedCard.type?.toLowerCase().includes("doodad") : false;

  return (
    <div className="card grid" style={{ gap: "0.8rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={rollDice}
          style={{ flex: "1 1 150px", padding: "0.75rem", borderRadius: 12, background: "rgba(68, 208, 123, 0.2)", color: "#fff" }}
        >
          {t(settings.locale, "controls.roll")}
        </button>
        <button
          onClick={nextPlayer}
          style={{ flex: "1 1 150px", padding: "0.75rem", borderRadius: 12, background: "rgba(250, 204, 21, 0.15)", color: "#fff" }}
        >
          {t(settings.locale, "controls.endTurn")}
        </button>
      </div>

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
          <span>
            🎲 {dice.dice[0]} + {dice.dice[1]} = {dice.total}
          </span>
          <span>Player: {currentPlayerId?.slice(0, 4)}</span>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {deckOrder.map((deck) => (
          <button
            key={deck}
            onClick={() => drawCard(deck)}
            style={{
              padding: "0.65rem",
              borderRadius: 10,
              flex: "1 1 calc(50% - 0.5rem)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff"
            }}
          >
            {t(settings.locale, deckLabels[deck])}
          </button>
        ))}
      </div>

      {selectedCard ? (
        <div style={{ borderRadius: 12, border: "1px dashed rgba(255,255,255,0.2)", padding: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{selectedCard.name}</strong>
            <button onClick={clearCard} style={{ background: "transparent", color: "var(--muted)" }}>
              ✕
            </button>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{selectedCard.description}</p>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.35rem",
              fontSize: "0.85rem"
            }}
          >
            <dt style={{ color: "var(--muted)" }}>Type</dt>
            <dd style={{ margin: 0, textAlign: "right" }}>{selectedCard.type}</dd>
            <dt style={{ color: "var(--muted)" }}>Cost</dt>
            <dd style={{ margin: 0, textAlign: "right" }}>${cardCost.toLocaleString()}</dd>
            <dt style={{ color: "var(--muted)" }}>Cashflow</dt>
            <dd style={{ margin: 0, textAlign: "right" }}>${cardCashflow.toLocaleString()}</dd>
          </dl>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              onClick={() => completeDeal({ card: selectedCard, cashDelta: -cardCost, cashflowDelta: cardCashflow })}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 10,
                flex: 1,
                background: isExpense ? "rgba(248,113,113,0.2)" : "rgba(34,197,94,0.25)",
                color: "#fff"
              }}
            >
              {t(settings.locale, isExpense ? "controls.pay" : "controls.buy") ?? "Apply"}
            </button>
            <button
              onClick={clearCard}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 10,
                flex: 1,
                background: "rgba(255,255,255,0.08)",
                color: "#fff"
              }}
            >
              {t(settings.locale, "controls.pass")}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Draw a card to view opportunities.</p>
      )}
    </div>
  );
}
