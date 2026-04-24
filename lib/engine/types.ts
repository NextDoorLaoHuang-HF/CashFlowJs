import type {
  Asset,
  BaseCard,
  CharityPrompt,
  DiceRoll,
  GameLogEntry,
  GamePhase,
  GameSettings,
  JointVenture,
  Player,
  PlayerLoan,
  TurnState
} from "../types";

export type DeckKey = "smallDeals" | "bigDeals" | "offers" | "doodads";

export type MarketSessionStage = "sell" | "buy";

export type MarketSession = {
  cardId: string;
  stage: MarketSessionStage;
  responders: string[];
  responderIndex: number;
  sell: Record<string, Record<string, number>>;
  buyQuantity: number;
};

export type LiquidationSessionReason = {
  kind: "fastTrackPenalty";
  eventId?: string;
  legacyKey?: string;
  squareId?: number;
};

export type LiquidationSession = {
  playerId: string;
  requiredCash: number;
  reason: LiquidationSessionReason;
};

export type GameEngineState = {
  phase: GamePhase;
  players: Player[];
  currentPlayerId: string | null;
  turnState: TurnState;
  rngSeed: number;
  rngState: number;
  decks: Record<DeckKey, BaseCard[]>;
  discard: Record<DeckKey, BaseCard[]>;
  selectedCard?: BaseCard;
  marketSession?: MarketSession;
  liquidationSession?: LiquidationSession;
  dice?: DiceRoll;
  turn: number;
  logs: GameLogEntry[];
  replayFrames: unknown[];
  ventures: JointVenture[];
  loans: PlayerLoan[];
  settings: GameSettings;
  history: Array<{ turn: number; players: Player[] }>;
  charityPrompt?: CharityPrompt;
};

export type GameAction =
  | { type: "initGame"; payload: { players: unknown[]; settings?: Partial<GameSettings> } }
  | { type: "beginTurn" }
  | { type: "rollDice" }
  | { type: "drawCard"; deck: DeckKey }
  | { type: "applySelectedCard" }
  | { type: "passSelectedCard" }
  | { type: "resolveMarket"; payload?: unknown }
  | { type: "confirmMarketStep" }
  | { type: "skipMarketStep" }
  | { type: "skipMarketAll" }
  | { type: "nextPlayer" }
  | { type: "donateCharity" }
  | { type: "skipCharity" }
  | { type: "enterFastTrack"; playerId: string }
  | { type: "sellLiquidationAsset"; assetId: string; quantity: number }
  | { type: "finalizeLiquidation" }
  | { type: "addJointVenture"; venture: Omit<JointVenture, "id" | "createdAt" | "status"> }
  | { type: "updateJointVenture"; id: string; updates: Partial<JointVenture> }
  | { type: "addLoan"; loan: Omit<PlayerLoan, "id" | "status" | "remaining"> }
  | { type: "repayLoan"; loanId: string; amount: number }
  | { type: "repayBankLoan"; liabilityId: string; amount: number }
  | { type: "sellFireSaleAsset"; assetId: string; quantity: number }
  | { type: "setMarketSellQuantity"; assetId: string; quantity: number }
  | { type: "setMarketBuyQuantity"; quantity: number }
  | { type: "setLocale"; locale: "en" | "zh" };
