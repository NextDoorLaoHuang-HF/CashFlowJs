import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoansPanel } from "@/components/LoansPanel";
import { useGameStore } from "@/lib/state/gameStore";
import { scenarios, dreams } from "@/lib/data/scenarios";
import { produce } from "immer";

describe("LoansPanel", () => {
  beforeEach(() => {
    useGameStore.getState().initGame({
      players: [
        { name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id },
        { name: "Bob", color: "#00ff00", scenarioId: scenarios[1].id, dreamId: dreams[1].id }
      ],
      settings: { locale: "zh" }
    });
  });

  it("renders empty state", () => {
    render(<LoansPanel />);
    expect(screen.getByText(/暂无借贷/i)).toBeInTheDocument();
  });

  it("creates a new loan", () => {
    const addSpy = vi.fn();
    const original = useGameStore.getState().addLoan;
    useGameStore.setState({ addLoan: addSpy });

    render(<LoansPanel />);

    // Select lender
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: useGameStore.getState().players[0].id } });
    fireEvent.change(selects[1], { target: { value: useGameStore.getState().players[1].id } });

    fireEvent.click(screen.getByRole("button", { name: /创建借贷/i }));

    expect(addSpy).toHaveBeenCalled();
    useGameStore.setState({ addLoan: original });
  });

  it("does not create loan when lender equals borrower", () => {
    const addSpy = vi.fn();
    const original = useGameStore.getState().addLoan;
    useGameStore.setState({ addLoan: addSpy });

    render(<LoansPanel />);
    const selects = screen.getAllByRole("combobox");
    const p1Id = useGameStore.getState().players[0].id;
    fireEvent.change(selects[0], { target: { value: p1Id } });
    fireEvent.change(selects[1], { target: { value: p1Id } });

    fireEvent.click(screen.getByRole("button", { name: /创建借贷/i }));
    expect(addSpy).not.toHaveBeenCalled();

    useGameStore.setState({ addLoan: original });
  });

  it("renders active loans with payoff button", () => {
    const p1 = useGameStore.getState().players[0];
    const p2 = useGameStore.getState().players[1];
    useGameStore.setState(produce((s: any) => {
      s.loans = [
        { id: "l1", lenderId: p1.id, borrowerId: p2.id, principal: 5000, rate: 10, remaining: 3000, status: "active" }
      ];
    }));

    render(<LoansPanel />);
    expect(screen.getByText(/Alice → Bob/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /结清/i })).toBeInTheDocument();
  });

  it("calls repayLoan on payoff click", () => {
    const repaySpy = vi.fn();
    const original = useGameStore.getState().repayLoan;
    useGameStore.setState({ repayLoan: repaySpy });

    const p1 = useGameStore.getState().players[0];
    const p2 = useGameStore.getState().players[1];
    useGameStore.setState(produce((s: any) => {
      s.loans = [
        { id: "l1", lenderId: p1.id, borrowerId: p2.id, principal: 5000, rate: 10, remaining: 3000, status: "active" }
      ];
    }));

    render(<LoansPanel />);
    fireEvent.click(screen.getByRole("button", { name: /结清/i }));
    expect(repaySpy).toHaveBeenCalledWith("l1", 3000);

    useGameStore.setState({ repayLoan: original });
  });
});
