import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JointVenturesPanel } from "@/components/JointVenturesPanel";
import { useGameStore } from "@/lib/state/gameStore";
import { scenarios, dreams } from "@/lib/data/scenarios";
import { produce } from "immer";

describe("JointVenturesPanel", () => {
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
    render(<JointVenturesPanel />);
    expect(screen.getByText(/暂无合资/i)).toBeInTheDocument();
  });

  it("creates a joint venture with selected players", () => {
    const addSpy = vi.fn();
    const original = useGameStore.getState().addJointVenture;
    useGameStore.setState({ addJointVenture: addSpy });

    render(<JointVenturesPanel />);

    fireEvent.change(screen.getByPlaceholderText(/名称/i), { target: { value: "New Venture" } });
    fireEvent.change(screen.getByPlaceholderText(/备注/i), { target: { value: "A test venture" } });

    // Toggle player buttons
    const buttons = screen.getAllByRole("button").filter((b) =>
      b.textContent?.includes("Alice") || b.textContent?.includes("Bob")
    );
    fireEvent.click(buttons[0]);

    fireEvent.click(screen.getByRole("button", { name: /发起合资/i }));

    expect(addSpy).toHaveBeenCalled();
    useGameStore.setState({ addJointVenture: original });
  });

  it("does not create venture without name or players", () => {
    const addSpy = vi.fn();
    const original = useGameStore.getState().addJointVenture;
    useGameStore.setState({ addJointVenture: addSpy });

    render(<JointVenturesPanel />);
    fireEvent.click(screen.getByRole("button", { name: /发起合资/i }));
    expect(addSpy).not.toHaveBeenCalled();

    useGameStore.setState({ addJointVenture: original });
  });

  it("renders existing ventures with status selector", () => {
    const p1 = useGameStore.getState().players[0];
    useGameStore.setState(produce((s: any) => {
      s.ventures = [
        {
          id: "v1", name: "Test Venture", description: "Desc", cashNeeded: 10000, cashflowImpact: 1000,
          participants: [{ playerId: p1.id, contribution: 5000, equity: 50 }],
          status: "forming"
        }
      ];
    }));

    render(<JointVenturesPanel />);
    expect(screen.getByText("Test Venture")).toBeInTheDocument();
    expect(screen.getByDisplayValue("筹备中")).toBeInTheDocument();
  });

  it("calls updateJointVenture on status change", () => {
    const updateSpy = vi.fn();
    const original = useGameStore.getState().updateJointVenture;
    useGameStore.setState({ updateJointVenture: updateSpy });

    const p1 = useGameStore.getState().players[0];
    useGameStore.setState(produce((s: any) => {
      s.ventures = [
        {
          id: "v1", name: "Test", description: "", cashNeeded: 1000, cashflowImpact: 100,
          participants: [{ playerId: p1.id, contribution: 1000, equity: 100 }],
          status: "forming"
        }
      ];
    }));

    render(<JointVenturesPanel />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "active" } });
    expect(updateSpy).toHaveBeenCalledWith("v1", { status: "active" });

    useGameStore.setState({ updateJointVenture: original });
  });
});
