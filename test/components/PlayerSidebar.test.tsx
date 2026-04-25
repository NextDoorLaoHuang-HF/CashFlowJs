import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerSidebar } from "@/components/PlayerSidebar";
import { useGameStore } from "@/lib/state/gameStore";
import { scenarios, dreams } from "@/lib/data/scenarios";
import { produce } from "immer";

describe("PlayerSidebar", () => {
  beforeEach(() => {
    useGameStore.getState().initGame({
      players: [
        { name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id }
      ],
      settings: { locale: "zh" }
    });
  });

  it("renders player name and stats", () => {
    render(<PlayerSidebar />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("marks active player with correct class", () => {
    const { container } = render(<PlayerSidebar />);
    const activeCard = container.querySelector(".player-card-active");
    expect(activeCard).toBeInTheDocument();
  });

  it("marks bankrupt player with correct class", () => {
    useGameStore.setState(produce((s: any) => {
      s.players[0].status = "bankrupt";
    }));
    const { container } = render(<PlayerSidebar />);
    expect(container.querySelector(".player-card-bankrupt")).toBeInTheDocument();
  });

  it("shows fast track badge", () => {
    useGameStore.setState(produce((s: any) => {
      s.players[0].track = "fastTrack";
    }));
    render(<PlayerSidebar />);
    expect(screen.getByText(/快车道/i)).toBeInTheDocument();
  });

  it("renders bank loans when present", () => {
    useGameStore.setState(produce((s: any) => {
      s.players[0].liabilities = [
        { id: "loan1", name: "Bank Loan", balance: 5000, payment: 500, metadata: { bank: true } }
      ];
    }));
    render(<PlayerSidebar />);
    expect(screen.getByText("$5,000")).toBeInTheDocument();
  });

  it("does not render bank loan section when no bank loans", () => {
    render(<PlayerSidebar />);
    expect(screen.queryByText(/银行贷款余额/i)).not.toBeInTheDocument();
  });
});
