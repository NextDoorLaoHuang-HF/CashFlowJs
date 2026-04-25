import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BankLoansPanel } from "@/components/BankLoansPanel";
import { useGameStore } from "@/lib/state/gameStore";
import { scenarios, dreams } from "@/lib/data/scenarios";
import { produce } from "immer";

describe("BankLoansPanel", () => {
  beforeEach(() => {
    useGameStore.getState().initGame({
      players: [
        { name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id }
      ],
      settings: { locale: "zh" }
    });
  });

  it("returns null when player is on fast track", () => {
    useGameStore.setState(produce((s: any) => {
      s.players[0].track = "fastTrack";
    }));
    const { container } = render(<BankLoansPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when no bank loans", () => {
    useGameStore.setState(produce((s: any) => {
      s.players[0].liabilities = [];
    }));
    const { container } = render(<BankLoansPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("renders bank loans with repay buttons", () => {
    useGameStore.setState(produce((s: any) => {
      s.players[0].liabilities = [
        { id: "loan1", name: "Mortgage", balance: 50000, payment: 400, metadata: { bank: true } }
      ];
      s.players[0].cash = 5000;
      s.turnState = "awaitEnd";
    }));
    render(<BankLoansPanel />);
    expect(screen.getByText("Mortgage")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /还 \$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /结清/i })).toBeInTheDocument();
  });

  it("disables repay buttons when not awaitEnd", () => {
    useGameStore.setState(produce((s: any) => {
      s.players[0].liabilities = [
        { id: "loan1", name: "Mortgage", balance: 50000, payment: 400, metadata: { bank: true } }
      ];
      s.players[0].cash = 5000;
      s.turnState = "awaitRoll";
    }));
    render(<BankLoansPanel />);
    expect(screen.getByRole("button", { name: /还 \$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /结清/i })).toBeDisabled();
  });

  it("calls repayBankLoan on repay step click", () => {
    const repaySpy = vi.fn();
    useGameStore.setState(produce((s: any) => {
      s.players[0].liabilities = [
        { id: "loan1", name: "Mortgage", balance: 50000, payment: 400, metadata: { bank: true } }
      ];
      s.players[0].cash = 5000;
      s.turnState = "awaitEnd";
    }));
    // Override the store method after init
    const original = useGameStore.getState().repayBankLoan;
    useGameStore.setState({ repayBankLoan: repaySpy });

    render(<BankLoansPanel />);
    fireEvent.click(screen.getByRole("button", { name: /还 \$/i }));
    expect(repaySpy).toHaveBeenCalledWith("loan1", 1000);

    useGameStore.setState({ repayBankLoan: original });
  });

  it("calls repayBankLoan on payoff click", () => {
    const repaySpy = vi.fn();
    useGameStore.setState(produce((s: any) => {
      s.players[0].liabilities = [
        { id: "loan1", name: "Mortgage", balance: 5000, payment: 400, metadata: { bank: true } }
      ];
      s.players[0].cash = 5000;
      s.turnState = "awaitEnd";
    }));
    const original = useGameStore.getState().repayBankLoan;
    useGameStore.setState({ repayBankLoan: repaySpy });

    render(<BankLoansPanel />);
    fireEvent.click(screen.getByRole("button", { name: /结清/i }));
    expect(repaySpy).toHaveBeenCalledWith("loan1", 5000);

    useGameStore.setState({ repayBankLoan: original });
  });
});
