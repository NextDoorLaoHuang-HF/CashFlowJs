export type GamePhase = 'home' | 'selection' | 'setup' | 'ratRace' | 'fastTrack';

export type PlayerStatus = 'draft' | 'active' | 'fast-track';

export type PlayerColor = 'Green' | 'Red' | 'Blue' | 'Black' | 'Pink' | 'Aqua' | 'Orange' | 'White';

export const PLAYER_COLORS: PlayerColor[] = [
  'Green',
  'Red',
  'Blue',
  'Black',
  'Pink',
  'Aqua',
  'Orange',
  'White',
];

export interface ScenarioDefinition {
  id: string;
  title: string;
  salary: number;
  savings: number;
  expenses: {
    taxes: number;
    mortgage: number;
    car: number;
    creditCard: number;
    retail: number;
    other: number;
  };
  liabilities: {
    mortgage: number;
    car: number;
    creditCard: number;
    retail: number;
  };
}

export interface IncomeBreakdown {
  salary: number;
  passive: number;
  other: number;
}

export interface ExpenseBreakdown {
  taxes: number;
  mortgage: number;
  car: number;
  creditCard: number;
  retail: number;
  other: number;
  child: number;
  total: number;
}

export interface LoanSummary {
  mortgage: number;
  car: number;
  creditCard: number;
  retail: number;
  bank: number;
}

export interface Player {
  id: string;
  slot: number;
  name: string;
  color: PlayerColor;
  scenarioId: string | null;
  hasInsurance: boolean;
  cash: number;
  position: number;
  status: PlayerStatus;
  income: IncomeBreakdown;
  expenses: ExpenseBreakdown;
  loans: LoanSummary;
  passiveIncome: number;
  payday: number;
  lastRoll: number | null;
}

export type CardDeckType = 'small' | 'big' | 'market';

export type CardKind = 'mutual' | 'stock' | 'business' | 'real-estate' | 'doodad';

export interface CardDefinition {
  id: string;
  name: string;
  kind: CardKind;
  deck: CardDeckType;
  description: string;
  rule: string;
  price?: number;
  payout?: number;
  cashflow?: number;
}

export interface DeckState {
  smallDeals: CardDefinition[];
  bigDeals: CardDefinition[];
  market: CardDefinition[];
}

export interface TurnState {
  order: string[];
  currentIndex: number;
  round: number;
}

export interface GameEvent {
  id: string;
  type: string;
  message: string;
  createdAt: number;
  payload?: Record<string, unknown>;
}

export interface RootState {
  phase: GamePhase;
  playerLimit: number;
  players: Player[];
  decks: DeckState;
  turn: TurnState;
  eventLog: GameEvent[];
}
