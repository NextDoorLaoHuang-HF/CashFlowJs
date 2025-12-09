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
  PlayerLoan
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

type GameStore = {
  phase: GamePhase;
  board: typeof boardSquares;
  fastTrackBoard: typeof fastTrackSquares;
  players: Player[];
  currentPlayerId: string | null;
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
  useCashflowDice: false
};

const deckSources: Record<DeckKey, Record<string, BaseCard>> = {
  smallDeals: cards.smallDeal as Record<string, BaseCard>,
  bigDeals: cards.bigDeal as Record<string, BaseCard>,
  offers: cards.offer as Record<string, BaseCard>,
  doodads: cards.doodad as Record<string, BaseCard>
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
  const baseDeck = cloneDeck(deckSources[deckKey]);
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

const cloneDeck = (deck: Record<string, BaseCard>): BaseCard[] =>
  Object.keys(deck).map((key) => ({
    ...deck[key],
    id: deck[key].id ?? key
  }));

const shuffle = <T,>(list: T[]): T[] => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

const deriveCardCashflow = (card: BaseCard, provided?: number): number => {
  if (typeof provided === "number") {
    return provided;
  }
  const value = getNumericField(card, ["cashFlow", "cashflow", "dividend", "payout", "savings"]);
  return typeof value === "number" ? value : 0;
};

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

const recalcPlayerIncome = (player: Player) => {
  player.totalIncome = player.scenario.salary + player.passiveIncome;
  player.payday = player.totalIncome - player.totalExpenses;
  if (!player.fastTrackUnlocked && player.totalExpenses > 0 && player.passiveIncome >= player.totalExpenses) {
    player.fastTrackUnlocked = true;
  }
};

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

export const useGameStore = create<GameStore>((set, get) => ({
  phase: "setup",
  board: boardSquares,
  fastTrackBoard: fastTrackSquares,
  players: [],
  currentPlayerId: null,
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
  rollDice: () => {
    const state = get();
    if (!state.currentPlayerId) {
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

    if (player.skipTurns > 0) {
      set(
        produce<GameStore>((draft) => {
          const current = draft.players.find((p) => p.id === player.id);
          if (current) {
            current.skipTurns -= 1;
          }
        })
      );
      get().addLog("log.playerSkipsTurn", { reason: "Downsized" }, player.id);
      get().nextPlayer();
      return;
    }

    const previousPosition = player.position;
    const playerBoardLength = player.track === "fastTrack" ? state.fastTrackBoard.length : state.board.length;
    if (playerBoardLength === 0) {
      return;
    }
    const hasCharityBoost = player.charityTurns > 0;
    const baseDice = state.settings.useCashflowDice ? 1 : 2;
    const charityBonus = state.settings.useCashflowDice && hasCharityBoost ? 1 : 0;
    const dieCount = Math.max(1, baseDice + charityBonus);
    const diceValues = Array.from({ length: dieCount }, () => Math.ceil(Math.random() * 6));
    const total = diceValues.reduce((sum, value) => sum + value, 0);
    const dice: DiceRoll = { dice: diceValues, total };

    set(
      produce<GameStore>((draft) => {
        draft.dice = dice;
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
    if ((deck === "smallDeals" && !state.settings.enableSmallDeals) || (deck === "bigDeals" && !state.settings.enableBigDeals)) {
      return;
    }
    const pendingCharity = state.charityPrompt;
    if (pendingCharity && pendingCharity.playerId === state.currentPlayerId) {
      return;
    }
    set(
      produce<GameStore>((draft) => {
        if (draft.decks[deck].length === 0) {
          const reshuffled = shuffle(draft.discard[deck]).filter((card) => filterCardBySettings(card, draft.settings, deck));
          draft.decks[deck] = reshuffled;
          draft.discard[deck] = [];
        }
        const card = draft.decks[deck].shift();
        if (card) {
          draft.selectedCard = { ...card, deckKey: deck };
        }
      })
    );
  },
  clearCard: () => {
    set(
      produce<GameStore>((draft) => {
        if (draft.selectedCard) {
          const deckKey = (draft.selectedCard.deckKey ?? "smallDeals") as DeckKey;
          draft.discard[deckKey].push(draft.selectedCard);
          draft.selectedCard = undefined;
        }
      })
    );
  },
  completeDeal: ({ card, playerId, cashDelta, cashflowDelta }) => {
    const beforeStatus = captureFastTrackStatus(get().players);
    let recordedAsset: Asset | undefined;
    let appliedCashflow = 0;
    set(
      produce<GameStore>((draft) => {
        const target = draft.players.find((p) => p.id === (playerId ?? draft.currentPlayerId));
        if (!target) return;

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
                deck: card.deckKey
              }
            };
            target.assets.push(asset);
            recordedAsset = asset;
          }
        }
      })
    );
    detectFastTrackUnlocks(beforeStatus, get().players, (player) => get().addLog("log.fastTrackUnlocked", undefined, player.id));
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
    get().clearCard();
  },
  resolvePayday: (playerId, previousPosition = 0, stepsMoved = 0) => {
    const beforeStatus = captureFastTrackStatus(get().players);
    let pendingDeck: DeckKey | null = null;
    let paydayHits = 0;
    let paydayAward = 0;
    let childExpenseIncurred: number | undefined;
    let downsizePenalty: number | undefined;
    let charityAmount: number | undefined;
    let liabilityPenalty: number | undefined;
    let fastTrackBonus: number | undefined;
    let passiveBoost: number | undefined;
    let fastPenalty: number | undefined;
    let dreamAchieved = false;

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
          paydayHits = 0;
        }

        switch (boardEntry.type) {
          case "LIABILITY":
            liabilityPenalty = Math.max(Math.round(target.payday * 0.25), 200);
            target.cash -= liabilityPenalty;
            pendingDeck = "doodads";
            break;
          case "OFFER":
            pendingDeck = "offers";
            break;
          case "CHARITY":
            charityAmount = Math.max(Math.round(target.totalIncome * 0.1), 100);
            draft.charityPrompt = { playerId, amount: charityAmount };
            break;
          case "CHILD": {
            const expensePerChild = Math.max(Math.round(target.totalIncome * 0.056), 100);
            target.children += 1;
            target.childExpense += expensePerChild;
            target.totalExpenses += expensePerChild;
            recalcPlayerIncome(target);
            childExpenseIncurred = expensePerChild;
            break;
          }
          case "DOWNSIZE":
            downsizePenalty = target.totalExpenses;
            target.cash -= target.totalExpenses;
            target.skipTurns = Math.max(target.skipTurns, 3);
            break;
          case "FAST_PAYDAY":
            fastTrackBonus = Math.max(target.passiveIncome, target.payday) * 2;
            target.cash += fastTrackBonus;
            break;
          case "FAST_OPPORTUNITY":
            passiveBoost = Math.max(2000, Math.round(target.payday * 0.5));
            target.passiveIncome += passiveBoost;
            recalcPlayerIncome(target);
            break;
          case "FAST_DONATION":
            charityAmount = Math.max(Math.round(target.totalIncome * 0.2), 5000);
            draft.charityPrompt = { playerId, amount: charityAmount };
            break;
          case "FAST_PENALTY":
            fastPenalty = Math.max(target.totalExpenses, 3000);
            target.cash -= fastPenalty;
            break;
          case "FAST_DREAM":
            dreamAchieved = true;
            draft.phase = "finished";
            break;
          case "PAYCHECK":
          default:
            break;
        }
      })
    );
    detectFastTrackUnlocks(beforeStatus, get().players, (player) => get().addLog("log.fastTrackUnlocked", undefined, player.id));

    if (pendingDeck) {
      get().drawCard(pendingDeck);
    }

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
      if (pendingDeck) {
        payload.deck = pendingDeck;
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
      if (dreamAchieved) {
        payload.dreamAchieved = true;
      }
      state.addLog(`log.board.${boardEntry.type.toLowerCase()}`, payload, playerId);
      if (dreamAchieved) {
        state.addLog("log.fastTrack.dreamAchieved", { dream: resolvedPlayer.dream?.id }, playerId);
      }
    }
  },
  nextPlayer: () => {
    const state = get();
    if (state.charityPrompt && state.charityPrompt.playerId === state.currentPlayerId) {
      state.skipCharity();
    }
    if (state.players.length === 0) return;
    const currentIndex = state.players.findIndex((p) => p.id === state.currentPlayerId);
    const nextIndex = (currentIndex + 1) % state.players.length;
    set(
      produce<GameStore>((draft) => {
        draft.currentPlayerId = draft.players[nextIndex].id;
        draft.turn += currentIndex === state.players.length - 1 ? 1 : 0;
        draft.history.push({ turn: draft.turn, players: draft.players.map((p) => ({ ...p })) });
      })
    );
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
  clearLog: () => {
    set({ logs: [] });
  },
  recordLLMAction: (playerId, action) => {
    get().addLog("log.llmAction", { action }, playerId);
  },
  enterFastTrack: (playerId) => {
    let entered = false;
    set(
      produce<GameStore>((draft) => {
        const player = draft.players.find((p) => p.id === playerId);
        if (!player || !player.fastTrackUnlocked || player.track === "fastTrack") return;
        player.track = "fastTrack";
        player.position = 0;
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
          donationApplied = true;
        } else {
          draft.charityPrompt = undefined;
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
    const prompt = state.charityPrompt;
    if (!prompt) return;
    set({ charityPrompt: undefined });
    state.addLog("log.charity.skipped", { amount: prompt.amount }, prompt.playerId);
  }
}));
