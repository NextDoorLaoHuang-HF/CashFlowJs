import { describe, expect, it } from "vitest";
import {
  deriveAssetCost,
  deriveCardCashflow,
  getDeckKey,
  derivePrimaryAction,
  canPassCard,
  buildCardPreview,
  inferAssetCategory,
  deriveCardCostForPlayer
} from "@/lib/engine/cardHelpers";
import { createTestCard, createTestPlayer } from "../helpers";

describe("cardHelpers", () => {
  describe("deriveAssetCost", () => {
    it("extracts cost from known fields", () => {
      expect(deriveAssetCost(createTestCard({ cost: 5000 }), 0)).toBe(5000);
      expect(deriveAssetCost(createTestCard({ price: 3000 }), 0)).toBe(3000);
      expect(deriveAssetCost(createTestCard({ amount: -2000 }), 0)).toBe(2000);
    });

    it("falls back to provided value", () => {
      expect(deriveAssetCost(createTestCard({}), 1234)).toBe(1234);
    });
  });

  describe("deriveCardCashflow", () => {
    it("extracts cashflow fields", () => {
      expect(deriveCardCashflow(createTestCard({ cashFlow: 200 }))).toBe(200);
      expect(deriveCardCashflow(createTestCard({ cashflow: 300 }))).toBe(300);
      expect(deriveCardCashflow(createTestCard({ dividend: 50 }))).toBe(50);
    });

    it("uses provided override", () => {
      expect(deriveCardCashflow(createTestCard({ cashFlow: 200 }), 999)).toBe(999);
    });

    it("defaults to 0", () => {
      expect(deriveCardCashflow(createTestCard({}))).toBe(0);
    });
  });

  describe("getDeckKey", () => {
    it("returns valid deck keys", () => {
      expect(getDeckKey(createTestCard({ deckKey: "smallDeals" }))).toBe("smallDeals");
      expect(getDeckKey(createTestCard({ deckKey: "bigDeals" }))).toBe("bigDeals");
      expect(getDeckKey(createTestCard({ deckKey: "offers" }))).toBe("offers");
      expect(getDeckKey(createTestCard({ deckKey: "doodads" }))).toBe("doodads");
    });

    it("returns null for invalid keys", () => {
      expect(getDeckKey(createTestCard({ deckKey: "unknown" }))).toBeNull();
      expect(getDeckKey(createTestCard({}))).toBeNull();
    });
  });

  describe("derivePrimaryAction", () => {
    it("returns resolve for offers and tradeable securities", () => {
      expect(derivePrimaryAction(createTestCard({ deckKey: "offers" }))).toBe("resolve");
      expect(derivePrimaryAction(createTestCard({ type: "Stock", symbol: "ABC", price: 10 }))).toBe("resolve");
    });

    it("returns pay for doodads and property damage", () => {
      expect(derivePrimaryAction(createTestCard({ deckKey: "doodads" }))).toBe("pay");
      expect(derivePrimaryAction(createTestCard({ type: "Property Damage" }))).toBe("pay");
    });

    it("returns buy for everything else", () => {
      expect(derivePrimaryAction(createTestCard({ deckKey: "smallDeals" }))).toBe("buy");
    });
  });

  describe("canPassCard", () => {
    it("returns false for mandatory cards", () => {
      expect(canPassCard(createTestCard({ deckKey: "doodads" }))).toBe(false);
      expect(canPassCard(createTestCard({ deckKey: "offers" }))).toBe(false);
      expect(canPassCard(createTestCard({ type: "Property Damage" }))).toBe(false);
      expect(canPassCard(createTestCard({ type: "Stock", symbol: "X", price: 1 }))).toBe(false);
    });

    it("returns true for optional deal cards", () => {
      expect(canPassCard(createTestCard({ deckKey: "smallDeals" }))).toBe(true);
      expect(canPassCard(createTestCard({ deckKey: "bigDeals" }))).toBe(true);
    });
  });

  describe("buildCardPreview", () => {
    it("assembles preview correctly", () => {
      const card = createTestCard({ deckKey: "smallDeals", cost: 5000, cashFlow: 200 });
      const preview = buildCardPreview(card, createTestPlayer());
      expect(preview.cost).toBe(5000);
      expect(preview.cashflow).toBe(200);
      expect(preview.canPass).toBe(true);
      expect(preview.primaryAction).toBe("buy");
    });
  });

  describe("inferAssetCategory", () => {
    it("detects stocks", () => {
      expect(inferAssetCategory(createTestCard({ type: "Stock" }))).toBe("stock");
      expect(inferAssetCategory(createTestCard({ type: "Mutual Fund" }))).toBe("stock");
      expect(inferAssetCategory(createTestCard({ type: "Certificate of Deposit" }))).toBe("stock");
    });

    it("detects real estate", () => {
      expect(inferAssetCategory(createTestCard({ type: "House" }))).toBe("realEstate");
      expect(inferAssetCategory(createTestCard({ type: "8-plex" }))).toBe("realEstate");
    });

    it("detects business", () => {
      expect(inferAssetCategory(createTestCard({ type: "Business" }))).toBe("business");
      expect(inferAssetCategory(createTestCard({ type: "Franchise" }))).toBe("business");
    });

    it("detects collectibles", () => {
      expect(inferAssetCategory(createTestCard({ type: "Gold Coin" }))).toBe("collectible");
    });

    it("defaults to other", () => {
      expect(inferAssetCategory(createTestCard({ type: "Mystery" }))).toBe("other");
    });
  });

  describe("deriveCardCostForPlayer", () => {
    it("returns 0 for offers", () => {
      expect(deriveCardCostForPlayer(createTestCard({ deckKey: "offers" }))).toBe(0);
    });

    it("returns 0 for tradeable securities", () => {
      expect(deriveCardCostForPlayer(createTestCard({ type: "Stock", symbol: "X", price: 10 }))).toBe(0);
    });

    it("extracts downPayment/cost/price/deposit", () => {
      expect(deriveCardCostForPlayer(createTestCard({ downPayment: 5000 }))).toBe(5000);
      expect(deriveCardCostForPlayer(createTestCard({ cost: 3000 }))).toBe(3000);
    });

    it("handles doodad ratio cards", () => {
      const player = createTestPlayer({ cash: 10000 });
      expect(deriveCardCostForPlayer(createTestCard({ deckKey: "doodads", amount: 0.1 }), player)).toBe(1000);
    });

    it("returns 0 for property damage when player has no matching property", () => {
      const player = createTestPlayer({ assets: [] });
      expect(
        deriveCardCostForPlayer(createTestCard({ type: "Property Damage", propertyType: "rental" }), player)
      ).toBe(0);
    });
  });
});
