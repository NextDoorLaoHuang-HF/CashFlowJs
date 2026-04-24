import type { BaseCard, Player } from "../types";
import type { Asset } from "../types";
import { getAssetAvailableQuantity, isOfferForcedLimitedSaleCard, isOfferImproveCard, isOfferSellCard, isStockSplitEventCard, isTradeableSecurityCard, matchesOffer } from "../state/marketRules";
import type { DeckKey } from "./types";

const getNumericField = (card: BaseCard, fields: string[]): number | undefined => {
  for (const field of fields) {
    const value = card[field];
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }
  return undefined;
};

export const deriveAssetCost = (card: BaseCard, fallback: number): number => {
  const value = getNumericField(card, ["cost", "price", "amount", "value", "totalCost"]);
  return typeof value === "number" ? Math.abs(value) : Math.abs(fallback);
};

export const getLandType = (card: BaseCard): string | undefined => {
  const businessType = typeof card.businessType === "string" ? card.businessType : undefined;
  const landType = typeof card.landType === "string" ? card.landType : undefined;
  const tag = typeof card.tag === "string" ? card.tag : undefined;
  return (businessType ?? landType ?? tag)?.toLowerCase();
};

export const deriveCardCashflow = (card: BaseCard, provided?: number): number => {
  if (typeof provided === "number") {
    return provided;
  }
  const value = getNumericField(card, ["cashFlow", "cashflow", "dividend", "payout", "savings"]);
  return typeof value === "number" ? value : 0;
};

export const getDeckKey = (card: BaseCard): DeckKey | null => {
  const deckKey = card.deckKey;
  if (deckKey === "smallDeals" || deckKey === "bigDeals" || deckKey === "offers" || deckKey === "doodads") {
    return deckKey;
  }
  return null;
};

const isPropertyDamageCard = (card: BaseCard): boolean => {
  const typeLabel = (card.type ?? "").toString().toLowerCase();
  return typeLabel.includes("property damage");
};

const hasRentalProperty = (player: Player): boolean =>
  player.assets.some((asset) => {
    if (asset.category !== "realEstate") return false;
    const landType = (asset.metadata?.landType ?? asset.name).toString().toLowerCase();
    return /(\d+br\/\d+ba|duplex|plex|apartment)/.test(landType);
  });

const hasEightPlex = (player: Player): boolean =>
  player.assets.some((asset) => {
    if (asset.category !== "realEstate") return false;
    const units = asset.metadata?.units;
    return typeof units === "number" && Number.isFinite(units) && units === 8;
  });

const shouldPayPropertyDamage = (card: BaseCard, player?: Player): boolean => {
  if (!player) return false;
  const propertyType = typeof card.propertyType === "string" ? card.propertyType.toLowerCase() : "";
  if (propertyType === "rental") return hasRentalProperty(player);
  if (propertyType === "8-plex" || propertyType === "8plex") return hasEightPlex(player);
  return false;
};

const isExpenseCard = (card: BaseCard): boolean => {
  if (isPropertyDamageCard(card)) {
    return true;
  }
  const deckKey = typeof card.deckKey === "string" ? card.deckKey.toLowerCase() : "";
  if (deckKey === "doodads") {
    return true;
  }
  return card.type?.toLowerCase().includes("doodad") ?? false;
};

export const deriveCardCostForPlayer = (card: BaseCard, player?: Player): number => {
  const deckKey = getDeckKey(card);
  if (deckKey === "offers") {
    return 0;
  }
  if (isTradeableSecurityCard(card)) {
    return 0;
  }
  if (isPropertyDamageCard(card) && !shouldPayPropertyDamage(card, player)) {
    return 0;
  }
  if (deckKey === "doodads") {
    const ratio = typeof card.amount === "number" ? card.amount : undefined;
    if (typeof ratio === "number" && ratio > 0 && ratio < 1) {
      const basis = player?.cash ?? 0;
      return Math.max(0, Math.round(basis * ratio));
    }
  }
  const value = getNumericField(card, ["downPayment", "cost", "price", "deposit"]);
  return typeof value === "number" ? Math.max(0, Math.abs(value)) : 0;
};

export const derivePrimaryAction = (card: BaseCard): "buy" | "pay" | "resolve" => {
  const deckKey = getDeckKey(card);
  if (isPropertyDamageCard(card)) return "pay";
  if (deckKey === "doodads") return "pay";
  if (deckKey === "offers") return "resolve";
  if (isTradeableSecurityCard(card) || isStockSplitEventCard(card)) return "resolve";
  return "buy";
};

export const canPassCard = (card: BaseCard): boolean => {
  const deckKey = getDeckKey(card);
  if (isPropertyDamageCard(card)) return false;
  if (deckKey === "doodads") return false;
  if (deckKey === "offers") return false;
  if (isTradeableSecurityCard(card) || isStockSplitEventCard(card)) return false;
  return true;
};

export type CardPreview = {
  cost: number;
  cashflow: number;
  canPass: boolean;
  primaryAction: "buy" | "pay" | "resolve";
};

export const buildCardPreview = (card: BaseCard, player?: Player): CardPreview => ({
  cost: deriveCardCostForPlayer(card, player),
  cashflow: deriveCardCashflow(card),
  canPass: canPassCard(card),
  primaryAction: derivePrimaryAction(card)
});

export const inferAssetCategory = (card: BaseCard): Asset["category"] => {
  const typeLabel = card.type?.toLowerCase() ?? "";
  if (/(stock|share|fund|certificate|deposit|\bcd\b)/.test(typeLabel)) {
    return "stock";
  }
  if (/(estate|house|condo|plex|apartment|land)/.test(typeLabel)) {
    return "realEstate";
  }
  if (/(business|company|franchise|venture|partnership)/.test(typeLabel)) {
    return "business";
  }
  if (/(collectible|coin|art|gold|jewel)/.test(typeLabel)) {
    return "collectible";
  }
  return "other";
};
