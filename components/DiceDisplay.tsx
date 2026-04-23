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
  const dotSize = size * 0.16;
  const padding = size * 0.14;
  const gap = size * 0.035;

  return (
    <div
      className="dice-face"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: "linear-gradient(145deg, #ffffff 0%, #e8e8e8 55%, #d4d4d4 100%)",
        boxShadow: `
          0 6px 16px rgba(0,0,0,0.3),
          0 2px 4px rgba(0,0,0,0.2),
          inset 0 -3px 6px rgba(0,0,0,0.08),
          inset 0 3px 6px rgba(255,255,255,0.9)
        `,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        padding,
        gap,
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Subtle border ring for 3D feel */}
      <div
        style={{
          position: "absolute",
          inset: 2,
          borderRadius: size * 0.18,
          border: "1px solid rgba(0,0,0,0.06)",
          pointerEvents: "none",
        }}
      />
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
                width: dotSize,
                height: dotSize,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 35%, #2a2a3a 0%, #0f0f1a 70%, #000 100%)",
                boxShadow: `
                  inset 0 1px 2px rgba(255,255,255,0.15),
                  0 1px 2px rgba(0,0,0,0.35)
                `,
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

const sizeMap = { sm: 36, md: 52, lg: 72 };

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
        className={isRolling ? "dice-rolling" : ""}
        style={{
          display: "flex",
          gap: "0.6rem",
          alignItems: "center",
        }}
      >
        {dice.map((value, index) => (
          <DiceFace key={`${index}-${value}-${isRolling ? "roll" : ""}`} value={value} size={faceSize} />
        ))}
      </div>
      <span
        style={{
          fontSize: faceSize * 0.95,
          fontWeight: 800,
          color: "var(--accent)",
          lineHeight: 1,
          textShadow: "0 2px 10px rgba(68,208,123,0.4)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        = {total}
      </span>
    </div>
  );
}
