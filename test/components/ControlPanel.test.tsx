import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { produce } from "immer";
import { ControlPanel } from "@/components/ControlPanel";
import { useGameStore } from "@/lib/state/gameStore";
import { scenarios, dreams } from "@/lib/data/scenarios";

describe("ControlPanel", () => {
  beforeEach(() => {
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
});
