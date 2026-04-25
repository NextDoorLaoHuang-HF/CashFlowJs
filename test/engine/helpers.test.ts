import { describe, expect, it } from "vitest";
import {
  applyBankLoan,
  ensureFunds,
  recalcPlayerIncome,
  hasReachedFastTrackGoal,
  calculateVisitedSquares,
  buildTurnOrder,
  applyVentureCashflow,
  captureFastTrackStatus,
  detectFastTrackUnlocks,
  clonePlayerSnapshot,
  roundToNearestThousand
} from "@/lib/engine/helpers";
import { createTestPlayer } from "../helpers";
import type { JointVenture, Player } from "@/lib/types";

describe("Engine Helpers", () => {
  describe("roundToNearestThousand", () => {
    it("rounds up to nearest thousand", () => {
      expect(roundToNearestThousand(1)).toBe(1000);
      expect(roundToNearestThousand(1000)).toBe(1000);
      expect(roundToNearestThousand(1001)).toBe(2000);
      expect(roundToNearestThousand(2500)).toBe(3000);
    });
  });

  describe("applyBankLoan", () => {
    it("returns null for fastTrack players", () => {
      const player = createTestPlayer({ track: "fastTrack" });
      expect(applyBankLoan(player, 5000)).toBeNull();
    });

    it("returns null for non-positive amounts", () => {
      const player = createTestPlayer();
      expect(applyBankLoan(player, 0)).toBeNull();
      expect(applyBankLoan(player, -100)).toBeNull();
    });

    it("adds a bank loan and updates expenses", () => {
      const player = createTestPlayer({ cash: 1000 });
      const beforeExpenses = player.totalExpenses;
      const result = applyBankLoan(player, 3500);
      expect(result).not.toBeNull();
      expect(result!.principal).toBe(4000);
      expect(result!.payment).toBe(400);
      expect(player.cash).toBe(5000);
      expect(player.liabilities.some((l) => l.name === "Bank Loan" && l.metadata?.bank)).toBe(true);
      expect(player.totalExpenses).toBe(beforeExpenses + 400);
    });
  });

  describe("ensureFunds", () => {
    it("returns ok when no cost", () => {
      const player = createTestPlayer();
      expect(ensureFunds(player, 0)).toEqual({ ok: true });
      expect(ensureFunds(player, -100)).toEqual({ ok: true });
    });

    it("returns ok when player has enough cash", () => {
      const player = createTestPlayer({ cash: 5000 });
      expect(ensureFunds(player, 3000)).toEqual({ ok: true });
    });

    it("auto-applies bank loan when short", () => {
      const player = createTestPlayer({ cash: 1000 });
      const result = ensureFunds(player, 3500);
      expect(result.ok).toBe(true);
      expect(result.loan).toBeDefined();
      expect(player.cash).toBeGreaterThanOrEqual(0);
    });
  });

  describe("recalcPlayerIncome", () => {
    it("recalculates totalIncome and payday for ratRace", () => {
      const player = createTestPlayer({ scenario: { ...createTestPlayer().scenario, salary: 2000 } });
      player.passiveIncome = 500;
      recalcPlayerIncome(player);
      expect(player.totalIncome).toBe(2500);
      expect(player.payday).toBe(2500 - player.totalExpenses);
    });

    it("unlocks fast track when passiveIncome >= totalExpenses", () => {
      const player = createTestPlayer();
      player.passiveIncome = player.totalExpenses;
      recalcPlayerIncome(player);
      expect(player.fastTrackUnlocked).toBe(true);
    });

    it("does not unlock fast track when totalExpenses is 0", () => {
      const player = createTestPlayer({ totalExpenses: 0 });
      player.passiveIncome = 0;
      recalcPlayerIncome(player);
      expect(player.fastTrackUnlocked).toBe(false);
    });
  });

  describe("hasReachedFastTrackGoal", () => {
    it("returns true when passive income meets target on fast track", () => {
      const player = createTestPlayer({ track: "fastTrack", fastTrackTarget: 50000, passiveIncome: 50000 });
      expect(hasReachedFastTrackGoal(player)).toBe(true);
    });

    it("returns false when not on fast track", () => {
      const player = createTestPlayer({ track: "ratRace", fastTrackTarget: 50000, passiveIncome: 50000 });
      expect(hasReachedFastTrackGoal(player)).toBe(false);
    });
  });

  describe("calculateVisitedSquares", () => {
    it("returns empty array for zero or negative steps", () => {
      expect(calculateVisitedSquares(5, 0, 24)).toEqual([]);
      expect(calculateVisitedSquares(5, -1, 24)).toEqual([]);
    });

    it("calculates visited squares wrapping around", () => {
      expect(calculateVisitedSquares(22, 3, 24)).toEqual([23, 0, 1]);
      expect(calculateVisitedSquares(0, 3, 24)).toEqual([1, 2, 3]);
    });
  });

  describe("buildTurnOrder", () => {
    it("rotates players starting from the given player", () => {
      const p1 = createTestPlayer({ id: "p1" });
      const p2 = createTestPlayer({ id: "p2" });
      const p3 = createTestPlayer({ id: "p3" });
      const order = buildTurnOrder([p1, p2, p3], "p2");
      expect(order.map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
    });

    it("skips bankrupt players", () => {
      const p1 = createTestPlayer({ id: "p1", status: "bankrupt" });
      const p2 = createTestPlayer({ id: "p2" });
      const order = buildTurnOrder([p1, p2], "p1");
      expect(order.map((p) => p.id)).toEqual(["p2"]);
    });
  });

  describe("applyVentureCashflow", () => {
    it("distributes cashflow to participants by equity", () => {
      const p1 = createTestPlayer({ id: "p1", passiveIncome: 0 });
      const p2 = createTestPlayer({ id: "p2", passiveIncome: 0 });
      const venture: JointVenture = {
        id: "v1",
        name: "Test Venture",
        description: "Desc",
        cashNeeded: 1000,
        cashflowImpact: 1000,
        status: "active",
        participants: [
          { playerId: "p1", contribution: 500, equity: 60 },
          { playerId: "p2", contribution: 500, equity: 40 }
        ],
        createdAt: ""
      };
      applyVentureCashflow([p1, p2], venture, 1000);
      expect(p1.passiveIncome).toBe(600);
      expect(p2.passiveIncome).toBe(400);
    });

    it("does nothing when totalDelta is zero", () => {
      const p1 = createTestPlayer({ id: "p1" });
      const venture: JointVenture = {
        id: "v1",
        name: "Test",
        description: "Desc",
        cashNeeded: 1000,
        cashflowImpact: 0,
        status: "active",
        participants: [{ playerId: "p1", contribution: 1000, equity: 100 }],
        createdAt: ""
      };
      applyVentureCashflow([p1], venture, 0);
      expect(p1.passiveIncome).toBe(0);
    });
  });

  describe("captureFastTrackStatus / detectFastTrackUnlocks", () => {
    it("detects newly unlocked players", () => {
      const p1 = createTestPlayer({ id: "p1", fastTrackUnlocked: false });
      const p2 = createTestPlayer({ id: "p2", fastTrackUnlocked: false });
      const before = captureFastTrackStatus([p1, p2]);
      p2.fastTrackUnlocked = true;
      const unlocked: Player[] = [];
      detectFastTrackUnlocks(before, [p1, p2], (p) => unlocked.push(p));
      expect(unlocked).toEqual([p2]);
    });
  });

  describe("clonePlayerSnapshot", () => {
    it("deep clones assets and liabilities", () => {
      const player = createTestPlayer({
        assets: [{ id: "a1", name: "Asset", category: "stock", cashflow: 10, cost: 100, metadata: { x: 1 } }],
        liabilities: [{ id: "l1", name: "Loan", payment: 10, balance: 100, category: "loan", metadata: { y: 2 } }]
      });
      const clone = clonePlayerSnapshot(player);
      expect(clone.assets).not.toBe(player.assets);
      expect(clone.liabilities).not.toBe(player.liabilities);
      expect(clone.assets[0]).not.toBe(player.assets[0]);
      expect(clone.liabilities[0]).not.toBe(player.liabilities[0]);
    });
  });
});
