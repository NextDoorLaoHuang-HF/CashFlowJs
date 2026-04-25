import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders headings", () => {
    render(<MarkdownRenderer markdown={"# H1\n## H2"} />);
    expect(screen.getByRole("heading", { level: 1, name: "H1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "H2" })).toBeInTheDocument();
  });

  it("renders paragraphs", () => {
    render(<MarkdownRenderer markdown={"Hello world.\n\nSecond paragraph."} />);
    expect(screen.getByText("Hello world.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
  });

  it("renders unordered lists", () => {
    render(<MarkdownRenderer markdown={"- Item 1\n- Item 2"} />);
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("renders code blocks", () => {
    render(<MarkdownRenderer markdown={"```ts\nconst x = 1;\n```"} />);
    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
  });

  it("renders blockquotes", () => {
    render(<MarkdownRenderer markdown={"> A wise quote"} />);
    expect(screen.getByText("A wise quote")).toBeInTheDocument();
  });

  it("renders horizontal rules", () => {
    const { container } = render(<MarkdownRenderer markdown={"---"} />);
    expect(container.querySelector("hr")).toBeInTheDocument();
  });

  it("renders inline code", () => {
    render(<MarkdownRenderer markdown={"Use `npm install` to install."} />);
    expect(screen.getByText("npm install")).toBeInTheDocument();
  });

  it("renders inline links", () => {
    render(<MarkdownRenderer markdown={"Visit [Example](https://example.com) site."} />);
    const link = screen.getByRole("link", { name: "Example" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders images with default img tag", () => {
    render(<MarkdownRenderer markdown={"![Alt text](/image.png)"} />);
    expect(screen.getByAltText("Alt text")).toHaveAttribute("src", "/image.png");
  });

  it("uses custom renderImage when provided", () => {
    render(
      <MarkdownRenderer
        markdown={"![Alt](/pic.jpg)"}
        renderImage={(src, alt) => <div data-testid="custom-img" data-src={src} data-alt={alt} />}
      />
    );
    const custom = screen.getByTestId("custom-img");
    expect(custom).toHaveAttribute("data-src", "/pic.jpg");
    expect(custom).toHaveAttribute("data-alt", "Alt");
  });

  it("handles empty markdown", () => {
    const { container } = render(<MarkdownRenderer markdown={""} />);
    expect(container.querySelector(".prose")).toBeInTheDocument();
  });

  it("handles unclosed code block", () => {
    render(<MarkdownRenderer markdown={"```\nunclosed code"} />);
    expect(screen.getByText("unclosed code")).toBeInTheDocument();
  });

  it("handles mixed content", () => {
    const md = "# Title\n\nSome text with `code`.\n\n- List item\n\n> Quote\n\n---";
    const { container } = render(<MarkdownRenderer markdown={md} />);
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();
    expect(screen.getByText("List item")).toBeInTheDocument();
    expect(screen.getByText("Quote")).toBeInTheDocument();
    expect(container.querySelector("hr")).toBeInTheDocument();
  });
});
