import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiceDisplay } from "@/components/DiceDisplay";

describe("DiceDisplay", () => {
  it("renders single die with total", () => {
    render(<DiceDisplay dice={[4]} total={4} />);
    expect(screen.getByText("= 4")).toBeInTheDocument();
  });

  it("renders two dice with total", () => {
    render(<DiceDisplay dice={[2, 5]} total={7} />);
    expect(screen.getByText("= 7")).toBeInTheDocument();
  });

  it("applies rolling class when isRolling is true", () => {
    const { container } = render(<DiceDisplay dice={[1]} total={1} isRolling />);
    expect(container.querySelector(".dice-shake")).toBeInTheDocument();
  });

  it("does not apply rolling class when isRolling is false", () => {
    const { container } = render(<DiceDisplay dice={[1]} total={1} isRolling={false} />);
    expect(container.querySelector(".dice-shake")).not.toBeInTheDocument();
  });

  it("renders all dice face values 1-6", () => {
    const { container } = render(<DiceDisplay dice={[1, 2, 3, 4, 5, 6]} total={21} size="sm" />);
    const diceFaces = container.querySelectorAll(".dice-face");
    expect(diceFaces).toHaveLength(6);
  });

  it.each([
    ["sm", 36],
    ["md", 48],
    ["lg", 64]
  ] as const)("uses correct size for %s", (size, expected) => {
    const { container } = render(<DiceDisplay dice={[1]} total={1} size={size} />);
    const face = container.querySelector(".dice-face") as HTMLElement;
    expect(face.style.width).toBe(`${expected}px`);
    expect(face.style.height).toBe(`${expected}px`);
  });
});
