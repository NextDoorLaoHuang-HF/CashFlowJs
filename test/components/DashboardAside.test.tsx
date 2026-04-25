import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardAside } from "@/components/DashboardAside";

vi.mock("@/lib/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn()
}));

vi.mock("@/components/PlayerSidebar", () => ({
  PlayerSidebar: () => <div data-testid="player-sidebar">PlayerSidebar</div>
}));

vi.mock("@/components/PortfolioPanel", () => ({
  PortfolioPanel: () => <div data-testid="portfolio-panel">PortfolioPanel</div>
}));

vi.mock("@/components/JointVenturesPanel", () => ({
  JointVenturesPanel: () => <div data-testid="ventures-panel">JointVenturesPanel</div>
}));

vi.mock("@/components/LoansPanel", () => ({
  LoansPanel: () => <div data-testid="loans-panel">LoansPanel</div>
}));

vi.mock("@/components/LLMPanel", () => ({
  LLMPanel: () => <div data-testid="llm-panel">LLMPanel</div>
}));

vi.mock("@/components/ReplayPanel", () => ({
  ReplayPanel: () => <div data-testid="replay-panel">ReplayPanel</div>
}));

import { useIsMobile } from "@/lib/hooks/useIsMobile";

const mockedUseIsMobile = vi.mocked(useIsMobile);

describe("DashboardAside", () => {
  beforeEach(() => {
    mockedUseIsMobile.mockReturnValue(false);
  });

  it("renders all panels in desktop mode", () => {
    render(<DashboardAside locale="zh" />);
    expect(screen.getByTestId("player-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-panel")).toBeInTheDocument();
    expect(screen.getByTestId("ventures-panel")).toBeInTheDocument();
    expect(screen.getByTestId("loans-panel")).toBeInTheDocument();
    expect(screen.getByTestId("llm-panel")).toBeInTheDocument();
    expect(screen.getByTestId("replay-panel")).toBeInTheDocument();
  });

  it("renders accordion in mobile mode", () => {
    mockedUseIsMobile.mockReturnValue(true);
    render(<DashboardAside locale="zh" />);
    // Accordion renders buttons for each section
    expect(screen.getByRole("button", { name: /玩家概览/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /资产\/负债报表/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /合资项目/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /玩家借贷/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /智能玩家控制台/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /回放 \/ 导入/i })).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<DashboardAside locale="zh" className="my-class" />);
    expect(container.querySelector(".my-class")).toBeInTheDocument();
  });
});
