import { describe, expect, it, beforeEach } from "vitest";
import { produce } from "immer";
import { useGameStore } from "@/lib/state/gameStore";
import { scenarios, dreams } from "@/lib/data/scenarios";

const resetStore = () => {
  const state = useGameStore.getState();
  state.initGame({
    players: [
      { name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id },
      { name: "Bob", color: "#00ff00", scenarioId: scenarios[1].id, dreamId: dreams[1].id }
    ],
    settings: { locale: "zh" }
  });
};

describe("gameStore", () => {
  beforeEach(() => {
    // Re-initialize store to a known state before each test
    resetStore();
  });

  describe("initGame", () => {
    it("initializes with correct player count and defaults", () => {
      const state = useGameStore.getState();
      expect(state.players.length).toBe(2);
      expect(state.phase).toBe("ratRace");
      expect(state.turnState).toBe("awaitRoll");
      expect(state.currentPlayerId).toBe(state.players[0].id);
      expect(state.turn).toBe(1);
      expect(state.logs.length).toBeGreaterThan(0);
    });

    it("throws when both deal decks are disabled", () => {
      expect(() =>
        useGameStore.getState().initGame({
          players: [{ name: "A", color: "#f00", scenarioId: scenarios[0].id, dreamId: dreams[0].id }],
          settings: { enableSmallDeals: false, enableBigDeals: false }
        })
      ).toThrow("Invalid game settings");
    });
  });

  describe("rollDice", () => {
    it("changes player position and sets dice", () => {
      const state = useGameStore.getState();
      const beforePosition = state.players[0].position;
      state.rollDice();
      const afterState = useGameStore.getState();
      expect(afterState.dice).toBeDefined();
      expect(afterState.dice!.total).toBeGreaterThanOrEqual(1);
      expect(afterState.players[0].position).not.toBe(beforePosition);
      expect(afterState.turnState).not.toBe("awaitRoll");
    });

    it("does nothing when not in awaitRoll", () => {
      const state = useGameStore.getState();
      // Force turn state to awaitEnd
      useGameStore.setState({ turnState: "awaitEnd" });
      const beforeDice = useGameStore.getState().dice;
      state.rollDice();
      expect(useGameStore.getState().dice).toBe(beforeDice);
    });
  });

  describe("drawCard", () => {
    it("draws a small deal card when on opportunity square", () => {
      const state = useGameStore.getState();
      // Move to an OPPORTUNITY square (index 0)
      useGameStore.setState(produce((s) => {
        s.players[0].position = 0;
        s.turnState = "awaitAction";
      }));
      state.drawCard("smallDeals");
      const after = useGameStore.getState();
      expect(after.selectedCard).toBeDefined();
      expect(["awaitCard", "awaitMarket"]).toContain(after.turnState);
    });

    it("does nothing when deck is empty", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.turnState = "awaitAction";
        s.decks.smallDeals = [];
        s.discard.smallDeals = [];
      }));
      state.drawCard("smallDeals");
      const after = useGameStore.getState();
      expect(after.selectedCard).toBeUndefined();
    });
  });

  describe("applySelectedCard / passSelectedCard", () => {
    it("applies a selected deal card", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.players[0].cash = 10000;
        s.turnState = "awaitCard";
        s.selectedCard = {
          id: "test-deal",
          type: "Stock",
          name: "Test Stock",
          description: "Test",
          deckKey: "smallDeals",
          cost: 5000,
          cashFlow: 200
        };
      }));
      state.applySelectedCard();
      const after = useGameStore.getState();
      expect(after.players[0].cash).toBe(5000);
      expect(after.players[0].passiveIncome).toBe(200);
      expect(after.turnState).toBe("awaitEnd");
    });

    it("passes an optional card", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.turnState = "awaitCard";
        s.selectedCard = {
          id: "test-opt",
          type: "Stock",
          name: "Optional",
          description: "Test",
          deckKey: "smallDeals",
          cost: 5000
        };
      }));
      const beforeLogs = useGameStore.getState().logs.length;
      state.passSelectedCard();
      const after = useGameStore.getState();
      expect(after.selectedCard).toBeUndefined();
      expect(after.turnState).toBe("awaitEnd");
      expect(after.logs.length).toBeGreaterThan(beforeLogs);
    });
  });

  describe("nextPlayer", () => {
    it("advances to next player and resets turn state", () => {
      const state = useGameStore.getState();
      const firstPlayerId = state.currentPlayerId;
      useGameStore.setState(produce((s) => {
        s.turnState = "awaitEnd";
      }));
      state.nextPlayer();
      const after = useGameStore.getState();
      expect(after.currentPlayerId).not.toBe(firstPlayerId);
      expect(after.turnState).toBe("awaitRoll");
    });
  });

  describe("charity", () => {
    it("donates and grants charity turns", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.turnState = "awaitCharity";
        s.charityPrompt = { playerId: s.players[0].id, amount: 200 };
        s.players[0].cash = 1000;
      }));
      state.donateCharity();
      const after = useGameStore.getState();
      expect(after.players[0].cash).toBe(800);
      expect(after.players[0].charityTurns).toBe(3);
      expect(after.turnState).toBe("awaitEnd");
    });

    it("skips charity", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.turnState = "awaitCharity";
        s.charityPrompt = { playerId: s.players[0].id, amount: 200 };
      }));
      state.skipCharity();
      const after = useGameStore.getState();
      expect(after.charityPrompt).toBeUndefined();
      expect(after.turnState).toBe("awaitEnd");
    });
  });

  describe("enterFastTrack", () => {
    it("moves unlocked player to fast track", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.players[0].fastTrackUnlocked = true;
        s.players[0].dream = dreams[0];
        s.turnState = "awaitEnd";
      }));
      state.enterFastTrack(state.players[0].id);
      const after = useGameStore.getState();
      expect(after.players[0].track).toBe("fastTrack");
      expect(after.players[0].position).toBe(0);
      expect(typeof after.players[0].fastTrackTarget).toBe("number");
      expect(after.players[0].fastTrackTarget).toBeGreaterThan(0);
    });
  });

  describe("addJointVenture", () => {
    it("adds a venture to the store", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.players[0].cash = 5000;
        s.players[1].cash = 5000;
      }));
      state.addJointVenture({
        name: "Test Venture",
        description: "Desc",
        cashNeeded: 1000,
        cashflowImpact: 500,
        participants: [
          { playerId: state.players[0].id, contribution: 500, equity: 50 },
          { playerId: state.players[1].id, contribution: 500, equity: 50 }
        ]
      });
      const after = useGameStore.getState();
      expect(after.ventures.length).toBe(1);
      expect(after.ventures[0].name).toBe("Test Venture");
      expect(after.ventures[0].status).toBe("forming");
    });
  });

  describe("addLoan / repayLoan", () => {
    it("adds and repays a loan", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.players[0].cash = 5000;
        s.players[1].cash = 1000;
      }));
      state.addLoan({
        lenderId: state.players[0].id,
        borrowerId: state.players[1].id,
        principal: 3000,
        rate: 0.1,
        issuedTurn: 1
      });
      const afterAdd = useGameStore.getState();
      expect(afterAdd.loans.length).toBe(1);
      expect(afterAdd.loans[0].remaining).toBe(3000);
      expect(afterAdd.players[0].cash).toBe(2000);
      expect(afterAdd.players[1].cash).toBe(4000);

      state.repayLoan(afterAdd.loans[0].id, 2000);
      const afterRepay = useGameStore.getState();
      expect(afterRepay.loans[0].remaining).toBe(1000);
    });
  });

  describe("repayBankLoan", () => {
    it("repays a bank loan liability", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.turnState = "awaitEnd";
        s.players[0].cash = 5000;
        s.players[0].track = "ratRace";
        s.players[0].liabilities.push({
          id: "bl-1",
          name: "Bank Loan",
          payment: 400,
          balance: 4000,
          category: "loan",
          metadata: { bank: true }
        });
        s.players[0].totalExpenses = s.players[0].totalExpenses + 400;
      }));
      state.repayBankLoan("bl-1", 2000);
      const after = useGameStore.getState();
      expect(after.players[0].cash).toBe(3000);
      const bankLoan = after.players[0].liabilities.find((l) => l.id === "bl-1");
      expect(bankLoan).toBeDefined();
      expect(bankLoan!.balance).toBe(2000);
    });
  });

  describe("sellFireSaleAsset", () => {
    it("sells asset at 50% cost", () => {
      const state = useGameStore.getState();
      useGameStore.setState(produce((s) => {
        s.players[0].assets.push({
          id: "a1",
          name: "House",
          category: "realEstate",
          cashflow: 200,
          cost: 10000
        });
        s.players[0].cash = 0;
      }));
      state.sellFireSaleAsset("a1", 1);
      const after = useGameStore.getState();
      expect(after.players[0].cash).toBe(5000);
      expect(after.players[0].assets.length).toBe(0);
    });
  });

  describe("setLocale / clearLog", () => {
    it("changes locale", () => {
      const state = useGameStore.getState();
      state.setLocale("en");
      expect(useGameStore.getState().settings.locale).toBe("en");
    });

    it("clears logs", () => {
      const state = useGameStore.getState();
      expect(state.logs.length).toBeGreaterThan(0);
      state.clearLog();
      expect(useGameStore.getState().logs).toEqual([]);
    });
  });

  describe("syncMultiplayerState", () => {
    it("merges external state into store", () => {
      const state = useGameStore.getState();
      state.syncMultiplayerState({ turn: 99, phase: "fastTrack" });
      const after = useGameStore.getState();
      expect(after.turn).toBe(99);
      expect(after.phase).toBe("fastTrack");
    });
  });
});
