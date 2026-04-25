import { describe, expect, it } from "vitest";
import { buildPlayer } from "@/lib/engine/player";
import { createTestSettings } from "../helpers";
import { scenarios, dreams } from "@/lib/data/scenarios";

describe("buildPlayer", () => {
  it("creates a player with correct defaults", () => {
    const player = buildPlayer(
      {
        name: "Alice",
        color: "#00ff00",
        scenarioId: scenarios[0].id,
        dreamId: dreams[0].id
      },
      createTestSettings()
    );
    expect(player.name).toBe("Alice");
    expect(player.color).toBe("#00ff00");
    expect(player.track).toBe("ratRace");
    expect(player.status).toBe("active");
    expect(player.liabilities.length).toBeGreaterThanOrEqual(4);
  });

  it("uses normal savings by default", () => {
    const scenario = scenarios.find((s) => s.id === "janitor")!;
    const player = buildPlayer(
      { name: "Bob", color: "#0000ff", scenarioId: scenario.id, dreamId: dreams[0].id },
      createTestSettings({ startingSavingsMode: "normal" })
    );
    expect(player.cash).toBe(scenario.savings);
  });

  it("uses salary savings mode", () => {
    const scenario = scenarios.find((s) => s.id === "janitor")!;
    const player = buildPlayer(
      { name: "Bob", color: "#0000ff", scenarioId: scenario.id, dreamId: dreams[0].id },
      createTestSettings({ startingSavingsMode: "salary" })
    );
    expect(player.cash).toBe(scenario.salary);
  });

  it("uses double-salary savings mode", () => {
    const scenario = scenarios.find((s) => s.id === "janitor")!;
    const player = buildPlayer(
      { name: "Bob", color: "#0000ff", scenarioId: scenario.id, dreamId: dreams[0].id },
      createTestSettings({ startingSavingsMode: "double-salary" })
    );
    expect(player.cash).toBe(scenario.salary * 2);
  });

  it("uses zero savings when mode is none", () => {
    const player = buildPlayer(
      { name: "Bob", color: "#0000ff", scenarioId: scenarios[0].id, dreamId: dreams[0].id },
      createTestSettings({ startingSavingsMode: "none" })
    );
    expect(player.cash).toBe(0);
  });

  it("calculates payday correctly from scenario", () => {
    const scenario = scenarios.find((s) => s.id === "janitor")!;
    const expectedExpenses =
      scenario.taxes +
      scenario.mortgagePayment +
      scenario.carPayment +
      scenario.creditCardPayment +
      scenario.retailPayment +
      scenario.otherExpenses;
    const player = buildPlayer(
      { name: "Bob", color: "#0000ff", scenarioId: scenario.id, dreamId: dreams[0].id },
      createTestSettings()
    );
    expect(player.totalExpenses).toBe(expectedExpenses);
    expect(player.payday).toBe(scenario.salary - expectedExpenses);
  });
});
