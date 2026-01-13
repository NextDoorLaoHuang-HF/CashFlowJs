"use client";

import type { ReactNode } from "react";

type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "hr" }
  | { type: "code"; language?: string; content: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "img"; alt: string; src: string }
  | { type: "p"; lines: string[] };

const inlineTokenRegex = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;

const renderInline = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = 0;
  for (const match of text.matchAll(inlineTokenRegex)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push(text.slice(cursor, index));
    }
    if (match[1]) {
      nodes.push(<code key={`code-${matchIndex}`}>{match[1]}</code>);
    } else if (match[2] && match[3]) {
      nodes.push(
        <a key={`link-${matchIndex}`} href={match[3]} target="_blank" rel="noreferrer">
          {match[2]}
        </a>
      );
    }
    cursor = index + match[0].length;
    matchIndex += 1;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
};

const parseMarkdown = (raw: string): Block[] => {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  const flushParagraph = (paragraphLines: string[]) => {
    const cleaned = paragraphLines.map((line) => line.replace(/\s+$/g, "")).filter((line) => line.length > 0);
    if (cleaned.length > 0) blocks.push({ type: "p", lines: cleaned });
  };

  const flushList = (items: string[]) => {
    const cleaned = items.map((item) => item.trim()).filter(Boolean);
    if (cleaned.length > 0) blocks.push({ type: "ul", items: cleaned });
  };

  const flushQuote = (quoteLines: string[]) => {
    const cleaned = quoteLines.map((line) => line.trimEnd()).filter(Boolean);
    if (cleaned.length > 0) blocks.push({ type: "blockquote", lines: cleaned });
  };

  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let quoteLines: string[] = [];
  let inCodeBlock = false;
  let codeLanguage: string | undefined;
  let codeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (inCodeBlock) {
      if (trimmed.startsWith("```")) {
        blocks.push({ type: "code", language: codeLanguage, content: codeLines.join("\n") });
        inCodeBlock = false;
        codeLanguage = undefined;
        codeLines = [];
      } else {
        codeLines.push(line.replace(/\r$/, ""));
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph(paragraphLines);
      paragraphLines = [];
      flushList(listItems);
      listItems = [];
      flushQuote(quoteLines);
      quoteLines = [];

      inCodeBlock = true;
      codeLanguage = trimmed.slice(3).trim() || undefined;
      codeLines = [];
      continue;
    }

    const imageMatch = line.match(/^!\[(.*)\]\((.*)\)\s*$/);
    if (imageMatch) {
      flushParagraph(paragraphLines);
      paragraphLines = [];
      flushList(listItems);
      listItems = [];
      flushQuote(quoteLines);
      quoteLines = [];

      const [, alt, src] = imageMatch;
      blocks.push({ type: "img", alt: alt ?? "", src: src ?? "" });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph(paragraphLines);
      paragraphLines = [];
      flushList(listItems);
      listItems = [];
      flushQuote(quoteLines);
      quoteLines = [];

      const level = Math.min(6, Math.max(1, headingMatch[1].length)) as 1 | 2 | 3 | 4 | 5 | 6;
      const text = headingMatch[2].trim();
      blocks.push({ type: "heading", level, text });
      continue;
    }

    if (trimmed === "---") {
      flushParagraph(paragraphLines);
      paragraphLines = [];
      flushList(listItems);
      listItems = [];
      flushQuote(quoteLines);
      quoteLines = [];

      blocks.push({ type: "hr" });
      continue;
    }

    if (!trimmed) {
      flushParagraph(paragraphLines);
      paragraphLines = [];
      flushList(listItems);
      listItems = [];
      flushQuote(quoteLines);
      quoteLines = [];
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph(paragraphLines);
      paragraphLines = [];
      flushList(listItems);
      listItems = [];

      quoteLines.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph(paragraphLines);
      paragraphLines = [];
      flushQuote(quoteLines);
      quoteLines = [];

      listItems.push(trimmed.slice(2));
      continue;
    }

    paragraphLines.push(line);
  }

  if (inCodeBlock) {
    blocks.push({ type: "code", language: codeLanguage, content: codeLines.join("\n") });
  }
  flushParagraph(paragraphLines);
  flushList(listItems);
  flushQuote(quoteLines);

  return blocks;
};

export function MarkdownRenderer({ markdown, renderImage }: { markdown: string; renderImage?: (src: string, alt: string) => ReactNode }) {
  const blocks = parseMarkdown(markdown);

  return (
    <div className="prose">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = `h${block.level}` as const;
          return <Tag key={index}>{renderInline(block.text)}</Tag>;
        }
        if (block.type === "hr") {
          return <hr key={index} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)" }} />;
        }
        if (block.type === "blockquote") {
          return (
            <blockquote
              key={index}
              style={{
                margin: "0.75rem 0",
                padding: "0.75rem 0.9rem",
                borderLeft: "4px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 12,
                color: "var(--muted)"
              }}
            >
              {block.lines.map((line, lineIndex) => (
                <div key={lineIndex}>{renderInline(line)}</div>
              ))}
            </blockquote>
          );
        }
        if (block.type === "code") {
          return (
            <pre
              key={index}
              style={{
                margin: "0.75rem 0",
                padding: "0.9rem",
                borderRadius: 12,
                overflowX: "auto",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)"
              }}
            >
              <code>{block.content}</code>
            </pre>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} style={{ margin: "0.6rem 0 0.9rem", paddingLeft: "1.25rem" }}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} style={{ margin: "0.25rem 0" }}>
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "img") {
          return <div key={index}>{renderImage ? renderImage(block.src, block.alt) : <img src={block.src} alt={block.alt} loading="lazy" />}</div>;
        }
        if (block.type === "p") {
          return (
            <p key={index} style={{ margin: "0.6rem 0" }}>
              {block.lines.map((line, lineIndex) => (
                <span key={lineIndex}>
                  {renderInline(line.trimEnd())}
                  {lineIndex < block.lines.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
