"use client";

const DOT_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DiceFace({ value, size = 48 }: { value: number; size?: number }) {
  const positions = DOT_POSITIONS[value] || [];
  return (
    <div
      className="dice-face"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: "linear-gradient(145deg, #ffffff, #e6e6e6)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25), inset 0 -2px 4px rgba(0,0,0,0.1)",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        padding: size * 0.12,
        gap: size * 0.04,
        flexShrink: 0,
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {positions.includes(i) ? (
            <div
              className="dice-dot"
              style={{
                width: size * 0.18,
                height: size * 0.18,
                borderRadius: "50%",
                background: "#1a1a2e",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

type DiceDisplayProps = {
  dice: number[];
  total: number;
  isRolling?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeMap = { sm: 36, md: 48, lg: 64 };

export function DiceDisplay({ dice, total, isRolling = false, size = "md" }: DiceDisplayProps) {
  const faceSize = sizeMap[size];

  return (
    <div
      className="dice-display"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <div
        className={isRolling ? "dice-shake" : ""}
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        {dice.map((value, index) => (
          <DiceFace key={`${index}-${value}`} value={value} size={faceSize} />
        ))}
      </div>
      <span
        style={{
          fontSize: faceSize * 0.9,
          fontWeight: 800,
          color: "var(--accent)",
          lineHeight: 1,
          textShadow: "0 2px 8px rgba(68,208,123,0.35)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        = {total}
      </span>
    </div>
  );
}
