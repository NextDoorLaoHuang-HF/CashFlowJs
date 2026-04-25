import { describe, expect, it } from "vitest";
import { buildDeckFromSource, drawCardFromDeck } from "@/lib/engine/deck";
import { createTestSettings } from "../helpers";
import type { DeckKey } from "@/lib/engine/types";

describe("deck", () => {
  describe("buildDeckFromSource", () => {
    it("returns empty deck when smallDeals disabled", () => {
      const result = buildDeckFromSource("smallDeals", createTestSettings({ enableSmallDeals: false }), 12345);
      expect(result.deck).toEqual([]);
    });

    it("returns empty deck when bigDeals disabled", () => {
      const result = buildDeckFromSource("bigDeals", createTestSettings({ enableBigDeals: false }), 12345);
      expect(result.deck).toEqual([]);
    });

    it("builds a non-empty shuffled deck when enabled", () => {
      const result = buildDeckFromSource("smallDeals", createTestSettings({ enableSmallDeals: true }), 12345);
      expect(result.deck.length).toBeGreaterThan(0);
      expect(result.rngState).not.toBe(12345);
    });

    it("filters out preferred stock when disabled", () => {
      const result = buildDeckFromSource(
        "smallDeals",
        createTestSettings({ enablePreferredStock: false }),
        12345
      );
      const hasPreferred = result.deck.some((c) => c.type?.toLowerCase().includes("preferred stock"));
      expect(hasPreferred).toBe(false);
    });
  });

  describe("drawCardFromDeck", () => {
    it("draws the top card from the deck", () => {
      const decks = {
        smallDeals: [{ id: "c1", type: "Stock", name: "A", description: "d" }],
        bigDeals: [],
        offers: [],
        doodads: []
      } as Record<DeckKey, import("@/lib/types").BaseCard[]>;
      const result = drawCardFromDeck(decks, { smallDeals: [], bigDeals: [], offers: [], doodads: [] }, createTestSettings(), 12345, "smallDeals");
      expect(result.card?.id).toBe("c1");
      expect(result.decks.smallDeals).toEqual([]);
    });

    it("reshuffles discard when deck is empty", () => {
      const card = { id: "c1", type: "Stock", name: "A", description: "d" };
      const decks = { smallDeals: [], bigDeals: [], offers: [], doodads: [] } as Record<DeckKey, import("@/lib/types").BaseCard[]>;
      const discard = { smallDeals: [card], bigDeals: [], offers: [], doodads: [] } as Record<DeckKey, import("@/lib/types").BaseCard[]>;
      const result = drawCardFromDeck(decks, discard, createTestSettings(), 12345, "smallDeals");
      expect(result.card?.id).toBe("c1");
      expect(result.decks.smallDeals).toEqual([]);
      expect(result.discard.smallDeals).toEqual([]);
    });

    it("skips doodads requiring children when player has none", () => {
      const childCard = { id: "c-child", type: "Doodad", name: "School Fee", description: "d", child: true };
      const normalCard = { id: "c-normal", type: "Doodad", name: "Coffee", description: "d" };
      const decks = {
        smallDeals: [],
        bigDeals: [],
        offers: [],
        doodads: [childCard, normalCard]
      } as Record<DeckKey, import("@/lib/types").BaseCard[]>;
      const result = drawCardFromDeck(
        decks,
        { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        createTestSettings(),
        12345,
        "doodads",
        { children: 0 }
      );
      expect(result.card?.id).toBe("c-normal");
      expect(result.discard.doodads.length).toBe(1);
    });

    it("allows child doodads when player has children", () => {
      const childCard = { id: "c-child", type: "Doodad", name: "School Fee", description: "d", child: true };
      const decks = {
        smallDeals: [],
        bigDeals: [],
        offers: [],
        doodads: [childCard]
      } as Record<DeckKey, import("@/lib/types").BaseCard[]>;
      const result = drawCardFromDeck(
        decks,
        { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        createTestSettings(),
        12345,
        "doodads",
        { children: 1 }
      );
      expect(result.card?.id).toBe("c-child");
    });

    it("returns undefined when no cards are available", () => {
      const decks = { smallDeals: [], bigDeals: [], offers: [], doodads: [] } as Record<DeckKey, import("@/lib/types").BaseCard[]>;
      const result = drawCardFromDeck(decks, { smallDeals: [], bigDeals: [], offers: [], doodads: [] }, createTestSettings(), 12345, "smallDeals");
      expect(result.card).toBeUndefined();
    });
  });
});
