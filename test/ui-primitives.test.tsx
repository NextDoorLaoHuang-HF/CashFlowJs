import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Accordion } from "@/components/Accordion";
import { BottomSheet } from "@/components/BottomSheet";

describe("UI primitives", () => {
  it("renders accordion open and closed states", () => {
    render(
      <Accordion
        items={[
          { id: "summary", title: "Summary", body: <div>Summary body</div>, defaultOpen: true },
          { id: "detail", title: "Detail", body: <div>Detail body</div> }
        ]}
      />
    );

    const summaryButton = screen.getByRole("button", { name: "Summary" });
    const detailButton = screen.getByRole("button", { name: "Detail" });

    expect(summaryButton).toHaveAttribute("aria-expanded", "true");
    expect(detailButton).toHaveAttribute("aria-expanded", "false");
    expect(summaryButton.closest(".accordion-item")).toHaveAttribute("data-state", "open");
    expect(detailButton.closest(".accordion-item")).toHaveAttribute("data-state", "closed");

    fireEvent.click(detailButton);

    expect(detailButton).toHaveAttribute("aria-expanded", "true");
    expect(detailButton.closest(".accordion-item")).toHaveAttribute("data-state", "open");
  });

  it("renders bottom sheet overlay and classes on mobile", () => {
    window.innerWidth = 375;

    render(
      <BottomSheet open onClose={() => undefined} title="Actions">
        <button type="button">Do thing</button>
      </BottomSheet>
    );

    const dialog = screen.getByRole("dialog", { name: "Actions" });
    const overlay = dialog.parentElement?.parentElement;

    expect(overlay).toHaveClass("sheet-overlay");
    expect(dialog).toHaveClass("sheet");
    expect(screen.getByRole("button", { name: "关闭" })).toHaveClass("btn", "btn-secondary", "btn-sm");
    expect(screen.getByRole("button", { name: "Do thing" })).toBeInTheDocument();
  });
});
