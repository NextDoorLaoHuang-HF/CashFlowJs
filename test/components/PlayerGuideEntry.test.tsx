import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayerGuideEntry } from "@/components/PlayerGuideEntry";
import { useGameStore } from "@/lib/state/gameStore";
import { scenarios, dreams } from "@/lib/data/scenarios";

vi.mock("@/components/TourOverlay", () => ({
  TourOverlay: ({ isOpen, onClose }: any) => (isOpen ? <div data-testid="tour-overlay" onClick={onClose} /> : null)
}));

describe("PlayerGuideEntry", () => {
  beforeEach(() => {
    useGameStore.getState().initGame({
      players: [{ name: "Alice", color: "#ff0000", scenarioId: scenarios[0].id, dreamId: dreams[0].id }],
      settings: { locale: "zh" }
    });
  });

  it("renders open guide button", () => {
    render(<PlayerGuideEntry />);
    expect(screen.getByRole("button", { name: /游玩指南/i })).toBeInTheDocument();
  });

  it("opens modal on click", () => {
    render(<PlayerGuideEntry />);
    fireEvent.click(screen.getByRole("button", { name: /游玩指南/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes modal on close button click", () => {
    render(<PlayerGuideEntry />);
    fireEvent.click(screen.getByRole("button", { name: /游玩指南/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/关闭/i));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes modal on Escape key", () => {
    render(<PlayerGuideEntry />);
    fireEvent.click(screen.getByRole("button", { name: /游玩指南/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<PlayerGuideEntry />);
    fireEvent.click(screen.getByRole("button", { name: /游玩指南/i }));
    expect(screen.getByText(/正在加载/i)).toBeInTheDocument();
  });

  it("loads and displays markdown content", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve("# Guide\n\nHello") } as Response)
    );

    render(<PlayerGuideEntry />);
    fireEvent.click(screen.getByRole("button", { name: /游玩指南/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Guide" })).toBeInTheDocument();
    });
  });

  it("shows error when fetch fails", async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response));

    render(<PlayerGuideEntry />);
    fireEvent.click(screen.getByRole("button", { name: /游玩指南/i }));

    await waitFor(() => {
      expect(screen.getByText(/加载失败/i)).toBeInTheDocument();
    });
  });

  it("starts tour when tour button clicked", () => {
    render(<PlayerGuideEntry />);
    fireEvent.click(screen.getByRole("button", { name: /游玩指南/i }));
    fireEvent.click(screen.getByText(/开始引导/i));
    expect(screen.getByTestId("tour-overlay")).toBeInTheDocument();
  });
});
