import type { Dream, Scenario } from "./data/scenarios";

export type Locale = "en" | "zh";

export type BaseCard = {
  id: string;
  type: string;
  name: string;
  description: string;
  rule?: string;
  rule1?: string;
  rule2?: string;
  deckKey?: string;
  [key: string]: unknown;
};

export type BoardLocation = {
  id: number;
  type: string;
  label: string;
  color: string;
};

export type PlayerTrack = "ratRace" | "fastTrack";

export type Asset = {
  id: string;
  name: string;
  category: "stock" | "realEstate" | "business" | "collectible" | "other";
  cashflow: number;
  cost: number;
  quantity?: number;
  metadata?: Record<string, unknown>;
};

export type Liability = {
  id: string;
  name: string;
  payment: number;
  balance: number;
  category: "mortgage" | "loan" | "credit" | "other";
  metadata?: Record<string, unknown>;
};

export type Player = {
  id: string;
  name: string;
  color: string;
  scenario: Scenario;
  cash: number;
  passiveIncome: number;
  totalIncome: number;
  totalExpenses: number;
  payday: number;
  position: number;
  dream?: Dream;
  assets: Asset[];
  liabilities: Liability[];
  charityTurns: number;
  children: number;
  childExpense: number;
  skipTurns: number;
  isLLM?: boolean;
  llmModel?: string;
  llmPersona?: string;
  fastTrackUnlocked: boolean;
  fastTrackTarget?: number;
  status: "active" | "bankrupt";
  track: PlayerTrack;
};

export type DiceRoll = {
  dice: number[];
  total: number;
};

export type CharityPrompt = {
  playerId: string;
  amount: number;
};

export type JointVentureParticipant = {
  playerId: string;
  contribution: number;
  equity: number;
};

export type JointVenture = {
  id: string;
  name: string;
  description: string;
  cashNeeded: number;
  cashflowImpact: number;
  status: "forming" | "active" | "closed";
  participants: JointVentureParticipant[];
  createdAt: string;
};

export type PlayerLoan = {
  id: string;
  lenderId: string;
  borrowerId: string;
  principal: number;
  rate: number;
  remaining: number;
  issuedTurn: number;
  status: "active" | "repaid" | "defaulted";
};

export type GamePhase = "setup" | "dream" | "ratRace" | "fastTrack" | "finished";

export type TurnState = "awaitRoll" | "awaitAction" | "awaitCard" | "awaitMarket" | "awaitCharity" | "awaitEnd";

export type GameLogEntry = {
  id: string;
  playerId?: string;
  turn: number;
  phase: GamePhase;
  message: string;
  timestamp: string;
  localeMessage?: string;
  payload?: Record<string, unknown>;
};

export type GameSettings = {
  locale: Locale;
  startingSavingsMode: "none" | "normal" | "salary" | "double-salary";
  enablePreferredStock: boolean;
  enableBigDeals: boolean;
  enableSmallDeals: boolean;
  enableLLMPlayers: boolean;
  useCashflowDice: boolean;
};

export type LLMRequest = {
  player: Player;
  board: BoardLocation[];
  dreams: Dream[];
  log: GameLogEntry[];
  locale: Locale;
};

export type LLMAction = {
  summary: string;
  decision: "buy" | "sell" | "hold" | "joint-venture" | "loan" | "charity" | "roll";
  details?: Record<string, unknown>;
};
