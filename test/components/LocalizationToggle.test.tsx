import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LocalizationToggle } from "@/components/LocalizationToggle";
import { useGameStore } from "@/lib/state/gameStore";
import { scenarios, dreams } from "@/lib/data/scenarios";

describe("LocalizationToggle", () => {
  beforeEach(() => {
    useGameStore.getState().initGame({
      players: [
        { name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id }
      ],
      settings: { locale: "zh" }
    });
  });

  it("renders current locale label", () => {
    render(<LocalizationToggle />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-tour", "locale-toggle");
  });

  it("toggles locale on click", () => {
    render(<LocalizationToggle />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(useGameStore.getState().settings.locale).toBe("en");
  });

  it("toggles back to zh from en", () => {
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, locale: "en" } });
    render(<LocalizationToggle />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(useGameStore.getState().settings.locale).toBe("zh");
  });
});
