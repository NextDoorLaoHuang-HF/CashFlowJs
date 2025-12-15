import { produce } from "immer";
import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { boardSquares, fastTrackSquares } from "../data/board";
import { cards } from "../data/cards";
import { dreams, scenarios } from "../data/scenarios";
import { t } from "../i18n";
import {
  cardMentionsEveryone,
  getAssetAvailableQuantity,
  getStockSplitKind,
  isOfferForcedLimitedSaleCard,
  isOfferImproveCard,
  isOfferSellCard,
  isStockSplitEventCard,
  isTradeableSecurityCard,
  matchesOffer
} from "./marketRules";
import type {
  Asset,
  BaseCard,
  CharityPrompt,
  DiceRoll,
  GameLogEntry,
  GamePhase,
  GameSettings,
  JointVenture,
  LLMAction,
  Locale,
  Player,
  PlayerLoan,
  TurnState
} from "../types";

export type DeckKey = "smallDeals" | "bigDeals" | "offers" | "doodads";

export type SetupPlayer = {
  name: string;
  color: string;
  scenarioId: string;
  dreamId: string;
  isLLM?: boolean;
  llmModel?: string;
  llmPersona?: string;
};

type SetupPayload = {
  players: SetupPlayer[];
  settings?: Partial<GameSettings>;
};

type CardPreview = {
  cost: number;
  cashflow: number;
  canPass: boolean;
  primaryAction: "buy" | "pay" | "resolve";
};

type MarketResolution = {
  buyQuantity?: number;
  sell?: Record<string, Record<string, number>>;
};

type GameStore = {
  phase: GamePhase;
  board: typeof boardSquares;
  fastTrackBoard: typeof fastTrackSquares;
  players: Player[];
  currentPlayerId: string | null;
  turnState: TurnState;
  decks: Record<DeckKey, BaseCard[]>;
  discard: Record<DeckKey, BaseCard[]>;
  selectedCard?: BaseCard;
  dice?: DiceRoll;
  turn: number;
  logs: GameLogEntry[];
  ventures: JointVenture[];
  loans: PlayerLoan[];
  settings: GameSettings;
  history: Array<{ turn: number; players: Player[] }>;
  charityPrompt?: CharityPrompt;
  initGame: (payload: SetupPayload) => void;
  addLog: (message: string, payload?: Record<string, unknown>, playerId?: string) => void;
  beginTurn: () => void;
  getCardPreview: (card: BaseCard, playerId?: string) => CardPreview;
  applySelectedCard: () => void;
  passSelectedCard: () => void;
  resolveMarket: (payload?: MarketResolution) => void;
  rollDice: () => void;
  drawCard: (deck: DeckKey) => void;
  clearCard: () => void;
  completeDeal: (opts: { card: BaseCard; playerId?: string; cashflowDelta?: number; cashDelta: number }) => void;
  resolvePayday: (playerId: string, previousPosition: number, stepsMoved: number) => void;
  nextPlayer: () => void;
  setLocale: (locale: Locale) => void;
  addJointVenture: (venture: Omit<JointVenture, "id" | "createdAt" | "status">) => void;
  updateJointVenture: (id: string, updates: Partial<JointVenture>) => void;
  addLoan: (loan: Omit<PlayerLoan, "id" | "status" | "remaining">) => void;
  repayLoan: (loanId: string, amount: number) => void;
  repayBankLoan: (liabilityId: string, amount: number) => void;
  clearLog: () => void;
  recordLLMAction: (playerId: string, action: LLMAction) => void;
  donateCharity: () => void;
  skipCharity: () => void;
  enterFastTrack: (playerId: string) => void;
};

const defaultSettings: GameSettings = {
  locale: "en",
  startingSavingsMode: "normal",
  enablePreferredStock: true,
  enableBigDeals: true,
  enableSmallDeals: true,
  enableLLMPlayers: true,
  useCashflowDice: true
};

type CardDefinition = {
  id?: string;
  type?: string;
  name?: string;
  description?: string;
  text?: string;
  rule?: string;
  rule1?: string;
  rule2?: string;
  deckKey?: string;
  [key: string]: unknown;
};

const deckSources: Record<DeckKey, Record<string, CardDefinition>> = {
  smallDeals: cards.smallDeal,
  bigDeals: cards.bigDeal,
  offers: cards.offer,
  doodads: cards.doodad
};

const determineStartingCash = (scenario: Player["scenario"], settings: GameSettings): number => {
  switch (settings.startingSavingsMode) {
    case "none":
      return 0;
    case "salary":
      return scenario.salary;
    case "double-salary":
      return scenario.salary * 2;
    case "normal":
    default:
      return scenario.savings;
  }
};

const filterCardBySettings = (card: BaseCard, settings: GameSettings, deckKey: DeckKey): boolean => {
  if (deckKey === "smallDeals" && !settings.enablePreferredStock) {
    const typeLabel = card.type?.toLowerCase() ?? "";
    if (typeLabel.includes("preferred stock")) {
      return false;
    }
  }
  return true;
};

const buildDeckFromSource = (deckKey: DeckKey, settings: GameSettings): BaseCard[] => {
  if (deckKey === "smallDeals" && !settings.enableSmallDeals) {
    return [];
  }
  if (deckKey === "bigDeals" && !settings.enableBigDeals) {
    return [];
  }
  const baseDeck = cloneDeck(deckSources[deckKey], deckKey);
  return shuffle(baseDeck.filter((card) => filterCardBySettings(card, settings, deckKey)));
};

const captureFastTrackStatus = (players: Player[]): Record<string, boolean> =>
  players.reduce<Record<string, boolean>>((acc, player) => {
    acc[player.id] = player.fastTrackUnlocked;
    return acc;
  }, {});

const detectFastTrackUnlocks = (
  before: Record<string, boolean>,
  afterPlayers: Player[],
  notify: (player: Player) => void
) => {
  afterPlayers.forEach((player) => {
    if (!before[player.id] && player.fastTrackUnlocked) {
      notify(player);
    }
  });
};

const cloneDeck = (deck: Record<string, CardDefinition>, deckKey: DeckKey): BaseCard[] =>
  Object.keys(deck).map((key) => {
    const card = deck[key];
    const fallbackDescription = typeof card.decription === "string" ? card.decription : "";
    const description =
      typeof card.description === "string"
        ? card.description
        : typeof card.text === "string"
          ? card.text
          : fallbackDescription;
    const name = typeof card.name === "string" ? card.name : key;
    const type = typeof card.type === "string" ? card.type : deckKey === "doodads" ? "Doodad" : "Card";
    return {
      ...card,
      id: card.id ?? key,
      deckKey,
      type,
      name,
      description
    };
  });

const roundToNearestThousand = (value: number): number => Math.ceil(value / 1000) * 1000;

const shuffle = <T,>(list: T[]): T[] => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const discardSelectedCard = (draft: {
  selectedCard?: BaseCard;
  discard: Record<DeckKey, BaseCard[]>;
}) => {
  if (!draft.selectedCard) return;
  const deckKey = (draft.selectedCard.deckKey ?? "smallDeals") as DeckKey;
  draft.discard[deckKey].push(draft.selectedCard);
  draft.selectedCard = undefined;
};

const drawCardForPlayer = (
  draft: {
    decks: Record<DeckKey, BaseCard[]>;
    discard: Record<DeckKey, BaseCard[]>;
    settings: GameSettings;
    selectedCard?: BaseCard;
  },
  deck: DeckKey,
  currentPlayer?: Player
): boolean => {
  const maxAttempts = draft.decks[deck].length + draft.discard[deck].length + 2;
  let attempts = 0;
  while (attempts < maxAttempts) {
    if (draft.decks[deck].length === 0) {
      const reshuffled = shuffle(draft.discard[deck]).filter((card) => filterCardBySettings(card, draft.settings, deck));
      draft.decks[deck] = reshuffled;
      draft.discard[deck] = [];
    }
    const card = draft.decks[deck].shift();
    if (!card) {
      break;
    }
    const requiresChild = deck === "doodads" && card.child === true;
    if (requiresChild && (!currentPlayer || currentPlayer.children <= 0)) {
      draft.discard[deck].push(card);
      attempts += 1;
      continue;
    }
    draft.selectedCard = { ...card, deckKey: deck };
    return true;
  }
  return false;
};

