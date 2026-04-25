import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TourOverlay } from "@/components/TourOverlay";

const steps = [
  { selector: "#step1", title: "Step 1", body: "Body 1" },
  { selector: "#step2", title: "Step 2", body: "Body 2" },
  { selector: "#step3", title: "Step 3", body: "Body 3" }
];

describe("TourOverlay", () => {
  it("returns null when not open", () => {
    const { container } = render(<TourOverlay locale="zh" isOpen={false} steps={steps} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when no steps", () => {
    const { container } = render(<TourOverlay locale="zh" isOpen={true} steps={[]} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders first step", () => {
    render(<TourOverlay locale="zh" isOpen={true} steps={steps} onClose={() => {}} />);
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("navigates to next step", () => {
    render(<TourOverlay locale="zh" isOpen={true} steps={steps} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /下一步/i }));
    expect(screen.getByText("Step 2")).toBeInTheDocument();
  });

  it("navigates to previous step", () => {
    render(<TourOverlay locale="zh" isOpen={true} steps={steps} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /下一步/i }));
    fireEvent.click(screen.getByRole("button", { name: /上一步/i }));
    expect(screen.getByText("Step 1")).toBeInTheDocument();
  });

  it("closes on finish button click at last step", () => {
    const onClose = vi.fn();
    render(<TourOverlay locale="zh" isOpen={true} steps={steps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /下一步/i }));
    fireEvent.click(screen.getByRole("button", { name: /下一步/i }));
    const buttons = screen.getAllByText("结束");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on close button click", () => {
    const onClose = vi.fn();
    render(<TourOverlay locale="zh" isOpen={true} steps={steps} onClose={onClose} />);
    fireEvent.click(screen.getByText("结束"));
    expect(onClose).toHaveBeenCalled();
  });

  it("handles keyboard navigation", () => {
    render(<TourOverlay locale="zh" isOpen={true} steps={steps} onClose={() => {}} />);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("Step 2")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("Step 1")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    // Escape calls onClose but does not change step
  });

  it("shows missing target warning when element not found", () => {
    render(<TourOverlay locale="zh" isOpen={true} steps={steps} onClose={() => {}} />);
    expect(screen.getByText(/当前界面未找到/i)).toBeInTheDocument();
  });
});
