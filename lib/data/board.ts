export type BoardSquareType =
  | "OPPORTUNITY"
  | "LIABILITY"
  | "CHARITY"
  | "PAYCHECK"
  | "OFFER"
  | "CHILD"
  | "DOWNSIZE"
  | "FAST_PAYDAY"
  | "FAST_OPPORTUNITY"
  | "FAST_DONATION"
  | "FAST_PENALTY"
  | "FAST_DREAM";

export type BoardSquare = {
  id: number;
  type: BoardSquareType;
  label: string;
  color: string;
};

const rawSquares: Array<[BoardSquareType, string]> = [
  ["OPPORTUNITY", "#21940f"],
  ["LIABILITY", "#cc1f00"],
  ["OPPORTUNITY", "#21940f"],
  ["CHARITY", "gold"],
  ["OPPORTUNITY", "#21940f"],
  ["PAYCHECK", "#e3ce00"],
  ["OPPORTUNITY", "#21940f"],
  ["OFFER", "#0082e3"],
  ["OPPORTUNITY", "#21940f"],
  ["LIABILITY", "#cc1f00"],
  ["OPPORTUNITY", "#21940f"],
  ["CHILD", "#00bd92"],
  ["OPPORTUNITY", "#21940f"],
  ["PAYCHECK", "#e3ce00"],
  ["OPPORTUNITY", "#21940f"],
  ["OFFER", "#0082e3"],
  ["OPPORTUNITY", "#21940f"],
  ["LIABILITY", "#cc1f00"],
  ["OPPORTUNITY", "#21940f"],
  ["DOWNSIZE", "teal"],
  ["OPPORTUNITY", "#21940f"],
  ["PAYCHECK", "#e3ce00"],
  ["OPPORTUNITY", "#21940f"],
  ["OFFER", "#0082e3"]
];

export const boardSquares: BoardSquare[] = rawSquares.map(([type, color], index) => ({
  id: index,
  type,
  label: type,
  color
}));

const fastTrackRaw: Array<[BoardSquareType, string]> = [
  ["FAST_PENALTY", "#ef4444"], // 1 doodad
  ["FAST_DONATION", "#c084fc"], // 2 charity
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 3
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 4
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 5
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 6
  ["FAST_PENALTY", "#ef4444"], // 7 doodad
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 8
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 9
  ["FAST_PAYDAY", "#fbbf24"], // 10 cashflow day
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 11
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 12
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 13
  ["FAST_PENALTY", "#ef4444"], // 14 doodad
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 15
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 16
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 17
  ["FAST_PAYDAY", "#fbbf24"], // 18 cashflow day
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 19
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 20
  ["FAST_PENALTY", "#ef4444"], // 21 doodad
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 22
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 23 IPO type
  ["FAST_DREAM", "#22c55e"], // 24 Dream chance
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 25
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 26
  ["FAST_PENALTY", "#ef4444"], // 27 doodad
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 28
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 29
  ["FAST_PAYDAY", "#fbbf24"], // 30 cashflow day
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 31
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 32
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 33 IPO
  ["FAST_PENALTY", "#ef4444"], // 34 repairs
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 35
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 36
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 37
  ["FAST_PAYDAY", "#fbbf24"], // 38 cashflow day
  ["FAST_OPPORTUNITY", "#0ea5e9"], // 39
  ["FAST_OPPORTUNITY", "#0ea5e9"] // 40
];

export const fastTrackSquares: BoardSquare[] = fastTrackRaw.map(([type, color], index) => ({
  id: index,
  type,
  label: type,
  color
}));
