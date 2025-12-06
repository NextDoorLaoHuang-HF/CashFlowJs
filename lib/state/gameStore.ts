import { produce } from "immer";
import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { boardSquares } from "../data/board";
import { cards } from "../data/cards";
import { dreams, scenarios } from "../data/scenarios";
import { t } from "../i18n";
import type {
  Asset,
  BaseCard,
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
  initGame: (payload: SetupPayload) => void;
  addLog: (message: string, payload?: Record<string, unknown>, playerId?: string) => void;
  rollDice: () => void;
  drawCard: (deck: DeckKey) => void;
  clearCard: () => void;
  completeDeal: (opts: { card: BaseCard; playerId?: string; cashflowDelta?: number; cashDelta: number }) => void;
  resolvePayday: (playerId: string) => void;
  nextPlayer: () => void;
  setLocale: (locale: Locale) => void;
  addJointVenture: (venture: Omit<JointVenture, "id" | "createdAt" | "status">) => void;
  updateJointVenture: (id: string, updates: Partial<JointVenture>) => void;
  addLoan: (loan: Omit<PlayerLoan, "id" | "status" | "remaining">) => void;
  repayLoan: (loanId: string, amount: number) => void;
  clearLog: () => void;
  recordLLMAction: (playerId: string, action: LLMAction) => void;
};

const defaultSettings: GameSettings = {
  locale: "en",
  startingSavingsMode: "normal",
  enablePreferredStock: true,
  enableBigDeals: true,
  enableSmallDeals: true,
  enableLLMPlayers: true
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
      player.payday += share;
    }
  });
};

const buildPlayer = (setup: SetupPlayer): Player => {
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
    cash: scenario.savings,
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
    fastTrackUnlocked: false
  };
};

export const useGameStore = create<GameStore>((set, get) => ({
  phase: "setup",
  board: boardSquares,
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
  initGame: ({ players: playerSetups, settings }) => {
    const players = playerSetups.map(buildPlayer);
    set(
      produce<GameStore>((state) => {
        state.players = players;
        state.currentPlayerId = players[0]?.id ?? null;
        state.phase = players.length > 0 ? "ratRace" : "setup";
        state.turn = 1;
        state.logs = [];
        state.selectedCard = undefined;
        state.dice = undefined;
        state.decks.smallDeals = shuffle(cloneDeck(cards.smallDeal));
        state.decks.bigDeals = shuffle(cloneDeck(cards.bigDeal));
        state.decks.offers = shuffle(cloneDeck(cards.offer));
        state.decks.doodads = shuffle(cloneDeck(cards.doodad));
        state.discard = { smallDeals: [], bigDeals: [], offers: [], doodads: [] };
        state.settings = { ...state.settings, ...settings };
        state.history = [{ turn: 1, players: players.map((p) => ({ ...p })) }];
      })
    );
    get().addLog("Game initialized");
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

    if (player.skipTurns > 0) {
      set(
        produce<GameStore>((draft) => {
          const current = draft.players.find((p) => p.id === player.id);
          if (current) {
            current.skipTurns -= 1;
          }
        })
      );
      get().addLog("Player skips turn", { reason: "Downsized" }, player.id);
      get().nextPlayer();
      return;
    }

    const dice: DiceRoll = {
      dice: [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)],
      total: 0
    };
    dice.total = dice.dice[0] + dice.dice[1];

    set({ dice });

    set(
      produce<GameStore>((draft) => {
        const current = draft.players.find((p) => p.id === player.id);
        if (!current) return;
        current.position = (current.position + dice.total) % draft.board.length;
      })
    );

    const newPlayer = get().players.find((p) => p.id === player.id);
    if (newPlayer) {
      get().addLog("Player rolled", { dice, position: newPlayer.position }, newPlayer.id);
      get().resolvePayday(newPlayer.id);
    }
  },
  drawCard: (deck) => {
    set(
      produce<GameStore>((draft) => {
        if (draft.decks[deck].length === 0) {
          draft.decks[deck] = shuffle(draft.discard[deck]);
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
            target.payday += normalizedCashflow;
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
    get().addLog(
      "Deal completed",
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
  resolvePayday: (playerId) => {
    set(
      produce<GameStore>((draft) => {
        const target = draft.players.find((p) => p.id === playerId);
        if (!target) return;
        const boardEntry = draft.board[target.position];
        if (!boardEntry) return;
        switch (boardEntry.type) {
          case "PAYCHECK":
            target.cash += target.payday;
            break;
          case "LIABILITY":
            target.cash -= Math.max(target.payday * 0.25, 200);
            break;
          case "CHILD":
            target.children += 1;
            target.childExpense += 400;
            target.totalExpenses += 400;
            target.payday -= 400;
            break;
          case "CHARITY":
            target.charityTurns = 3;
            break;
          case "DOWNSIZE":
            target.skipTurns = 2;
            break;
          default:
            break;
        }
      })
    );
    const state = get();
    const boardEntry = state.board[state.players.find((p) => p.id === playerId)?.position ?? 0];
    if (boardEntry) {
      state.addLog(`Board:${boardEntry.type.toLowerCase()}`, { square: boardEntry }, playerId);
    }
  },
  nextPlayer: () => {
    const state = get();
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
    get().addLog("Joint venture created", {
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
    const venture = get().ventures.find((v) => v.id === id);
    if (venture) {
      get().addLog("Joint venture updated", { ventureId: venture.id, status: venture.status, cashflowImpact: venture.cashflowImpact });
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
      get().addLog("Loan created", {
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
      get().addLog("Loan repaid", { loanId, amount: repaymentAmount, remaining: remainingBalance });
    }
  },
  clearLog: () => {
    set({ logs: [] });
  },
  recordLLMAction: (playerId, action) => {
    get().addLog("LLM action", { action }, playerId);
  }
}));
