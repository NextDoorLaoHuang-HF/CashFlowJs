import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn()
}));

import { createAdminClient } from "@/lib/supabase/server";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  readyUp,
  startGame,
  getRoomState
} from "@/app/actions/roomActions";

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

describe("roomActions", () => {
  let supabase: MockSupabase;

  beforeEach(() => {
    supabase = new MockSupabase();
    vi.mocked(createAdminClient).mockReturnValue(supabase as any);
  });

  describe("createRoom", () => {
    it("creates a room and returns it", async () => {
      const mockRoom = { id: "room-1", code: "ABC123", host_id: "user-1", status: "waiting" };
      supabase.queueSingle(mockRoom, null);

      const result = await createRoom("user-1", { locale: "zh" });
      expect(result).toEqual(mockRoom);
      expect(supabase.from).toHaveBeenCalledWith("rooms");
    });

    it("throws on supabase error", async () => {
      supabase.queueSingle(null, new Error("DB error"));
      await expect(createRoom("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("joinRoom", () => {
    it("joins an existing room", async () => {
      const mockRoom = { id: "room-1", code: "ABC123", status: "waiting" };
      const mockPlayer = { id: "rp-1", room_id: "room-1", user_id: "user-2", player_slot: 1 };

      supabase.queueSingle(mockRoom, null); // room lookup
      supabase.queueSingle(null, null); // existing player check
      supabase.setQueryData([{ player_slot: 0 }]);
      supabase.queueSingle(mockPlayer, null); // insert player

      const result = await joinRoom("abc123", "user-2", "Alice", "#f00");
      expect(result.room).toEqual(mockRoom);
      expect(result.player).toEqual(mockPlayer);
    });

    it("throws when room not found", async () => {
      supabase.queueSingle(null, new Error("not found"));
      await expect(joinRoom("badcode", "user-1", "A", "#f00")).rejects.toThrow("Room not found");
    });

    it("throws when room is not waiting", async () => {
      supabase.queueSingle({ status: "playing" }, null);
      await expect(joinRoom("abc123", "user-1", "A", "#f00")).rejects.toThrow("not accepting");
    });

    it("returns existing player if already joined", async () => {
      const mockRoom = { id: "room-1", status: "waiting" };
      const existing = { id: "rp-1" };
      supabase.queueSingle(mockRoom, null);
      supabase.queueSingle(existing, null);

      const result = await joinRoom("abc123", "user-1", "A", "#f00");
      expect(result.player).toEqual(existing);
    });

    it("throws when room is full", async () => {
      const mockRoom = { id: "room-1", status: "waiting" };
      supabase.queueSingle(mockRoom, null);
      supabase.queueSingle(null, null);

      const filledSlots = Array.from({ length: 6 }, (_, i) => ({ player_slot: i }));
      supabase.setQueryData(filledSlots);

      await expect(joinRoom("abc123", "user-1", "A", "#f00")).rejects.toThrow("Room is full");
    });
  });

  describe("leaveRoom", () => {
    it("deletes player and room if empty", async () => {
      supabase.setQueryCount(0);
      const result = await leaveRoom("room-1", "user-1");
      expect(result.success).toBe(true);
    });

    it("deletes player but keeps room if not empty", async () => {
      supabase.setQueryCount(2);
      const result = await leaveRoom("room-1", "user-1");
      expect(result.success).toBe(true);
    });
  });

  describe("readyUp", () => {
    it("updates player ready status", async () => {
      const updated = { id: "rp-1", is_ready: true, scenario_id: "s1", dream_id: "d1" };
      supabase.queueSingle(updated, null);
      const result = await readyUp("room-1", "user-1", "s1", "d1");
      expect(result).toEqual(updated);
    });
  });

  describe("startGame", () => {
    it("starts game when host and players are ready", async () => {
      const mockRoom = { id: "room-1", host_id: "host-1", settings: {} };
      const readyPlayers = [
        { player_slot: 0, name: "A", color: "#f00", scenario_id: "janitor", dream_id: "stock-market-for-kids", user_id: "host-1" }
      ];

      supabase.queueSingle(mockRoom, null);
      supabase.setQueryData(readyPlayers);
      supabase.queueSingle({}, null); // upsert

      const result = await startGame("room-1", "host-1");
      expect(result.success).toBe(true);
      expect(result.playerCount).toBe(1);
    });

    it("throws when non-host tries to start", async () => {
      const mockRoom = { id: "room-1", host_id: "host-1" };
      supabase.queueSingle(mockRoom, null);
      await expect(startGame("room-1", "other-user")).rejects.toThrow("Only host");
    });

    it("throws when no players are ready", async () => {
      const mockRoom = { id: "room-1", host_id: "host-1" };
      supabase.queueSingle(mockRoom, null);
      supabase.setQueryData([]);
      await expect(startGame("room-1", "host-1")).rejects.toThrow("At least one player");
    });
  });

  describe("getRoomState", () => {
    it("returns room, players and game state", async () => {
      const room = { id: "room-1" };
      const players = [{ id: "rp-1" }];
      const gameState = { id: "gs-1" };

      supabase.queueSingle(room, null);
      supabase.setQueryData(players);
      supabase.queueSingle(gameState, null);

      const result = await getRoomState("room-1");
      expect(result.room).toEqual(room);
      expect(result.players).toEqual(players);
      expect(result.gameState).toEqual(gameState);
    });
  });
});
