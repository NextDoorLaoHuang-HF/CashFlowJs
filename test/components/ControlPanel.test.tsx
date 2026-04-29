import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { produce } from "immer";
import { ControlPanel } from "@/components/ControlPanel";
import { useGameStore } from "@/lib/state/gameStore";
import { useMultiplayerStore } from "@/lib/multiplayer/syncStore";
import { scenarios, dreams } from "@/lib/data/scenarios";

describe("ControlPanel", () => {
  beforeEach(() => {
    useMultiplayerStore.getState().clearRoom();
    useGameStore.getState().initGame({
      players: [
        { name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id }
      ],
      settings: { locale: "zh" }
    });
  });

  it("renders roll button when awaiting roll", () => {
    render(<ControlPanel />);
    expect(screen.getByRole("button", { name: /掷骰子/i })).toBeInTheDocument();
  });

  it("renders end turn button when awaiting end", () => {
    useGameStore.setState(produce((s) => {
      s.turnState = "awaitEnd";
    }));
    render(<ControlPanel />);
    expect(screen.getByRole("button", { name: /结束回合/i })).toBeInTheDocument();
  });

  it("renders charity prompt when awaiting charity", () => {
    useGameStore.setState(produce((s) => {
      s.turnState = "awaitCharity";
      s.charityPrompt = { playerId: s.players[0].id, amount: 200 };
    }));
    render(<ControlPanel />);
    expect(screen.getByText(/慈善捐款/i)).toBeInTheDocument();
  });

  it("renders card controls when card is selected", () => {
    useGameStore.setState(produce((s) => {
      s.turnState = "awaitCard";
      s.selectedCard = {
        id: "test-card",
        type: "Stock",
        name: "Test Stock",
        description: "Test",
        deckKey: "smallDeals",
        cost: 5000,
        cashFlow: 200
      };
    }));
    render(<ControlPanel />);
    expect(screen.getByText(/Test Stock/i)).toBeInTheDocument();
  });

  describe("multiplayer", () => {
    beforeEach(() => {
      useGameStore.getState().initGame({
        players: [
          { name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id },
          { name: "Bob", color: "#00ff00", scenarioId: scenarios[1].id, dreamId: dreams[1].id }
        ],
        settings: { locale: "zh" }
      });
    });

    it("shows waiting overlay and disables roll button when it is not the local player's turn", () => {
      const state = useGameStore.getState();
      const bobId = state.players[1].id;

      useGameStore.setState(produce((s: any) => {
        s.currentPlayerId = bobId;
      }));

      // Local player is Alice (slot 0), but it's Bob's turn
      useMultiplayerStore.setState({ playerSlot: 0, roomId: "room-123" });

      render(<ControlPanel />);
      expect(screen.getByText(/等待中/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /掷骰子/i })).toBeDisabled();
    });

    it("does not show waiting overlay when it is the local player's turn", () => {
      const state = useGameStore.getState();
      const aliceId = state.players[0].id;

      useGameStore.setState(produce((s: any) => {
        s.currentPlayerId = aliceId;
      }));

      useMultiplayerStore.setState({ playerSlot: 0, roomId: "room-123" });

      render(<ControlPanel />);
      expect(screen.queryByText(/等待中/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /掷骰子/i })).not.toBeDisabled();
    });

    it("does not show charity prompt when it belongs to another player", () => {
      const state = useGameStore.getState();
      const bobId = state.players[1].id;

      useGameStore.setState(produce((s: any) => {
        s.turnState = "awaitCharity";
        s.charityPrompt = { playerId: bobId, amount: 200 };
        s.currentPlayerId = bobId;
      }));

      // Local player is Alice (slot 0)
      useMultiplayerStore.setState({ playerSlot: 0, roomId: "room-123" });

      render(<ControlPanel />);
      expect(screen.queryByText(/慈善捐款/i)).not.toBeInTheDocument();
    });

    it("shows charity prompt when it belongs to the local player", () => {
      const state = useGameStore.getState();
      const aliceId = state.players[0].id;

      useGameStore.setState(produce((s: any) => {
        s.turnState = "awaitCharity";
        s.charityPrompt = { playerId: aliceId, amount: 200 };
        s.currentPlayerId = aliceId;
      }));

      useMultiplayerStore.setState({ playerSlot: 0, roomId: "room-123" });

      render(<ControlPanel />);
      expect(screen.getByText(/慈善捐款/i)).toBeInTheDocument();
    });

    it("does not show liquidation panel when it belongs to another player", () => {
      const state = useGameStore.getState();
      const bobId = state.players[1].id;

      useGameStore.setState(produce((s: any) => {
        s.turnState = "awaitLiquidation";
        s.liquidationSession = { playerId: bobId, requiredCash: 5000, reason: { kind: "fastTrackPenalty" } };
        s.currentPlayerId = bobId;
      }));

      // Local player is Alice (slot 0)
      useMultiplayerStore.setState({ playerSlot: 0, roomId: "room-123" });

      render(<ControlPanel />);
      expect(screen.queryByText(/资产清算/i)).not.toBeInTheDocument();
    });

    it("shows liquidation panel when it belongs to the local player", () => {
      const state = useGameStore.getState();
      const aliceId = state.players[0].id;

      useGameStore.setState(produce((s: any) => {
        s.turnState = "awaitLiquidation";
        s.liquidationSession = { playerId: aliceId, requiredCash: 5000, reason: { kind: "fastTrackPenalty" } };
        s.currentPlayerId = aliceId;
      }));

      useMultiplayerStore.setState({ playerSlot: 0, roomId: "room-123" });

      render(<ControlPanel />);
      expect(screen.getByText(/资产清算/i)).toBeInTheDocument();
    });
  });
});
