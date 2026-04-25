import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PanelSection } from "@/components/PanelSection";

vi.mock("@/lib/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn()
}));

import { useIsMobile } from "@/lib/hooks/useIsMobile";

const mockedUseIsMobile = vi.mocked(useIsMobile);

describe("PanelSection", () => {
  beforeEach(() => {
    mockedUseIsMobile.mockReturnValue(false);
  });

  it("renders title and children in desktop mode", () => {
    render(
      <PanelSection title="Assets">
        <div data-testid="child">Content</div>
      </PanelSection>
    );
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders badge when provided", () => {
    render(
      <PanelSection title="Assets" badge={3}>
        <div>Content</div>
      </PanelSection>
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders as accordion on mobile when collapsible", () => {
    mockedUseIsMobile.mockReturnValue(true);
    render(
      <PanelSection title="Assets" collapsible>
        <div data-testid="child">Content</div>
      </PanelSection>
    );
    const button = screen.getByRole("button", { name: /Assets/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles accordion open/close on click", () => {
    mockedUseIsMobile.mockReturnValue(true);
    render(
      <PanelSection title="Assets" collapsible defaultOpen={true}>
        <div data-testid="child">Content</div>
      </PanelSection>
    );
    const button = screen.getByRole("button", { name: /Assets/i });
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("respects defaultOpen=false on mobile", () => {
    mockedUseIsMobile.mockReturnValue(true);
    render(
      <PanelSection title="Assets" collapsible defaultOpen={false}>
        <div>Content</div>
      </PanelSection>
    );
    const button = screen.getByRole("button", { name: /Assets/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("applies custom className", () => {
    const { container } = render(
      <PanelSection title="Test" className="my-class">
        <div>Content</div>
      </PanelSection>
    );
    expect(container.querySelector(".my-class")).toBeInTheDocument();
  });

  it("sets data-tour attribute", () => {
    const { container } = render(
      <PanelSection title="Test" tour="assets-panel">
        <div>Content</div>
      </PanelSection>
    );
    expect(container.querySelector('[data-tour="assets-panel"]')).toBeInTheDocument();
  });
});
