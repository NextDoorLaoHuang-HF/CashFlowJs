import type { Asset, BaseCard } from "../types";

const stringifyField = (value: unknown): string => (typeof value === "string" ? value : "");

export const getCardRuleText = (card: BaseCard): string => {
  const combined = [
    stringifyField(card.rule),
    stringifyField(card.rule1),
    stringifyField(card.rule2),
    stringifyField(card.text),
    stringifyField(card.description)
  ]
    .filter(Boolean)
    .join(" ");
  return combined.toLowerCase();
};

export const cardMentionsEveryone = (card: BaseCard): boolean => getCardRuleText(card).includes("everyone");

export const isOfferSellCard = (card: BaseCard): boolean =>
  typeof card.offer === "number" || typeof card.offerPerUnit === "number";

export const isOfferImproveCard = (card: BaseCard): boolean =>
  typeof card.cashFlow === "number" && card.offer === undefined && card.offerPerUnit === undefined;

export const isOfferForcedLimitedSaleCard = (card: BaseCard): boolean =>
  (card.type ?? "").toString().toLowerCase() === "limited" && !isOfferSellCard(card) && !isOfferImproveCard(card);

export const isTradeableSecurityCard = (card: BaseCard): boolean => {
  const typeLabel = (card.type ?? "").toString().toLowerCase();
  const symbol = typeof card.symbol === "string" ? card.symbol : "";
  const price = typeof card.price === "number" ? card.price : undefined;
  if (!symbol || typeof price !== "number" || !Number.isFinite(price)) {
    return false;
  }
  if (typeLabel.includes("stock split") || typeLabel.includes("reverse split")) {
    return false;
  }
  return (
    typeLabel.includes("stock") ||
    typeLabel.includes("mutual fund") ||
    typeLabel.includes("preferred stock") ||
    typeLabel.includes("certificate of deposit")
  );
};

export const isStockSplitEventCard = (card: BaseCard): boolean => {
  const typeLabel = (card.type ?? "").toString().toLowerCase();
  return (
    typeof card.symbol === "string" &&
    (typeLabel.includes("stock split") || typeLabel.includes("reverse split"))
  );
};

export const getStockSplitKind = (card: BaseCard): "split" | "reverse" | null => {
  const typeLabel = (card.type ?? "").toString().toLowerCase();
  if (typeLabel.includes("stock split")) return "split";
  if (typeLabel.includes("reverse split")) return "reverse";
  return null;
};

export const getAssetAvailableQuantity = (asset: Asset): number => {
  if (typeof asset.quantity === "number" && Number.isFinite(asset.quantity) && asset.quantity > 0) {
    return Math.floor(asset.quantity);
  }
  return 1;
};

const getLandTypeLabel = (asset: Asset): string => {
  const raw = (asset.metadata?.landType ?? asset.name).toString().toLowerCase();
  return raw;
};

export const matchesOffer = (asset: Asset, card: BaseCard): boolean => {
  const offerType = (card.type ?? "").toString().toLowerCase();
  const landType = getLandTypeLabel(asset);

  if (offerType === "plex") {
    return /plex/.test(landType) || landType === "duplex";
  }
  if (offerType === "apartment") {
    if (!(landType === "apartment" || /unit/.test(landType))) return false;
    const minUnits = typeof card.lowestUnit === "number" ? card.lowestUnit : 0;
    const units = typeof asset.metadata?.units === "number" ? asset.metadata.units : 0;
    return units >= minUnits;
  }
  if (offerType === "limited") {
    return landType.includes("limited");
  }
  if (offerType === "business") {
    return asset.category === "business";
  }
  if (offerType === "widget" || offerType === "software") {
    return landType.includes(offerType);
  }
  if (offerType === "mall" || offerType === "car wash") {
    return landType.includes(offerType);
  }
  if (offerType === "krugerrands" || offerType === "1500's spanish") {
    return landType.includes(offerType.split(" ")[0]);
  }
  return landType === offerType;
};

