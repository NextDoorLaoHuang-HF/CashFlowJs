import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn()
}));

import { createAdminClient } from "@/lib/supabase/server";
import { submitAction, getGameState } from "@/app/actions/gameActions";
import type { GameAction } from "@/lib/engine/gameEngine";

class MockSupabase {
  private singleResponses: Array<{ data: unknown; error: unknown }> = [];
  private queryData: unknown[] | null = null;
  private queryCount: number | null = null;

  queueSingle(data: unknown, error?: unknown) {
    this.singleResponses.push({ data, error: error ?? null });
  }

  setQueryData(data: unknown[]) {
    this.queryData = data;
  }

  setQueryCount(count: number) {
    this.queryCount = count;
  }

  from = vi.fn(() => this.chain);
  select = vi.fn(() => this.chain);
  insert = vi.fn(() => this.chain);
  update = vi.fn(() => this.chain);
  delete = vi.fn(() => this.chain);
  upsert = vi.fn(() => this.chain);
  eq = vi.fn(() => this.chain);
  order = vi.fn(() => this.chain);
  count = vi.fn(() => this.chain);
  head = vi.fn(() => this.chain);

  single = vi.fn(() => {
    const next = this.singleResponses.shift() ?? { data: null, error: null };
    return Promise.resolve(next);
  });

  private chain: any = new Proxy(this, {
    get(target, prop) {
      if (prop === "then") {
        return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
          if (target.queryData !== null) {
            return Promise.resolve({ data: target.queryData, error: null }).then(onFulfilled, onRejected);
          }
          if (target.queryCount !== null) {
            return Promise.resolve({ count: target.queryCount, error: null }).then(onFulfilled, onRejected);
          }
          return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
        };
      }
      const value = (target as any)[prop];
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    }
  });
}

describe("gameActions", () => {
  let supabase: MockSupabase;

  beforeEach(() => {
    supabase = new MockSupabase();
    vi.mocked(createAdminClient).mockReturnValue(supabase as any);
  });

  describe("submitAction", () => {
    it("throws when game state not found", async () => {
      supabase.queueSingle(null, new Error("not found"));
      await expect(submitAction("room-1", "user-1", { type: "rollDice" } as GameAction, 1)).rejects.toThrow("Game state not found");
    });

    it("returns conflict when version mismatch", async () => {
      const gameState = {
        room_id: "room-1",
        version: 5,
        phase: "ratRace",
        players: [{ id: "p1" }],
        current_player_id: "p1",
        turn_state: "awaitRoll",
        rng_seed: 12345,
        rng_state: 12345,
        decks: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        discard: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        turn: 1,
        logs: [],
        replay_frames: [],
        ventures: [],
        loans: [],
        settings: { locale: "zh" },
        history: [],
        charity_prompt: undefined,
        dice: undefined,
        selected_card: undefined,
        market_session: undefined,
        liquidation_session: undefined
      };
      supabase.queueSingle(gameState, null);

      const result = await submitAction("room-1", "user-1", { type: "rollDice" } as GameAction, 1);
      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.currentVersion).toBe(5);
    });

    it("throws when player not found in room", async () => {
      const gameState = {
        room_id: "room-1",
        version: 1,
        phase: "ratRace",
        players: [{ id: "p1" }],
        current_player_id: "p1",
        turn_state: "awaitRoll",
        rng_seed: 12345,
        rng_state: 12345,
        decks: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        discard: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        turn: 1,
        logs: [],
        replay_frames: [],
        ventures: [],
        loans: [],
        settings: { locale: "zh" },
        history: [],
        charity_prompt: undefined,
        dice: undefined,
        selected_card: undefined,
        market_session: undefined,
        liquidation_session: undefined
      };
      supabase.queueSingle(gameState, null);
      supabase.queueSingle(null, new Error("not found"));

      await expect(submitAction("room-1", "user-1", { type: "rollDice" } as GameAction, 1)).rejects.toThrow("Player not found");
    });

    it("throws when not player's turn", async () => {
      const gameState = {
        room_id: "room-1",
        version: 1,
        phase: "ratRace",
        players: [{ id: "p1" }, { id: "p2" }],
        current_player_id: "p2",
        turn_state: "awaitRoll",
        rng_seed: 12345,
        rng_state: 12345,
        decks: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        discard: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        turn: 1,
        logs: [],
        replay_frames: [],
        ventures: [],
        loans: [],
        settings: { locale: "zh" },
        history: [],
        charity_prompt: undefined,
        dice: undefined,
        selected_card: undefined,
        market_session: undefined,
        liquidation_session: undefined
      };
      supabase.queueSingle(gameState, null);
      supabase.queueSingle({ player_slot: 0 }, null);

      await expect(submitAction("room-1", "user-1", { type: "rollDice" } as GameAction, 1)).rejects.toThrow("Not your turn");
    });

    it("successfully applies action and saves state", async () => {
      const gameState = {
        room_id: "room-1",
        version: 1,
        phase: "ratRace",
        players: [{ id: "p1", name: "A", color: "#f00", scenario: { salary: 1600, savings: 560, taxes: 280, mortgagePayment: 200, carPayment: 60, creditCardPayment: 60, retailPayment: 50, otherExpenses: 300, mortgage: 20000, carLoan: 4000, creditDebt: 2000, retailDebt: 1000 }, cash: 1000, passiveIncome: 0, totalIncome: 1600, totalExpenses: 950, payday: 650, position: 0, assets: [], liabilities: [], charityTurns: 0, children: 0, childExpense: 0, skipTurns: 0, fastTrackUnlocked: false, status: "active", track: "ratRace" }],
        current_player_id: "p1",
        turn_state: "awaitRoll",
        rng_seed: 12345,
        rng_state: 12345,
        decks: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        discard: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
        turn: 1,
        logs: [],
        replay_frames: [],
        ventures: [],
        loans: [],
        settings: { locale: "zh", startingSavingsMode: "normal", enablePreferredStock: true, enableBigDeals: true, enableSmallDeals: true, enableLLMPlayers: false, useCashflowDice: true },
        history: [{ turn: 1, players: [] }],
        charity_prompt: undefined,
        dice: undefined,
        selected_card: undefined,
        market_session: undefined,
        liquidation_session: undefined
      };
      supabase.queueSingle(gameState, null);
      supabase.queueSingle({ player_slot: 0 }, null);

      // Mock update chain: update(...).eq(...).eq(...) resolves to { error: null }
      const updateChain: any = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (v: unknown) => void) => resolve({ error: null });
            }
            return () => updateChain;
          }
        }
      );
      supabase.update.mockReturnValue(updateChain);

      const result = await submitAction("room-1", "user-1", { type: "rollDice" } as GameAction, 1);
      expect(result.success).toBe(true);
      expect(result.version).toBe(2);
      expect(result.state).toBeDefined();
    });
  });

  describe("getGameState", () => {
    it("returns game state", async () => {
      const state = { id: "gs-1", room_id: "room-1" };
      supabase.queueSingle(state, null);
      const result = await getGameState("room-1");
      expect(result).toEqual(state);
    });

    it("throws on error", async () => {
      supabase.queueSingle(null, new Error("fail"));
      await expect(getGameState("room-1")).rejects.toThrow("fail");
    });
  });
});
