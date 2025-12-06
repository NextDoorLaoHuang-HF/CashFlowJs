export type BoardSquareType =
  | "OPPORTUNITY"
  | "LIABILITY"
  | "CHARITY"
  | "PAYCHECK"
  | "OFFER"
  | "CHILD"
  | "DOWNSIZE";

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
