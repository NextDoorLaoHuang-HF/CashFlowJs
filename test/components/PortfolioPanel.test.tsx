import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortfolioPanel } from "@/components/PortfolioPanel";
import { useGameStore } from "@/lib/state/gameStore";
import { useMultiplayerStore } from "@/lib/multiplayer/syncStore";
import { scenarios, dreams } from "@/lib/data/scenarios";
import { produce } from "immer";

describe("PortfolioPanel", () => {
  beforeEach(() => {
    useMultiplayerStore.getState().clearRoom();
    useGameStore.getState().initGame({
      players: [
        { name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id },
        { name: "Bob", color: "#00ff00", scenarioId: scenarios[1].id, dreamId: dreams[1].id }
      ],
      settings: { locale: "zh" }
    });
  });

  it("renders local current player's assets (single-player fallback)", () => {
    useGameStore.setState(produce((s: any) => {
      s.players[0].assets = [{ id: "a1", name: "Alice Stock", category: "stock", cost: 1000, cashflow: 50, quantity: 5 }];
    }));
    render(<PortfolioPanel />);
    expect(screen.getByText("Alice Stock")).toBeInTheDocument();
  });

  it("in multiplayer, always shows the local player's assets regardless of current turn", () => {
    const state = useGameStore.getState();
    const aliceId = state.players[0].id;
    const bobId = state.players[1].id;

    useGameStore.setState(produce((s: any) => {
      s.players[0].assets = [{ id: "a1", name: "Alice Stock", category: "stock", cost: 1000, cashflow: 50, quantity: 5 }];
      s.players[1].assets = [{ id: "a2", name: "Bob Stock", category: "stock", cost: 2000, cashflow: 100, quantity: 3 }];
      s.currentPlayerId = bobId;
    }));

    // Simulate player 0 (Alice) viewing the panel in an online room
    useMultiplayerStore.setState({ playerSlot: 0 });

    render(<PortfolioPanel />);
    expect(screen.getByText("Alice Stock")).toBeInTheDocument();
    expect(screen.queryByText("Bob Stock")).not.toBeInTheDocument();
  });

  it("in multiplayer, shows player 1's assets when playerSlot is 1", () => {
    const state = useGameStore.getState();
    const bobId = state.players[1].id;

    useGameStore.setState(produce((s: any) => {
      s.players[0].assets = [{ id: "a1", name: "Alice Stock", category: "stock", cost: 1000, cashflow: 50, quantity: 5 }];
      s.players[1].assets = [{ id: "a2", name: "Bob Stock", category: "stock", cost: 2000, cashflow: 100, quantity: 3 }];
      s.currentPlayerId = bobId;
    }));

    useMultiplayerStore.setState({ playerSlot: 1 });

    render(<PortfolioPanel />);
    expect(screen.getByText("Bob Stock")).toBeInTheDocument();
    expect(screen.queryByText("Alice Stock")).not.toBeInTheDocument();
  });
});
