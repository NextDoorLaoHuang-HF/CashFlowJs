import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameLog } from "@/components/GameLog";
import { useGameStore } from "@/lib/state/gameStore";
import { scenarios, dreams } from "@/lib/data/scenarios";
import type { GameLogEntry } from "@/lib/types";

describe("GameLog", () => {
  beforeEach(() => {
    useGameStore.getState().initGame({
      players: [
        { name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id }
      ],
      settings: { locale: "zh" }
    });
  });

  it("renders empty log message", () => {
    useGameStore.setState({ logs: [] });
    render(<GameLog />);
    expect(screen.getByText(/暂时没有记录/i)).toBeInTheDocument();
  });

  it("renders log entries with player info", () => {
    const playerId = useGameStore.getState().players[0].id;
    const logs: GameLogEntry[] = [
      {
        id: "log-1",
        playerId,
        turn: 1,
        phase: "ratRace",
        message: "test.message",
        timestamp: new Date().toISOString(),
        payload: { amount: 100 }
      }
    ];
    useGameStore.setState({ logs });

    render(<GameLog />);
    expect(screen.getByText((content) => content.includes("#1"))).toBeInTheDocument();
    // Player color dot is rendered
    const playerRow = document.querySelector(".log-entry-player");
    expect(playerRow).toBeTruthy();
    const colorDot = playerRow!.querySelector('[style*="border-radius"]');
    expect(colorDot).toBeTruthy();
    const style = (colorDot as HTMLElement)?.style.background;
    expect(style).toMatch(/rgb\(255,\s*0,\s*0\)|#ff0000/i);
  });

  it("renders log entry without player", () => {
    const logs: GameLogEntry[] = [
      {
        id: "log-1",
        turn: 1,
        phase: "setup",
        message: "test.message",
        timestamp: new Date().toISOString()
      }
    ];
    useGameStore.setState({ logs });

    render(<GameLog />);
    expect(screen.getByText((content) => content.includes("#1"))).toBeInTheDocument();
    // Should not show player label when no playerId
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("calls clearLog when clear button clicked", () => {
    const logs: GameLogEntry[] = [
      {
        id: "log-1",
        turn: 1,
        phase: "ratRace",
        message: "test.message",
        timestamp: new Date().toISOString()
      }
    ];
    useGameStore.setState({ logs });

    render(<GameLog />);
    const clearButton = screen.getByRole("button", { name: /清空/i });
    fireEvent.click(clearButton);
    expect(useGameStore.getState().logs).toHaveLength(0);
  });

  it("exports replay on export button click", () => {
    const createObjectURL = vi.fn(() => "blob:url");
    const revokeObjectURL = vi.fn();
    const clickMock = vi.fn();

    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const originalCreateElement = document.createElement;
    document.createElement = vi.fn((tag: string) => {
      const el = originalCreateElement.call(document, tag);
      if (tag === "a") {
        vi.spyOn(el, "click").mockImplementation(clickMock);
      }
      return el;
    }) as any;

    const logs: GameLogEntry[] = [
      {
        id: "log-1",
        turn: 1,
        phase: "ratRace",
        message: "test.message",
        timestamp: new Date().toISOString()
      }
    ];
    useGameStore.setState({ logs });

    render(<GameLog />);
    const exportButton = screen.getByRole("button", { name: /导出/i });
    fireEvent.click(exportButton);

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:url");

    document.createElement = originalCreateElement;
  });

  it("renders phase chips with correct colors", () => {
    const phases = ["setup", "dream", "ratRace", "fastTrack", "finished"] as const;
    const logs: GameLogEntry[] = phases.map((phase, i) => ({
      id: `log-${i}`,
      turn: i + 1,
      phase,
      message: "test.message",
      timestamp: new Date().toISOString()
    }));
    useGameStore.setState({ logs });

    const { container } = render(<GameLog />);
    const chips = container.querySelectorAll(".chip");
    expect(chips.length).toBeGreaterThanOrEqual(phases.length);
  });
});
