import { describe, expect, it } from "vitest";
import {
  cardMentionsEveryone,
  isOfferSellCard,
  isOfferImproveCard,
  isOfferForcedLimitedSaleCard,
  isTradeableSecurityCard,
  isStockSplitEventCard,
  getStockSplitKind,
  getAssetAvailableQuantity,
  matchesOffer
} from "@/lib/state/marketRules";
import { createTestCard, createTestAsset } from "../helpers";

describe("marketRules", () => {
  describe("cardMentionsEveryone", () => {
    it("detects everyone keywords in rule text", () => {
      expect(cardMentionsEveryone(createTestCard({ rule: "Everyone may sell" }))).toBe(true);
      expect(cardMentionsEveryone(createTestCard({ rule: "Any player can buy" }))).toBe(true);
      expect(cardMentionsEveryone(createTestCard({ rule: "Each player receives" }))).toBe(true);
      expect(cardMentionsEveryone(createTestCard({ rule: "All players win" }))).toBe(true);
    });

    it("returns false when no keyword is present", () => {
      expect(cardMentionsEveryone(createTestCard({ rule: "Only you may buy" }))).toBe(false);
    });
  });

  describe("isOfferSellCard", () => {
    it("returns true when offer or offerPerUnit is numeric", () => {
      expect(isOfferSellCard(createTestCard({ offer: 50000 }))).toBe(true);
      expect(isOfferSellCard(createTestCard({ offerPerUnit: 20000 }))).toBe(true);
    });

    it("returns false otherwise", () => {
      expect(isOfferSellCard(createTestCard({}))).toBe(false);
    });
  });

  describe("isOfferImproveCard", () => {
    it("returns true when cashFlow is numeric and no offer fields", () => {
      expect(isOfferImproveCard(createTestCard({ cashFlow: 100 }))).toBe(true);
    });

    it("returns false when offer fields exist", () => {
      expect(isOfferImproveCard(createTestCard({ cashFlow: 100, offer: 50000 }))).toBe(false);
    });
  });

  describe("isOfferForcedLimitedSaleCard", () => {
    it("returns true for limited type without offer/improve", () => {
      expect(isOfferForcedLimitedSaleCard(createTestCard({ type: "Limited" }))).toBe(true);
    });

    it("returns false for non-limited or cards with offers", () => {
      expect(isOfferForcedLimitedSaleCard(createTestCard({ type: "Limited", offer: 100 }))).toBe(false);
      expect(isOfferForcedLimitedSaleCard(createTestCard({ type: "Plex" }))).toBe(false);
    });
  });

  describe("isTradeableSecurityCard", () => {
    it("returns true for valid stock/mutual fund with symbol and price", () => {
      expect(isTradeableSecurityCard(createTestCard({ type: "Stock", symbol: "ABC", price: 10 }))).toBe(true);
      expect(isTradeableSecurityCard(createTestCard({ type: "Mutual Fund", symbol: "XYZ", price: 5 }))).toBe(true);
    });

    it("returns false for splits/reverse splits", () => {
      expect(isTradeableSecurityCard(createTestCard({ type: "Stock Split", symbol: "ABC", price: 10 }))).toBe(false);
      expect(isTradeableSecurityCard(createTestCard({ type: "Reverse Split", symbol: "ABC", price: 10 }))).toBe(false);
    });

    it("returns false when missing symbol or price", () => {
      expect(isTradeableSecurityCard(createTestCard({ type: "Stock", price: 10 }))).toBe(false);
      expect(isTradeableSecurityCard(createTestCard({ type: "Stock", symbol: "ABC" }))).toBe(false);
    });
  });

  describe("isStockSplitEventCard", () => {
    it("detects split and reverse split", () => {
      expect(isStockSplitEventCard(createTestCard({ type: "Stock Split", symbol: "ABC" }))).toBe(true);
      expect(isStockSplitEventCard(createTestCard({ type: "Reverse Split", symbol: "ABC" }))).toBe(true);
      expect(isStockSplitEventCard(createTestCard({ type: "Stock", symbol: "ABC" }))).toBe(false);
    });
  });

  describe("getStockSplitKind", () => {
    it("returns correct kind", () => {
      expect(getStockSplitKind(createTestCard({ type: "Stock Split" }))).toBe("split");
      expect(getStockSplitKind(createTestCard({ type: "Reverse Split" }))).toBe("reverse");
      expect(getStockSplitKind(createTestCard({ type: "Stock" }))).toBeNull();
    });
  });

  describe("getAssetAvailableQuantity", () => {
    it("returns quantity when valid", () => {
      expect(getAssetAvailableQuantity(createTestAsset({ quantity: 5 }))).toBe(5);
    });

    it("defaults to 1 when quantity is missing or invalid", () => {
      expect(getAssetAvailableQuantity(createTestAsset({ quantity: undefined }))).toBe(1);
      expect(getAssetAvailableQuantity(createTestAsset({ quantity: 0 }))).toBe(1);
      expect(getAssetAvailableQuantity(createTestAsset({ quantity: -1 }))).toBe(1);
    });
  });

  describe("matchesOffer", () => {
    it("matches plex offer to duplex/plex assets", () => {
      expect(matchesOffer(createTestAsset({ name: "2br/1ba Duplex" }), createTestCard({ type: "plex" }))).toBe(true);
      expect(matchesOffer(createTestAsset({ name: "4-plex" }), createTestCard({ type: "plex" }))).toBe(true);
      expect(matchesOffer(createTestAsset({ name: "House" }), createTestCard({ type: "plex" }))).toBe(false);
    });

    it("matches apartment offer with unit check", () => {
      expect(matchesOffer(createTestAsset({ name: "Apartment", metadata: { units: 10 } }), createTestCard({ type: "apartment", lowestUnit: 8 }))).toBe(true);
      expect(matchesOffer(createTestAsset({ name: "Apartment", metadata: { units: 5 } }), createTestCard({ type: "apartment", lowestUnit: 8 }))).toBe(false);
    });

    it("matches business offer to business category", () => {
      expect(matchesOffer(createTestAsset({ category: "business" }), createTestCard({ type: "business" }))).toBe(true);
      expect(matchesOffer(createTestAsset({ category: "stock" }), createTestCard({ type: "business" }))).toBe(false);
    });

    it("matches widget/software/mall/car wash by name", () => {
      expect(matchesOffer(createTestAsset({ name: "Widget Co" }), createTestCard({ type: "widget" }))).toBe(true);
      expect(matchesOffer(createTestAsset({ name: "Software Inc" }), createTestCard({ type: "software" }))).toBe(true);
      expect(matchesOffer(createTestAsset({ name: "Mall Plaza" }), createTestCard({ type: "mall" }))).toBe(true);
      expect(matchesOffer(createTestAsset({ name: "Car Wash" }), createTestCard({ type: "car wash" }))).toBe(true);
    });

    it("matches exact landType", () => {
      expect(matchesOffer(createTestAsset({ name: "Gold Mine" }), createTestCard({ type: "gold mine" }))).toBe(true);
      expect(matchesOffer(createTestAsset({ name: "Gold Mine" }), createTestCard({ type: "silver mine" }))).toBe(false);
    });
  });
});
