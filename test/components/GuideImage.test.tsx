import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuideImage } from "@/components/GuideImage";

vi.mock("@/lib/data/playerGuideAnnotations", () => ({
  PLAYER_GUIDE_ANNOTATIONS: {
    "/test/image.png": {
      size: { width: 400, height: 300 },
      boxes: [
        { id: "1", x: 10, y: 20, w: 50, h: 40 },
        { id: "2", x: 100, y: 150, w: 60, h: 30 }
      ]
    }
  }
}));

describe("GuideImage", () => {
  it("renders plain img when no annotations exist", () => {
    render(<GuideImage src="/unknown.png" alt="Unknown" />);
    const img = screen.getByAltText("Unknown");
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("renders annotated image with overlay after load", () => {
    render(<GuideImage src="/test/image.png" alt="Annotated" />);
    const img = screen.getByAltText("Annotated") as HTMLImageElement;
    expect(img).toHaveAttribute("width", "400");
    expect(img).toHaveAttribute("height", "300");

    // Before load, overlay should not be present
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    fireEvent.load(img);

    // After load, pins should appear
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not render overlay on error", () => {
    render(<GuideImage src="/test/image.png" alt="Annotated" />);
    const img = screen.getByAltText("Annotated") as HTMLImageElement;

    fireEvent.error(img);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("resets load state when src changes", () => {
    const { rerender } = render(<GuideImage src="/test/image.png" alt="Annotated" />);
    const img = screen.getByAltText("Annotated") as HTMLImageElement;
    fireEvent.load(img);
    expect(screen.getByText("1")).toBeInTheDocument();

    rerender(<GuideImage src="/test/image.png?v=2" alt="Annotated" />);
    // After src change, overlay should be gone until next load
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});
