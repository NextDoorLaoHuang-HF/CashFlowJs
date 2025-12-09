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
  ["FAST_PAYDAY", "#fbbf24"],
  ["FAST_OPPORTUNITY", "#0ea5e9"],
  ["FAST_PENALTY", "#ef4444"],
  ["FAST_OPPORTUNITY", "#0ea5e9"],
  ["FAST_DONATION", "#c084fc"],
  ["FAST_PAYDAY", "#fbbf24"],
  ["FAST_OPPORTUNITY", "#0ea5e9"],
  ["FAST_DREAM", "#22c55e"],
  ["FAST_PENALTY", "#ef4444"],
  ["FAST_OPPORTUNITY", "#0ea5e9"],
  ["FAST_DONATION", "#c084fc"],
  ["FAST_OPPORTUNITY", "#0ea5e9"]
];

export const fastTrackSquares: BoardSquare[] = fastTrackRaw.map(([type, color], index) => ({
  id: index,
  type,
  label: type,
  color
}));