const getNumericField = (card: BaseCard, fields: string[]): number | undefined => {
  for (const field of fields) {
    const value = card[field];
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }
  return undefined;
};

const deriveAssetCost = (card: BaseCard, fallback: number): number => {
  const value = getNumericField(card, ["cost", "price", "amount", "value", "totalCost"]);
  return typeof value === "number" ? Math.abs(value) : Math.abs(fallback);
};

const getLandType = (card: BaseCard): string | undefined => {
  const landType = typeof card.landType === "string" ? card.landType : undefined;
  const tag = typeof card.tag === "string" ? card.tag : undefined;
  return (landType ?? tag)?.toLowerCase();
};

const deriveCardCashflow = (card: BaseCard, provided?: number): number => {
  if (typeof provided === "number") {
    return provided;
  }
  const value = getNumericField(card, ["cashFlow", "cashflow", "dividend", "payout", "savings"]);
  return typeof value === "number" ? value : 0;
};

const getDeckKey = (card: BaseCard): DeckKey | null => {
  const deckKey = card.deckKey;
  if (deckKey === "smallDeals" || deckKey === "bigDeals" || deckKey === "offers" || deckKey === "doodads") {
    return deckKey;
  }
  return null;
};

const deriveCardCostForPlayer = (card: BaseCard, player?: Player): number => {
  const deckKey = getDeckKey(card);
  if (deckKey === "offers") {
    return 0;
  }
  if (isTradeableSecurityCard(card)) {
    return 0;
  }
  if (deckKey === "doodads") {
    const ratio = typeof card.amount === "number" ? card.amount : undefined;
    if (typeof ratio === "number" && ratio > 0 && ratio < 1) {
      const basis = player?.cash ?? 0;
      return Math.max(0, Math.round(basis * ratio));
    }
  }
  const value = getNumericField(card, ["downPayment", "cost", "price", "deposit"]);
  return typeof value === "number" ? Math.max(0, Math.abs(value)) : 0;
};

const derivePrimaryAction = (card: BaseCard): CardPreview["primaryAction"] => {
  const deckKey = getDeckKey(card);
  if (deckKey === "doodads") return "pay";
  if (deckKey === "offers") return "resolve";
  if (isTradeableSecurityCard(card) || isStockSplitEventCard(card)) return "resolve";
  return "buy";
};

const canPassCard = (card: BaseCard): boolean => {
  const deckKey = getDeckKey(card);
  if (deckKey === "doodads") return false;
  if (deckKey === "offers") return false;
  if (isTradeableSecurityCard(card) || isStockSplitEventCard(card)) return false;
  return true;
};

const buildCardPreview = (card: BaseCard, player?: Player): CardPreview => ({
  cost: deriveCardCostForPlayer(card, player),
  cashflow: deriveCardCashflow(card),
  canPass: canPassCard(card),
  primaryAction: derivePrimaryAction(card)
});

const isDoodadCard = (card: BaseCard): boolean => {
  const deckKey = typeof card.deckKey === "string" ? card.deckKey.toLowerCase() : "";
  if (deckKey === "doodads") {
    return true;
  }
  return card.type?.toLowerCase().includes("doodad") ?? false;
};

const inferAssetCategory = (card: BaseCard): Asset["category"] => {
  const typeLabel = card.type?.toLowerCase() ?? "";
  if (/(stock|share|fund|certificate|deposit|\bcd\b)/.test(typeLabel)) {
    return "stock";
  }
  if (/(estate|house|condo|plex|apartment|land)/.test(typeLabel)) {
    return "realEstate";
  }
  if (/(business|company|franchise|venture|partnership)/.test(typeLabel)) {
    return "business";
  }
  if (/(collectible|coin|art|gold|jewel)/.test(typeLabel)) {
    return "collectible";
  }
  return "other";
};

type BankLoanResult = { principal: number; payment: number } | null;

const applyBankLoan = (player: Player, amountNeeded: number): BankLoanResult => {
  if (player.track === "fastTrack") {
    return null;
  }
  const principal = roundToNearestThousand(amountNeeded);
  if (principal <= 0) return null;
  const payment = Math.round(principal * 0.1);
  player.cash += principal;
  player.liabilities.push({
    id: `bank-loan-${uuid()}`,
    name: "Bank Loan",
    payment,
    balance: principal,
    category: "loan",
    metadata: { bank: true }
  });
  player.totalExpenses += payment;
  recalcPlayerIncome(player);
  return { principal, payment };
};

type FinancingOutcome =
  | { ok: true; loan?: NonNullable<BankLoanResult> }
  | { ok: false; shortfall: number };

const ensureFunds = (player: Player, cost: number): FinancingOutcome => {
  const required = Math.max(0, Math.abs(cost));
  if (required <= 0) return { ok: true };
  if (player.cash >= required) return { ok: true };
  const shortfall = required - player.cash;
  const loan = applyBankLoan(player, shortfall);
  if (loan) return { ok: true, loan };
  return { ok: false, shortfall };
};

// Offer / Stock 结算会在 `resolveMarket()` 统一处理，避免在 `completeDeal()` 内暗自“自动卖光”。

const recalcPlayerIncome = (player: Player) => {
  const salary = player.track === "fastTrack" ? 0 : player.scenario.salary;
  player.totalIncome = salary + player.passiveIncome;
  player.payday = player.totalIncome - player.totalExpenses;
  if (player.track === "ratRace" && !player.fastTrackUnlocked && player.totalExpenses > 0 && player.passiveIncome >= player.totalExpenses) {
    player.fastTrackUnlocked = true;
  }
};

const hasReachedFastTrackGoal = (player: Player): boolean =>
  player.track === "fastTrack" && typeof player.fastTrackTarget === "number" && player.passiveIncome >= player.fastTrackTarget;

const calculateVisitedSquares = (start: number, steps: number, boardLength: number): number[] => {
  if (steps <= 0) {
    return [];
  }
  const visited: number[] = [];
  let cursor = start;
  for (let i = 0; i < steps; i += 1) {
    cursor = (cursor + 1) % boardLength;
    visited.push(cursor);
  }
  return visited;
};

const applyVentureCashflow = (players: Player[], venture: JointVenture, totalDelta: number) => {
  if (totalDelta === 0) {
    return;
  }
  venture.participants.forEach((participant) => {
    const player = players.find((p) => p.id === participant.playerId);
    if (!player) return;
    const share = totalDelta * (participant.equity / 100);
    if (share !== 0) {
      player.passiveIncome += share;
      recalcPlayerIncome(player);
    }
  });
};

const buildPlayer = (setup: SetupPlayer, settings: GameSettings): Player => {
  const scenario = scenarios.find((sc) => sc.id === setup.scenarioId) ?? scenarios[0];
  const dream = dreams.find((d) => d.id === setup.dreamId);
  const expenses =
    scenario.taxes +
    scenario.mortgagePayment +
    scenario.carPayment +
    scenario.creditCardPayment +
    scenario.retailPayment +
    scenario.otherExpenses;

  return {
    id: uuid(),
    name: setup.name,
    color: setup.color,
    scenario,
    cash: determineStartingCash(scenario, settings),
    passiveIncome: 0,
    totalIncome: scenario.salary,
    totalExpenses: expenses,
    payday: scenario.salary - expenses,
    position: 0,
    dream,
    assets: [],
    liabilities: [
      {
        id: `${scenario.id}-mortgage`,
        name: "Mortgage",
        payment: scenario.mortgagePayment,
        balance: scenario.mortgage,
        category: "mortgage"
      },
      {
        id: `${scenario.id}-car`,
        name: "Car Loan",
        payment: scenario.carPayment,
        balance: scenario.carLoan,
        category: "loan"
      },
      {
        id: `${scenario.id}-credit`,
        name: "Credit Cards",
        payment: scenario.creditCardPayment,
        balance: scenario.creditDebt,
        category: "credit"
      },
      {
        id: `${scenario.id}-retail`,
        name: "Retail",
        payment: scenario.retailPayment,
        balance: scenario.retailDebt,
        category: "other"
      }
    ],
    charityTurns: 0,
    children: 0,
    childExpense: 0,
    skipTurns: 0,
    isLLM: setup.isLLM,
    llmModel: setup.llmModel,
    llmPersona: setup.llmPersona,
    fastTrackUnlocked: false,
    track: "ratRace"
  };
};

