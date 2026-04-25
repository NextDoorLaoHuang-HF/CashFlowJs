import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomSheet } from "@/components/BottomSheet";

vi.mock("@/lib/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn()
}));

import { useIsMobile } from "@/lib/hooks/useIsMobile";
const mockedUseIsMobile = vi.mocked(useIsMobile);

describe("BottomSheet", () => {
  beforeEach(() => {
    mockedUseIsMobile.mockReturnValue(true);
  });

  it("returns null when closed", () => {
    const { container } = render(
      <BottomSheet open={false} onClose={() => {}}>
        <div>Content</div>
      </BottomSheet>
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders overlay and content when open on mobile", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} title="Test Sheet">
        <div>Sheet Content</div>
      </BottomSheet>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Sheet Content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /关闭/i })).toBeInTheDocument();
  });

  it("renders as region on desktop", () => {
    mockedUseIsMobile.mockReturnValue(false);
    render(
      <BottomSheet open={true} onClose={() => {}} title="Test Sheet">
        <div>Sheet Content</div>
      </BottomSheet>
    );
    expect(screen.getByRole("region")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={onClose}>
        <div>Content</div>
      </BottomSheet>
    );
    fireEvent.click(screen.getByRole("button", { name: /关闭/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when overlay clicked on mobile", () => {
    const onClose = vi.fn();
    const { container } = render(
      <BottomSheet open={true} onClose={onClose}>
        <div>Content</div>
      </BottomSheet>
    );
    const overlay = container.querySelector(".sheet-overlay");
    expect(overlay).toBeInTheDocument();
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when content clicked", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={onClose}>
        <div>Content</div>
      </BottomSheet>
    );
    fireEvent.click(screen.getByText("Content"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses custom closeLabel", () => {
    render(
      <BottomSheet open={true} onClose={() => {}} closeLabel="Dismiss">
        <div>Content</div>
      </BottomSheet>
    );
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    mockedUseIsMobile.mockReturnValue(false);
    const { container } = render(
      <BottomSheet open={true} onClose={() => {}} className="my-sheet">
        <div>Content</div>
      </BottomSheet>
    );
    expect(container.querySelector(".my-sheet")).toBeInTheDocument();
  });
});
