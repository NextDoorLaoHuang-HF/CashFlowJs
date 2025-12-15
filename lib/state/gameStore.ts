import { produce } from "immer";
import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { boardSquares, fastTrackSquares } from "../data/board";
import { cards } from "../data/cards";
import { dreams, scenarios } from "../data/scenarios";
import { t } from "../i18n";
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
  return "buy";
};

const canPassCard = (card: BaseCard): boolean => {
  const deckKey = getDeckKey(card);
  if (deckKey === "doodads") return false;
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
  if (/(stock|share|fund)/.test(typeLabel)) {
    return "stock";
  }
  if (/(estate|house|condo|plex|apartment|land)/.test(typeLabel)) {
    return "realEstate";
  }
  if (/(business|company|franchise|venture)/.test(typeLabel)) {
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

type OfferOutcome = {
  cashGain: number;
  passiveDelta: number;
  affectedAssets: string[];
};

const matchesOffer = (asset: Asset, card: BaseCard): boolean => {
  const offerType = (card.type ?? "").toString().toLowerCase();
  const landType = (asset.metadata?.landType ?? asset.name).toString().toLowerCase();

  if (offerType === "plex") {
    return /plex/.test(landType) || landType === "duplex";
  }
  if (offerType === "apartment") {
    if (!(landType === "apartment" || /unit/.test(landType))) return false;
    const minUnits = typeof card.lowestUnit === "number" ? card.lowestUnit : 0;
    const units = typeof asset.metadata?.units === "number" ? asset.metadata.units : 0;
    return units >= minUnits;
  }
  if (offerType === "limited") {
    return landType.includes("limited");
  }
  if (offerType === "business") {
    return asset.category === "business";
  }
  if (offerType === "widget" || offerType === "software") {
    return landType.includes(offerType);
  }
  if (offerType === "mall" || offerType === "car wash") {
    return landType.includes(offerType);
  }
  if (offerType === "krugerrands" || offerType === "1500's spanish") {
    return landType.includes(offerType.split(" ")[0]);
  }
  return landType === offerType;
};

const processOfferCard = (card: BaseCard, target: Player): OfferOutcome => {
  const outcome: OfferOutcome = { cashGain: 0, passiveDelta: 0, affectedAssets: [] };
  const cashflowOnly = typeof card.cashFlow === "number" && card.offer === undefined && card.offerPerUnit === undefined;

  target.assets = target.assets.reduce<Asset[]>((kept, asset) => {
    if (!matchesOffer(asset, card)) {
      kept.push(asset);
      return kept;
    }

    if (cashflowOnly) {
      outcome.passiveDelta += card.cashFlow as number;
      kept.push({ ...asset, cashflow: asset.cashflow + (card.cashFlow as number) });
      return kept;
    }

    const units = typeof asset.metadata?.units === "number" ? asset.metadata.units : 1;
    const salePrice = typeof card.offerPerUnit === "number" ? card.offerPerUnit * units : (typeof card.offer === "number" ? card.offer : 0);
    const mortgage = typeof asset.metadata?.mortgage === "number" ? asset.metadata.mortgage : 0;
    const net = Math.max(salePrice - mortgage, 0);
    outcome.cashGain += net;
    outcome.passiveDelta -= asset.cashflow;
    outcome.affectedAssets.push(asset.id);
    return kept;
  }, []);

  if (cashflowOnly && outcome.passiveDelta !== 0) {
    target.passiveIncome += outcome.passiveDelta;
    recalcPlayerIncome(target);
  }
  if (!cashflowOnly && outcome.cashGain > 0) {
    target.cash += outcome.cashGain;
    if (outcome.passiveDelta !== 0) {
      target.passiveIncome += outcome.passiveDelta;
      recalcPlayerIncome(target);
    }
  }

  return outcome;
};

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
          draft.turnState = "awaitCard";
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

            if (card.name) {
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
              draft.turnState = drawn ? "awaitCard" : "awaitEnd";
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
    if (state.turnState === "awaitRoll" || state.turnState === "awaitAction" || state.turnState === "awaitCard") {
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
    if (state.turnState === "awaitRoll" || state.turnState === "awaitCard" || state.turnState === "awaitCharity") return;

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