export const useGameStore = create<GameStore>((set, get) => {
  const finalizeFastTrackWin = (playerId: string): boolean => {
    const state = get();
    if (state.phase === "finished") return false;
    const player = state.players.find((p) => p.id === playerId);
    if (!player || !hasReachedFastTrackGoal(player)) return false;
    set(
      produce<GameStore>((draft) => {
        draft.phase = "finished";
      })
    );
    state.addLog(
      "log.fastTrack.dreamAchieved",
      { dream: player.dream?.id, target: player.fastTrackTarget, passiveIncome: player.passiveIncome },
      playerId
    );
    return true;
  };

  const advanceToNextPlayer = () => {
    set(
      produce<GameStore>((draft) => {
        if (!draft.currentPlayerId || draft.players.length === 0) return;

        const currentIndex = draft.players.findIndex((player) => player.id === draft.currentPlayerId);
        const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = (safeCurrentIndex + 1) % draft.players.length;

        discardSelectedCard(draft);
        draft.charityPrompt = undefined;
        draft.dice = undefined;

        draft.currentPlayerId = draft.players[nextIndex].id;
        if (safeCurrentIndex === draft.players.length - 1) {
          draft.turn += 1;
        }
        draft.turnState = "awaitRoll";
        draft.history.push({ turn: draft.turn, players: draft.players.map((player) => ({ ...player })) });
      })
    );
  };

  const beginTurn = () => {
    const maxIterations = Math.max(1, get().players.length) * 10;
    let iterations = 0;

    while (iterations < maxIterations) {
      const state = get();
      if (state.phase === "setup" || state.phase === "finished") return;
      if (!state.currentPlayerId || state.players.length === 0) return;

      const currentPlayer = state.players.find((player) => player.id === state.currentPlayerId);
      if (!currentPlayer) return;

      set(
        produce<GameStore>((draft) => {
          draft.dice = undefined;
          discardSelectedCard(draft);
          draft.charityPrompt = undefined;
          draft.turnState = "awaitRoll";
        })
      );

      if (currentPlayer.skipTurns <= 0) {
        return;
      }

      set(
        produce<GameStore>((draft) => {
          const player = draft.players.find((p) => p.id === state.currentPlayerId);
          if (player && player.skipTurns > 0) {
            player.skipTurns -= 1;
          }
        })
      );
      get().addLog("log.playerSkipsTurn", { reason: "Downsized" }, state.currentPlayerId);
      advanceToNextPlayer();
      iterations += 1;
    }
  };

  return {
    phase: "setup",
    board: boardSquares,
    fastTrackBoard: fastTrackSquares,
    players: [],
    currentPlayerId: null,
    turnState: "awaitRoll",
    decks: {
      smallDeals: [],
      bigDeals: [],
      offers: [],
      doodads: []
    },
    discard: {
      smallDeals: [],
      bigDeals: [],
      offers: [],
      doodads: []
    },
    selectedCard: undefined,
    dice: undefined,
    turn: 1,
    logs: [],
    ventures: [],
    loans: [],
    settings: defaultSettings,
    history: [],
    charityPrompt: undefined,
    beginTurn,
    initGame: ({ players: playerSetups, settings }) => {
    const mergedSettings = { ...get().settings, ...settings };
    if (!mergedSettings.enableSmallDeals && !mergedSettings.enableBigDeals) {
      throw new Error("Invalid game settings: at least one deal deck must remain enabled.");
    }
    const players = playerSetups.map((setup) => buildPlayer(setup, mergedSettings));
    set(
      produce<GameStore>((state) => {
        state.players = players;
        state.currentPlayerId = players[0]?.id ?? null;
        state.phase = players.length > 0 ? "ratRace" : "setup";
        state.turn = 1;
        state.logs = [];
        state.selectedCard = undefined;
        state.dice = undefined;
        state.charityPrompt = undefined;
        state.turnState = "awaitRoll";
        state.decks.smallDeals = buildDeckFromSource("smallDeals", mergedSettings);
        state.decks.bigDeals = buildDeckFromSource("bigDeals", mergedSettings);
        state.decks.offers = buildDeckFromSource("offers", mergedSettings);
        state.decks.doodads = buildDeckFromSource("doodads", mergedSettings);
        state.discard = { smallDeals: [], bigDeals: [], offers: [], doodads: [] };
        state.settings = mergedSettings;
        state.history = [{ turn: 1, players: players.map((p) => ({ ...p })) }];
      })
    );
    get().addLog("log.gameInitialized");
    get().beginTurn();
  },
  addLog: (message, payload, playerId) => {
    const { settings, phase, turn, logs } = get();
    const entry: GameLogEntry = {
      id: uuid(),
      message,
      payload,
      playerId,
      phase,
      turn,
      timestamp: new Date().toISOString(),
      localeMessage: t(settings.locale, message)
    };
    set({ logs: [...logs, entry] });
  },
  getCardPreview: (card, playerId) => {
    const state = get();
    const resolvedPlayerId = playerId ?? state.currentPlayerId;
    const player = resolvedPlayerId ? state.players.find((p) => p.id === resolvedPlayerId) : undefined;
    return buildCardPreview(card, player);
  },
  applySelectedCard: () => {
    const state = get();
    if (state.turnState !== "awaitCard") return;
    if (!state.selectedCard) return;
    const currentPlayerId = state.currentPlayerId;
    if (!currentPlayerId) return;
    const preview = state.getCardPreview(state.selectedCard, currentPlayerId);
    const cashDelta = -preview.cost;
    state.completeDeal({ card: state.selectedCard, playerId: currentPlayerId, cashDelta, cashflowDelta: preview.cashflow });
  },
  passSelectedCard: () => {
    const state = get();
    if (state.turnState !== "awaitCard") return;
    if (!state.selectedCard) return;
    const currentPlayerId = state.currentPlayerId;
    const preview = state.getCardPreview(state.selectedCard, currentPlayerId ?? undefined);
    if (!preview.canPass) {
      state.addLog("log.card.passDenied", { cardId: state.selectedCard.id, deck: state.selectedCard.deckKey }, currentPlayerId ?? undefined);
      return;
    }
    state.clearCard();
  },
  resolveMarket: (payload) => {
    const state = get();
    if (state.turnState !== "awaitMarket") return;
    if (!state.selectedCard) return;
    if (!state.currentPlayerId) return;

    const cardSnapshot = state.selectedCard;
    const currentPlayerId = state.currentPlayerId;
    const sellSelections = payload?.sell ?? {};
    const buyQuantity = payload?.buyQuantity ?? 0;

    const beforeStatus = captureFastTrackStatus(get().players);
    const offerOutcomes: Array<{ playerId: string; cashGained: number; passiveDelta: number; assetsSold: number }> = [];
    const stockTrades: Array<{
      playerId: string;
      symbol: string;
      price: number;
      soldShares: number;
      boughtShares: number;
      cashDelta: number;
      dividendDelta: number;
    }> = [];
    const bankLoans: NonNullable<BankLoanResult>[] = [];

    set(
      produce<GameStore>((draft) => {
        if (draft.turnState !== "awaitMarket") return;
        const card = draft.selectedCard;
        if (!card) return;
        if (!draft.currentPlayerId) return;

        const normalizeQuantity = (value: unknown, max: number): number => {
          if (!Number.isFinite(max) || max <= 0) return 0;
          const raw = typeof value === "number" ? value : Number(value);
          if (!Number.isFinite(raw)) return 0;
          const normalized = Math.floor(raw);
          if (normalized <= 0) return 0;
          return Math.min(normalized, Math.floor(max));
        };

        const buildTurnOrder = (): Player[] => {
          const startIndex = draft.players.findIndex((p) => p.id === draft.currentPlayerId);
          if (startIndex < 0) return draft.players;
          return [...draft.players.slice(startIndex), ...draft.players.slice(0, startIndex)];
        };

        if (card.deckKey === "offers") {
          const kind = isOfferImproveCard(card)
            ? "improve"
            : isOfferForcedLimitedSaleCard(card)
              ? "forcedLimited"
              : isOfferSellCard(card)
                ? "sell"
                : "noop";

          const allowAllPlayers = kind !== "sell" || cardMentionsEveryone(card);
          const allowedPlayerIds = new Set<string>(
            allowAllPlayers ? draft.players.map((p) => p.id) : [draft.currentPlayerId].filter(Boolean)
          );
          const turnOrder = buildTurnOrder();

          turnOrder.forEach((player) => {
            if (!allowedPlayerIds.has(player.id)) return;
            let cashGained = 0;
            let passiveDelta = 0;
            let assetsSold = 0;

            if (kind === "improve") {
              const delta = typeof card.cashFlow === "number" ? card.cashFlow : 0;
              if (delta !== 0) {
                player.assets = player.assets.map((asset) => {
                  if (!matchesOffer(asset, card)) return asset;
                  assetsSold += 1;
                  passiveDelta += delta;
                  return { ...asset, cashflow: asset.cashflow + delta };
                });
                if (passiveDelta !== 0) {
                  player.passiveIncome += passiveDelta;
                  recalcPlayerIncome(player);
                }
              }
            } else if (kind === "forcedLimited") {
              player.assets = player.assets.reduce<Asset[]>((kept, asset) => {
                if (!matchesOffer(asset, card)) {
                  kept.push(asset);
                  return kept;
                }
                assetsSold += 1;
                cashGained += Math.max(0, asset.cost) * 2;
                passiveDelta -= asset.cashflow;
                return kept;
              }, []);
              if (cashGained !== 0) {
                player.cash += cashGained;
              }
              if (passiveDelta !== 0) {
                player.passiveIncome += passiveDelta;
                recalcPlayerIncome(player);
              }
            } else if (kind === "sell") {
              const perPlayer = sellSelections[player.id] ?? {};
              Object.entries(perPlayer).forEach(([assetId, requested]) => {
                const index = player.assets.findIndex((asset) => asset.id === assetId);
                if (index < 0) return;
                const asset = player.assets[index];
                if (!matchesOffer(asset, card)) return;

                const available = getAssetAvailableQuantity(asset);
                const quantityToSell = normalizeQuantity(requested, available);
                if (quantityToSell <= 0) return;

                const units = typeof asset.metadata?.units === "number" ? asset.metadata.units : 1;
                const offerPerUnit = typeof card.offerPerUnit === "number" ? card.offerPerUnit : undefined;
                const offer = typeof card.offer === "number" ? card.offer : undefined;
                const gross =
                  typeof offerPerUnit === "number"
                    ? offerPerUnit * units
                    : typeof offer === "number"
                      ? asset.category === "collectible" && available > 1
                        ? offer * quantityToSell
                        : offer
                      : 0;
                const mortgage = typeof asset.metadata?.mortgage === "number" ? asset.metadata.mortgage : 0;
                const net = Math.max(gross - mortgage, 0);

                cashGained += net;
                assetsSold += 1;

                if (available <= quantityToSell || available === 1) {
                  passiveDelta -= asset.cashflow;
                  player.assets.splice(index, 1);
                } else {
                  player.assets[index] = { ...asset, quantity: available - quantityToSell };
                }
              });

              if (cashGained !== 0) {
                player.cash += cashGained;
              }
              if (passiveDelta !== 0) {
                player.passiveIncome += passiveDelta;
                recalcPlayerIncome(player);
              }
            }

            if (cashGained !== 0 || passiveDelta !== 0 || assetsSold !== 0) {
              offerOutcomes.push({ playerId: player.id, cashGained, passiveDelta, assetsSold });
            }
          });
        } else if (isStockSplitEventCard(card)) {
          const symbol = typeof card.symbol === "string" ? card.symbol : "";
          const kind = getStockSplitKind(card);
          if (symbol && kind) {
            const normalizedSymbol = symbol.toLowerCase();
            draft.players.forEach((player) => {
              let passiveDelta = 0;
              player.assets = player.assets.reduce<Asset[]>((kept, asset) => {
                const assetSymbol = asset.metadata?.symbol;
                if (typeof assetSymbol !== "string" || assetSymbol.toLowerCase() !== normalizedSymbol) {
                  kept.push(asset);
                  return kept;
                }

                const available = getAssetAvailableQuantity(asset);
                const nextQuantity = kind === "split" ? available * 2 : Math.floor(available / 2);
                const dividendPerShare =
                  typeof asset.metadata?.dividendPerShare === "number"
                    ? asset.metadata.dividendPerShare
                    : typeof asset.metadata?.dividend === "number"
                      ? asset.metadata.dividend
                      : 0;
                if (dividendPerShare) {
                  passiveDelta += dividendPerShare * (nextQuantity - available);
                }
                if (nextQuantity <= 0) {
                  return kept;
                }
                const nextCashflow = dividendPerShare ? dividendPerShare * nextQuantity : asset.cashflow;
                kept.push({ ...asset, quantity: nextQuantity, cashflow: nextCashflow });
                return kept;
              }, []);
              if (passiveDelta !== 0) {
                player.passiveIncome += passiveDelta;
                recalcPlayerIncome(player);
              }
            });
          }
        } else if (isTradeableSecurityCard(card)) {
          const symbol = typeof card.symbol === "string" ? card.symbol : "";
          const price = typeof card.price === "number" ? card.price : 0;
          if (!symbol || !Number.isFinite(price) || price <= 0) {
            // 无法解析的证券卡：当作已读并结束。
          } else {
            const allowAllPlayers = cardMentionsEveryone(card);
            const allowedPlayerIds = new Set<string>(
              allowAllPlayers ? draft.players.map((p) => p.id) : [draft.currentPlayerId].filter(Boolean)
            );
            const normalizedSymbol = symbol.toLowerCase();
            const turnOrder = buildTurnOrder();

            // 先按回合顺序处理卖出，避免“先买后卖”导致不必要的贷款。
            turnOrder.forEach((player) => {
              if (!allowedPlayerIds.has(player.id)) return;
              const perPlayer = sellSelections[player.id] ?? {};
              let soldShares = 0;
              let cashDelta = 0;
              let dividendDelta = 0;

              Object.entries(perPlayer).forEach(([assetId, requested]) => {
                const index = player.assets.findIndex((asset) => asset.id === assetId);
                if (index < 0) return;
                const asset = player.assets[index];
                if (asset.category !== "stock") return;
                const assetSymbol = asset.metadata?.symbol;
                if (typeof assetSymbol !== "string" || assetSymbol.toLowerCase() !== normalizedSymbol) return;

                const available = getAssetAvailableQuantity(asset);
                const toSell = normalizeQuantity(requested, available);
                if (toSell <= 0) return;

                const dividendPerShare =
                  typeof asset.metadata?.dividendPerShare === "number"
                    ? asset.metadata.dividendPerShare
                    : typeof asset.metadata?.dividend === "number"
                      ? asset.metadata.dividend
                      : 0;

                const proceeds = price * toSell;
                player.cash += proceeds;
                cashDelta += proceeds;
                soldShares += toSell;

                if (dividendPerShare) {
                  const delta = -dividendPerShare * toSell;
                  dividendDelta += delta;
                  player.passiveIncome += delta;
                }

                const remaining = available - toSell;
                if (remaining <= 0) {
                  player.assets.splice(index, 1);
                } else {
                  const nextCashflow = dividendPerShare ? dividendPerShare * remaining : asset.cashflow;
                  player.assets[index] = { ...asset, quantity: remaining, cashflow: nextCashflow };
                }
              });

              if (dividendDelta !== 0) {
                recalcPlayerIncome(player);
              }
              if (soldShares > 0) {
                stockTrades.push({
                  playerId: player.id,
                  symbol,
                  price,
                  soldShares,
                  boughtShares: 0,
                  cashDelta,
                  dividendDelta
                });
              }
            });

            // 再处理当前玩家的买入。
            const current = draft.players.find((p) => p.id === draft.currentPlayerId);
            if (current) {
              const toBuy = normalizeQuantity(buyQuantity, Number.MAX_SAFE_INTEGER);
              if (toBuy > 0) {
                const cost = price * toBuy;
                const cashAvailable = current.cash;
                const financing = ensureFunds(current, cost);
                if (financing.ok) {
                  if (financing.loan) bankLoans.push(financing.loan);
                  current.cash -= cost;

                  const dividendPerShare = typeof card.dividend === "number" ? card.dividend : 0;
                  const existingIndex = current.assets.findIndex((asset) => {
                    const assetSymbol = asset.metadata?.symbol;
                    return asset.category === "stock" && typeof assetSymbol === "string" && assetSymbol.toLowerCase() === normalizedSymbol;
                  });
                  if (existingIndex >= 0) {
                    const existing = current.assets[existingIndex];
                    const existingQty = getAssetAvailableQuantity(existing);
                    const nextQty = existingQty + toBuy;
                    const nextCashflow = dividendPerShare ? dividendPerShare * nextQty : existing.cashflow;
                    current.assets[existingIndex] = {
                      ...existing,
                      quantity: nextQty,
                      cashflow: nextCashflow,
                      cost: Math.max(0, existing.cost) + cost,
                      metadata: { ...existing.metadata, dividendPerShare }
                    };
                  } else {
                    current.assets.push({
                      id: `stock-${uuid()}`,
                      name: card.name ? `${card.name} (${symbol})` : symbol,
                      category: "stock",
                      cashflow: dividendPerShare ? dividendPerShare * toBuy : 0,
                      cost,
                      quantity: toBuy,
                      metadata: {
                        symbol,
                        securityType: card.type,
                        dividendPerShare
                      }
                    });
                  }

                  const dividendIncome = dividendPerShare ? dividendPerShare * toBuy : 0;
                  if (dividendIncome) {
                    current.passiveIncome += dividendIncome;
                    recalcPlayerIncome(current);
                  }

                  stockTrades.push({
                    playerId: current.id,
                    symbol,
                    price,
                    soldShares: 0,
                    boughtShares: toBuy,
                    cashDelta: -cost,
                    dividendDelta: dividendIncome
                  });
                } else {
                  // 目前只会发生在 Fast Track（禁止银行贷款），但 Fast Track 不能抽 Small/Big deal。
                  stockTrades.push({
                    playerId: current.id,
                    symbol,
                    price,
                    soldShares: 0,
                    boughtShares: 0,
                    cashDelta: 0,
                    dividendDelta: 0
                  });
                  // 记录失败但不改变状态，避免卡死。
                  current.cash = cashAvailable;
                }
              }
            }
          }
        }

        discardSelectedCard(draft);
        draft.turnState = "awaitEnd";
      })
    );

    detectFastTrackUnlocks(beforeStatus, get().players, (player) => get().addLog("log.fastTrackUnlocked", undefined, player.id));

    const after = get();
    bankLoans.forEach((loan) => after.addLog("log.bank.loanIssued", { principal: loan.principal, payment: loan.payment }, currentPlayerId));

    if (offerOutcomes.length > 0) {
      offerOutcomes.forEach((outcome) => {
        after.addLog(
          "log.offerResolved",
          { cardId: cardSnapshot.id, cashGained: outcome.cashGained, passiveDelta: outcome.passiveDelta, assetsSold: outcome.assetsSold },
          outcome.playerId
        );
      });
    }

    if (stockTrades.length > 0) {
      stockTrades.forEach((trade) => {
        after.addLog(
          "log.stock.trade",
          {
            cardId: cardSnapshot.id,
            symbol: trade.symbol,
            price: trade.price,
            soldShares: trade.soldShares,
            boughtShares: trade.boughtShares,
            cashDelta: trade.cashDelta,
            dividendDelta: trade.dividendDelta
          },
          trade.playerId
        );
      });
    }

    after.addLog(
      "log.market.resolved",
      {
        cardId: cardSnapshot.id,
        deck: cardSnapshot.deckKey,
        type: cardSnapshot.type,
        offerPlayers: offerOutcomes.length,
        stockTrades: stockTrades.length
      },
      currentPlayerId
    );
  },
  rollDice: () => {
    const state = get();
    if (!state.currentPlayerId) {
      return;
    }
    if (state.turnState !== "awaitRoll") {
      return;
    }
    if (state.selectedCard) {
      return;
    }
    const player = state.players.find((p) => p.id === state.currentPlayerId);
    if (!player) {
      return;
    }
    const pendingCharity = state.charityPrompt;
    if (pendingCharity && pendingCharity.playerId === player.id) {
      return;
    }

    const previousPosition = player.position;
    const playerBoardLength = player.track === "fastTrack" ? state.fastTrackBoard.length : state.board.length;
    if (playerBoardLength === 0) {
      return;
    }
    const hasCharityBoost = player.charityTurns > 0;
    const baseDice = state.settings.useCashflowDice ? 1 : 2;
    const charityBonus = hasCharityBoost ? 1 : 0;
    const dieCount = Math.max(1, baseDice + charityBonus);
    const diceValues = Array.from({ length: dieCount }, () => Math.ceil(Math.random() * 6));
    const total = diceValues.reduce((sum, value) => sum + value, 0);
    const dice: DiceRoll = { dice: diceValues, total };

    set(
      produce<GameStore>((draft) => {
        draft.dice = dice;
        draft.turnState = "awaitEnd";
        const current = draft.players.find((p) => p.id === player.id);
        if (!current) return;
        if (hasCharityBoost && current.charityTurns > 0) {
          current.charityTurns -= 1;
        }
        const trackBoard = current.track === "fastTrack" ? draft.fastTrackBoard : draft.board;
        if (trackBoard.length > 0) {
          current.position = (current.position + total) % trackBoard.length;
        }
      })
    );

    const newPlayer = get().players.find((p) => p.id === player.id);
    if (newPlayer) {
      get().addLog("log.playerRolled", { dice, position: newPlayer.position }, newPlayer.id);
      get().resolvePayday(newPlayer.id, previousPosition, total);
    }
  },
  drawCard: (deck) => {
    const state = get();
    if (state.turnState !== "awaitAction") {
      return;
    }
    if ((deck === "smallDeals" && !state.settings.enableSmallDeals) || (deck === "bigDeals" && !state.settings.enableBigDeals)) {
      return;
    }
    const pendingCharity = state.charityPrompt;
    if (pendingCharity && pendingCharity.playerId === state.currentPlayerId) {
      return;
    }
    const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
    if (!currentPlayer || currentPlayer.track !== "ratRace") {
      return;
    }
    const square = state.board[currentPlayer.position];
    if (!square || square.type !== "OPPORTUNITY") {
      return;
    }
    if (deck !== "smallDeals" && deck !== "bigDeals") {
      return;
    }
    if (state.selectedCard) {
      return;
    }
    set(
      produce<GameStore>((draft) => {
        if (draft.selectedCard) return;
        const player = draft.players.find((p) => p.id === draft.currentPlayerId);
        if (!player || player.track !== "ratRace") return;
        const currentSquare = draft.board[player.position];
        if (!currentSquare || currentSquare.type !== "OPPORTUNITY") return;
        const drawn = drawCardForPlayer(draft, deck, player);
        if (drawn) {
          const card = draft.selectedCard;
          if (card && (isTradeableSecurityCard(card) || isStockSplitEventCard(card))) {
            draft.turnState = "awaitMarket";
          } else {
            draft.turnState = "awaitCard";
          }
        }
      })
    );
  },
  clearCard: () => {
    const state = get();
    const currentPlayerId = state.currentPlayerId ?? undefined;
    let passDeniedPayload: Record<string, unknown> | null = null;
    set(
      produce<GameStore>((draft) => {
        if (draft.turnState === "awaitMarket" && draft.selectedCard) {
          passDeniedPayload = { cardId: draft.selectedCard.id, deck: draft.selectedCard.deckKey };
          return;
        }
        if (draft.turnState === "awaitCard" && draft.selectedCard) {
          const preview = buildCardPreview(
            draft.selectedCard,
            currentPlayerId ? draft.players.find((player) => player.id === currentPlayerId) : undefined
          );
          if (!preview.canPass) {
            passDeniedPayload = { cardId: draft.selectedCard.id, deck: draft.selectedCard.deckKey };
            return;
          }
        }
        discardSelectedCard(draft);
        if (draft.turnState === "awaitCard") {
          draft.turnState = "awaitEnd";
        }
      })
    );
    if (passDeniedPayload) {
      state.addLog("log.card.passDenied", passDeniedPayload, currentPlayerId);
    }
  },
  completeDeal: ({ card, playerId, cashDelta, cashflowDelta }) => {
    const state = get();
    const targetPlayerId = playerId ?? state.currentPlayerId;
    if (!targetPlayerId) return;
    if (state.turnState !== "awaitCard") return;
    if (!state.selectedCard) return;
    if (state.selectedCard.id !== card.id || state.selectedCard.deckKey !== card.deckKey) return;

    const beforeStatus = captureFastTrackStatus(get().players);
    let recordedAsset: Asset | undefined;
    let appliedCashflow = 0;
    let offerOutcome: OfferOutcome | undefined;
    let bankLoan: NonNullable<BankLoanResult> | undefined;
    let dealBlockedPayload: Record<string, unknown> | null = null;
    set(
      produce<GameStore>((draft) => {
        const target = draft.players.find((p) => p.id === targetPlayerId);
        if (!target) return;

        const targetDeck = (card.deckKey ?? "") as DeckKey;
        if (targetDeck === "offers") {
          offerOutcome = processOfferCard(card, target);
        } else {
          if (cashDelta < 0) {
            const cost = Math.abs(cashDelta);
            const cashAvailable = target.cash;
            const financing = ensureFunds(target, cost);
            if (!financing.ok) {
              dealBlockedPayload = {
                cardId: card.id,
                deck: card.deckKey,
                cost,
                cashAvailable,
                shortfall: financing.shortfall,
                track: target.track
              };
              return;
            }
            bankLoan = financing.loan;
          }

          target.cash += cashDelta;
          const isAsset = !isDoodadCard(card);
          const normalizedCashflow = deriveCardCashflow(card, cashflowDelta);

          if (isAsset) {
            appliedCashflow = normalizedCashflow;
            if (normalizedCashflow !== 0) {
              target.passiveIncome += normalizedCashflow;
              recalcPlayerIncome(target);
            }

            const typeLabel = card.type?.toLowerCase() ?? "";
            const isCoinAsset = typeLabel.includes("coin");

            if (isCoinAsset && card.name) {
              const quantityDelta = typeof card.amount === "number" && Number.isFinite(card.amount) ? Math.max(1, Math.floor(card.amount)) : 1;
              const purchaseCost = deriveAssetCost(card, Math.abs(cashDelta));
              const existingIndex = target.assets.findIndex(
                (asset) => asset.category === "collectible" && asset.name === card.name
              );
              if (existingIndex >= 0) {
                const existing = target.assets[existingIndex];
                const existingQty = getAssetAvailableQuantity(existing);
                const updated: Asset = {
                  ...existing,
                  quantity: existingQty + quantityDelta,
                  cost: Math.max(0, existing.cost) + purchaseCost
                };
                target.assets[existingIndex] = updated;
                recordedAsset = updated;
              } else {
                const asset: Asset = {
                  id: `${card.id}-${uuid()}`,
                  name: card.name,
                  category: "collectible",
                  cashflow: 0,
                  cost: purchaseCost,
                  quantity: quantityDelta,
                  metadata: {
                    cardId: card.id,
                    deck: card.deckKey,
                    landType: getLandType(card),
                    units: typeof card.units === "number" ? card.units : undefined,
                    mortgage: typeof card.mortgage === "number" ? card.mortgage : undefined
                  }
                };
                target.assets.push(asset);
                recordedAsset = asset;
              }
            } else if (card.name) {
              const asset: Asset = {
                id: `${card.id}-${uuid()}`,
                name: card.name,
                category: inferAssetCategory(card),
                cashflow: normalizedCashflow,
                cost: deriveAssetCost(card, Math.abs(cashDelta)),
                metadata: {
                  cardId: card.id,
                  deck: card.deckKey,
                  landType: getLandType(card),
                  units: typeof card.units === "number" ? card.units : undefined,
                  mortgage: typeof card.mortgage === "number" ? card.mortgage : undefined
                }
              };
              target.assets.push(asset);
              recordedAsset = asset;
            }
          } else if (typeof card.loan === "number" && typeof card.payment === "number") {
            target.liabilities.push({
              id: `${card.id}-loan-${uuid()}`,
              name: card.name ?? "Loan",
              payment: card.payment,
              balance: card.loan,
              category: "loan",
              metadata: { source: card.id }
            });
            target.totalExpenses += card.payment;
            recalcPlayerIncome(target);
          }
        }

        draft.turnState = "awaitEnd";
      })
    );
    detectFastTrackUnlocks(beforeStatus, get().players, (player) => get().addLog("log.fastTrackUnlocked", undefined, player.id));
    if (dealBlockedPayload) {
      get().addLog("log.deal.failed", dealBlockedPayload, playerId);
      return;
    }
    if (bankLoan) {
      get().addLog("log.bank.loanIssued", { principal: bankLoan.principal, payment: bankLoan.payment }, playerId);
    }
    if (offerOutcome) {
      get().addLog(
        "log.offerResolved",
        {
          cardId: card.id,
          cashGained: offerOutcome.cashGain,
          passiveDelta: offerOutcome.passiveDelta,
          assetsSold: offerOutcome.affectedAssets.length
        },
        playerId
      );
    } else {
      get().addLog(
        "log.dealCompleted",
        {
          cardId: card.id,
          cashDelta,
          cashflowDelta: appliedCashflow || undefined,
          assetCategory: recordedAsset?.category,
          assetCost: recordedAsset?.cost
        },
        playerId
      );
    }
    get().clearCard();
  },
  resolvePayday: (playerId, previousPosition = 0, stepsMoved = 0) => {
    const beforeStatus = captureFastTrackStatus(get().players);
    let paydayHits = 0;
    let paydayAward = 0;
    let childExpenseIncurred: number | undefined;
    let downsizePenalty: number | undefined;
    let charityAmount: number | undefined;
    let liabilityPenalty: number | undefined;
    let fastTrackBonus: number | undefined;
    let passiveBoost: number | undefined;
    let fastPenalty: number | undefined;
    let visitedFastDream = false;
    let dreamWin = false;
    let bankLoans: NonNullable<BankLoanResult>[] = [];
    let paymentFailure:
      | { logKey: string; required: number; cashAvailable: number; shortfall: number; track: Player["track"] }
      | undefined;

    set(
      produce<GameStore>((draft) => {
        const target = draft.players.find((p) => p.id === playerId);
        if (!target) return;
        const trackBoard = target.track === "fastTrack" ? draft.fastTrackBoard : draft.board;
        if (trackBoard.length === 0) return;
        const boardEntry = trackBoard[target.position];
        if (!boardEntry) return;

        const visited = calculateVisitedSquares(previousPosition, stepsMoved, trackBoard.length);
        if (target.track === "ratRace") {
          paydayHits = visited.filter((pos) => draft.board[pos]?.type === "PAYCHECK").length;
          if (paydayHits > 0) {
            paydayAward = target.payday * paydayHits;
            target.cash += paydayAward;
          }
        } else {
          const fastHits = visited.filter((pos) => draft.fastTrackBoard[pos]?.type === "FAST_PAYDAY").length;
          if (fastHits > 0) {
            const bonus = target.payday * fastHits;
            fastTrackBonus = (fastTrackBonus ?? 0) + bonus;
            target.cash += bonus;
          }
          paydayHits = 0;
        }

        switch (boardEntry.type) {
          case "LIABILITY":
            discardSelectedCard(draft);
            {
              const drawn = drawCardForPlayer(draft, "doodads", target);
              draft.turnState = drawn ? "awaitCard" : "awaitEnd";
            }
            break;
          case "OFFER":
            discardSelectedCard(draft);
            {
              const drawn = drawCardForPlayer(draft, "offers", target);
              draft.turnState = drawn ? "awaitMarket" : "awaitEnd";
            }
            break;
          case "CHARITY":
            charityAmount = Math.max(Math.round(target.totalIncome * 0.1), 100);
            draft.charityPrompt = { playerId, amount: charityAmount };
            draft.turnState = "awaitCharity";
            break;
          case "CHILD": {
            const maxChildren = 3;
            if (target.children < maxChildren) {
              const expensePerChild = Math.max(Math.round(target.scenario.salary * 0.056), 100);
              target.children += 1;
              target.childExpense += expensePerChild;
              target.totalExpenses += expensePerChild;
              recalcPlayerIncome(target);
              childExpenseIncurred = expensePerChild;
            }
            draft.turnState = "awaitEnd";
            break;
          }
          case "DOWNSIZE":
            downsizePenalty = target.totalExpenses;
            {
              const cashAvailable = target.cash;
              const financing = ensureFunds(target, downsizePenalty);
              if (!financing.ok) {
                paymentFailure = {
                  logKey: "log.board.downsize.failed",
                  required: downsizePenalty,
                  cashAvailable,
                  shortfall: financing.shortfall,
                  track: target.track
                };
              } else {
                if (financing.loan) bankLoans.push(financing.loan);
                target.cash -= downsizePenalty;
              }
            }
            target.skipTurns = Math.max(target.skipTurns, 3);
            draft.turnState = "awaitEnd";
            break;
          case "OPPORTUNITY":
            draft.turnState = target.track === "ratRace" ? "awaitAction" : "awaitEnd";
            break;
          case "FAST_PAYDAY":
            fastTrackBonus = fastTrackBonus ?? target.payday;
            draft.turnState = "awaitEnd";
            break;
          case "FAST_OPPORTUNITY":
            passiveBoost = Math.max(2000, Math.round(target.payday * 0.5));
            target.passiveIncome += passiveBoost;
            recalcPlayerIncome(target);
            draft.turnState = "awaitEnd";
            break;
          case "FAST_DONATION":
            charityAmount = Math.max(Math.round(target.totalIncome * 0.2), 5000);
            draft.charityPrompt = { playerId, amount: charityAmount };
            draft.turnState = "awaitCharity";
            break;
          case "FAST_PENALTY":
            fastPenalty = Math.max(target.totalExpenses, 3000);
            {
              const cashAvailable = target.cash;
              const financing = ensureFunds(target, fastPenalty);
              if (!financing.ok) {
                paymentFailure = {
                  logKey: "log.board.fast_penalty.failed",
                  required: fastPenalty,
                  cashAvailable,
                  shortfall: financing.shortfall,
                  track: target.track
                };
              } else {
                if (financing.loan) bankLoans.push(financing.loan);
                target.cash -= fastPenalty;
              }
            }
            draft.turnState = "awaitEnd";
            break;
          case "FAST_DREAM":
            visitedFastDream = true;
            draft.turnState = "awaitEnd";
            break;
          case "PAYCHECK":
          default:
            draft.turnState = "awaitEnd";
            break;
        }
      })
    );
    detectFastTrackUnlocks(beforeStatus, get().players, (player) => get().addLog("log.fastTrackUnlocked", undefined, player.id));

    const state = get();
    const resolvedPlayer = state.players.find((p) => p.id === playerId);
    if (paydayHits > 0 && resolvedPlayer) {
      state.addLog("log.payday.passed", { paychecks: paydayHits, amount: paydayAward, track: resolvedPlayer.track }, playerId);
    }
    const boardEntry =
      resolvedPlayer && resolvedPlayer.track === "fastTrack"
        ? state.fastTrackBoard[resolvedPlayer.position]
        : resolvedPlayer
          ? state.board[resolvedPlayer.position]
          : undefined;
    if (boardEntry && resolvedPlayer) {
      const payload: Record<string, unknown> = { square: boardEntry, track: resolvedPlayer.track };
      if (paydayHits > 0) {
        payload.paychecks = paydayHits;
        payload.paydayAward = paydayAward;
      }
      if (childExpenseIncurred) {
        payload.childExpense = childExpenseIncurred;
      }
      if (downsizePenalty) {
        payload.downsizePenalty = downsizePenalty;
      }
      if (charityAmount) {
        payload.charityAmount = charityAmount;
      }
      if (liabilityPenalty) {
        payload.liabilityPenalty = liabilityPenalty;
      }
      if (fastTrackBonus) {
        payload.fastTrackBonus = fastTrackBonus;
      }
      if (passiveBoost) {
        payload.passiveBoost = passiveBoost;
      }
      if (fastPenalty) {
        payload.fastPenalty = fastPenalty;
      }
      if (paymentFailure) {
        payload.paymentFailed = true;
        payload.paymentRequired = paymentFailure.required;
        payload.cashAvailable = paymentFailure.cashAvailable;
        payload.shortfall = paymentFailure.shortfall;
        payload.track = paymentFailure.track;
      }
      if (visitedFastDream && resolvedPlayer && hasReachedFastTrackGoal(resolvedPlayer)) {
        dreamWin = true;
        payload.dreamAchieved = true;
      }
      state.addLog(paymentFailure?.logKey ?? `log.board.${boardEntry.type.toLowerCase()}`, payload, playerId);
      if (bankLoans.length > 0) {
        bankLoans.forEach((loan) => state.addLog("log.bank.loanIssued", { principal: loan.principal, payment: loan.payment }, playerId));
      }
      if (dreamWin && resolvedPlayer) {
        finalizeFastTrackWin(resolvedPlayer.id);
      }
    }
  },
  nextPlayer: () => {
    const state = get();
    if (state.phase === "setup" || state.phase === "finished") return;
    if (!state.currentPlayerId || state.players.length === 0) return;
    if (state.turnState === "awaitRoll" || state.turnState === "awaitAction" || state.turnState === "awaitCard" || state.turnState === "awaitMarket") {
      return;
    }
    if (state.charityPrompt && state.charityPrompt.playerId === state.currentPlayerId) {
      state.skipCharity();
    }
    advanceToNextPlayer();
    state.beginTurn();
  },
  setLocale: (locale) => {
    set(
      produce<GameStore>((draft) => {
        draft.settings.locale = locale;
      })
    );
  },
  addJointVenture: (ventureInput) => {
    const venture: JointVenture = {
      ...ventureInput,
      id: uuid(),
      status: "forming",
      createdAt: new Date().toISOString()
    };
    set(
      produce<GameStore>((draft) => {
        venture.participants.forEach((participant) => {
          const player = draft.players.find((p) => p.id === participant.playerId);
          if (player) {
            player.cash -= participant.contribution;
          }
        });
        draft.ventures.push(venture);
      })
    );
    get().addLog("log.ventures.created", {
      ventureId: venture.id,
      cashNeeded: venture.cashNeeded,
      participants: venture.participants.map((participant) => ({
        playerId: participant.playerId,
        contribution: participant.contribution,
        equity: participant.equity
      }))
    });
  },
  updateJointVenture: (id, updates) => {
    const beforeStatus = captureFastTrackStatus(get().players);
    set(
      produce<GameStore>((draft) => {
        const venture = draft.ventures.find((v) => v.id === id);
        if (!venture) return;
        const previousStatus = venture.status;
        const previousCashflow = venture.cashflowImpact;
        Object.assign(venture, updates);

        const activating = previousStatus !== "active" && venture.status === "active";
        const deactivating = previousStatus === "active" && venture.status !== "active";
        if (activating) {
          applyVentureCashflow(draft.players, venture, venture.cashflowImpact);
        } else if (deactivating) {
          applyVentureCashflow(draft.players, venture, -previousCashflow);
        }

        if (typeof updates.cashflowImpact === "number" && venture.status === "active") {
          const delta = venture.cashflowImpact - previousCashflow;
          applyVentureCashflow(draft.players, venture, delta);
        }
      })
    );
    detectFastTrackUnlocks(beforeStatus, get().players, (player) => get().addLog("log.fastTrackUnlocked", undefined, player.id));
    const venture = get().ventures.find((v) => v.id === id);
    if (venture) {
      get().addLog("log.ventures.updated", { ventureId: venture.id, status: venture.status, cashflowImpact: venture.cashflowImpact });
    }
  },
  addLoan: (loanInput) => {
    let createdLoan: PlayerLoan | undefined;
    let lenderName: string | undefined;
    let borrowerName: string | undefined;
    set(
      produce<GameStore>((draft) => {
        const lender = draft.players.find((p) => p.id === loanInput.lenderId);
        const borrower = draft.players.find((p) => p.id === loanInput.borrowerId);
        if (!lender || !borrower) return;
        lender.cash -= loanInput.principal;
        borrower.cash += loanInput.principal;
        const loan: PlayerLoan = {
          ...loanInput,
          id: uuid(),
          status: "active",
          remaining: loanInput.principal
        };
        lenderName = lender.name;
        borrowerName = borrower.name;
        draft.loans.push(loan);
        createdLoan = loan;
      })
    );
    if (createdLoan) {
      get().addLog("log.loans.created", {
        loanId: createdLoan.id,
        principal: createdLoan.principal,
        lender: lenderName,
        borrower: borrowerName
      });
    }
  },
  repayLoan: (loanId, amount) => {
    let repaymentAmount = 0;
    let remainingBalance = 0;
    set(
      produce<GameStore>((draft) => {
        const loan = draft.loans.find((l) => l.id === loanId);
        if (!loan || loan.status !== "active") return;
        const lender = draft.players.find((p) => p.id === loan.lenderId);
        const borrower = draft.players.find((p) => p.id === loan.borrowerId);
        if (!lender || !borrower) return;
        const payment = Math.min(amount, loan.remaining);
        if (payment <= 0) return;
        borrower.cash -= payment;
        lender.cash += payment;
        loan.remaining -= payment;
        repaymentAmount = payment;
        remainingBalance = loan.remaining;
        if (loan.remaining <= 0) {
          loan.remaining = 0;
          loan.status = "repaid";
        }
      })
    );
    if (repaymentAmount > 0) {
      get().addLog("log.loans.repaid", { loanId, amount: repaymentAmount, remaining: remainingBalance });
    }
  },
  repayBankLoan: (liabilityId, amount) => {
    const state = get();
    if (state.phase === "setup" || state.phase === "finished") return;
    if (state.turnState !== "awaitEnd") return;
    if (!state.currentPlayerId) return;

    let repaid = 0;
    let remaining = 0;
    let previousPayment = 0;
    let updatedPayment = 0;

    set(
      produce<GameStore>((draft) => {
        const player = draft.players.find((p) => p.id === draft.currentPlayerId);
        if (!player || player.track !== "ratRace") return;

        const loanIndex = player.liabilities.findIndex((liability) => liability.id === liabilityId && liability.metadata?.bank);
        if (loanIndex < 0) return;

        const loan = player.liabilities[loanIndex];
        if (!Number.isFinite(amount)) return;
        const wantsPayoff = amount >= loan.balance;
        const requested = wantsPayoff ? loan.balance : Math.floor(amount / 1000) * 1000;
        if (requested <= 0) return;
        const paymentAmount = Math.min(requested, loan.balance);
        if (paymentAmount <= 0) return;
        if (player.cash < paymentAmount) return;

        player.cash -= paymentAmount;
        loan.balance -= paymentAmount;
        repaid = paymentAmount;
        remaining = Math.max(0, loan.balance);

        previousPayment = loan.payment;

        if (loan.balance <= 0) {
          updatedPayment = 0;
          player.liabilities.splice(loanIndex, 1);
        } else {
          loan.payment = Math.round(loan.balance * 0.1);
          updatedPayment = loan.payment;
        }

        player.totalExpenses = Math.max(0, player.totalExpenses - previousPayment + updatedPayment);
        recalcPlayerIncome(player);
      })
    );

    if (repaid > 0) {
      state.addLog(
        "log.bank.loanRepaid",
        { loanId: liabilityId, amount: repaid, remaining, previousPayment, updatedPayment },
        state.currentPlayerId
      );
    }
  },
  clearLog: () => {
    set({ logs: [] });
  },
  recordLLMAction: (playerId, action) => {
    get().addLog("log.llmAction", { action }, playerId);
  },
  enterFastTrack: (playerId) => {
    const state = get();
    if (state.currentPlayerId !== playerId) return;
    if (state.turnState === "awaitRoll" || state.turnState === "awaitCard" || state.turnState === "awaitMarket" || state.turnState === "awaitCharity") return;

    let entered = false;
    set(
      produce<GameStore>((draft) => {
        const player = draft.players.find((p) => p.id === playerId);
        if (!player || !player.fastTrackUnlocked || player.track === "fastTrack") return;
        const payday = player.payday;
        player.cash += payday * 100;
        player.assets = [];
        player.liabilities = [];
        player.passiveIncome = payday + 50000;
        player.fastTrackTarget = player.passiveIncome + 50000;
        player.totalExpenses = 0;
        player.totalIncome = player.passiveIncome;
        player.payday = player.passiveIncome;
        player.children = 0;
        player.childExpense = 0;
        const startSlots = [1, 7, 14, 21, 27, 34, 1, 7];
        const playerIndex = draft.players.findIndex((p) => p.id === playerId);
        player.position = startSlots[playerIndex] ?? 0;
        player.track = "fastTrack";
        const allPlayersFastTrack = draft.players.length > 0 && draft.players.every((p) => p.track === "fastTrack");
        if (allPlayersFastTrack) {
          draft.phase = "fastTrack";
        }
        entered = true;
      })
    );
    if (entered) {
      get().addLog("log.fastTrack.entered", undefined, playerId);
    }
  },
  donateCharity: () => {
    const state = get();
    if (state.turnState !== "awaitCharity") return;
    const prompt = state.charityPrompt;
    if (!prompt) return;
    let donationApplied = false;
    set(
      produce<GameStore>((draft) => {
        const player = draft.players.find((p) => p.id === prompt.playerId);
        if (!player) return;
        if (player.cash >= prompt.amount) {
          player.cash -= prompt.amount;
          player.charityTurns = 3;
          draft.charityPrompt = undefined;
          draft.turnState = "awaitEnd";
          donationApplied = true;
        } else {
          draft.charityPrompt = undefined;
          draft.turnState = "awaitEnd";
        }
      })
    );
    if (donationApplied) {
      state.addLog("log.charity.donated", { amount: prompt.amount }, prompt.playerId);
    } else {
      state.addLog("log.charity.failed", { amount: prompt.amount }, prompt.playerId);
    }
  },
  skipCharity: () => {
    const state = get();
    if (state.turnState !== "awaitCharity") return;
    const prompt = state.charityPrompt;
    if (!prompt) return;
    set({ charityPrompt: undefined, turnState: "awaitEnd" });
    state.addLog("log.charity.skipped", { amount: prompt.amount }, prompt.playerId);
  }
  };
});
