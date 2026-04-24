import { boardSquares, fastTrackSquares } from "../data/board";
import { getFastTrackEvent } from "../data/fastTrackEvents";
import { t } from "../i18n";
import type { BaseCard, GameLogEntry, GameReplayFrame, GameSettings, Player } from "../types";
import { buildDeckFromSource, drawCardFromDeck } from "./deck";
import {
  applyBankLoan,
  applyVentureCashflow,
  buildTurnOrder,
  calculateVisitedSquares,
  captureFastTrackStatus,
  cloneLoansSnapshot,
  clonePlayersSnapshot,
  cloneVenturesSnapshot,
  detectFastTrackUnlocks,
  ensureFunds,
  hasReachedFastTrackGoal,
  recalcPlayerIncome
} from "./helpers";
import { createRngSeed, nextRngIntInclusive } from "./rng";
import type { DeckKey, GameAction, GameEngineState, MarketSession } from "./types";
import { buildCardPreview, canPassCard, deriveAssetCost, deriveCardCashflow, derivePrimaryAction, getDeckKey, inferAssetCategory } from "./cardHelpers";
import { buildPlayer, type SetupPlayer } from "./player";
import { cardMentionsEveryone, getAssetAvailableQuantity, getStockSplitKind, isOfferForcedLimitedSaleCard, isOfferImproveCard, isOfferSellCard, isStockSplitEventCard, isTradeableSecurityCard, matchesOffer } from "../state/marketRules";
import type { Asset } from "../types";

// ---- Logging helpers ----

export type LogEntry = GameLogEntry;

export type ApplyResult = {
  state: GameEngineState;
  logs: LogEntry[];
  frames: GameReplayFrame[];
};

type MutableResult = {
  state: GameEngineState;
  logs: LogEntry[];
  frames: GameReplayFrame[];
};

function addLog(
  result: MutableResult,
  message: string,
  payload?: Record<string, unknown>,
  playerId?: string
): LogEntry {
  const entry: GameLogEntry = {
    id: crypto.randomUUID(),
    message,
    payload,
    playerId,
    phase: result.state.phase,
    turn: result.state.turn,
    timestamp: new Date().toISOString(),
    localeMessage: t(result.state.settings.locale, message)
  };
  const frame: GameReplayFrame = {
    logId: entry.id,
    turn: entry.turn,
    phase: entry.phase,
    timestamp: entry.timestamp,
    currentPlayerId: result.state.currentPlayerId,
    players: clonePlayersSnapshot(result.state.players),
    loans: cloneLoansSnapshot(result.state.loans),
    ventures: cloneVenturesSnapshot(result.state.ventures)
  };
  result.logs.push(entry);
  result.frames.push(frame);
  return entry;
}

function copyState(state: GameEngineState): GameEngineState {
  return {
    ...state,
    players: clonePlayersSnapshot(state.players),
    decks: {
      smallDeals: [...state.decks.smallDeals],
      bigDeals: [...state.decks.bigDeals],
      offers: [...state.decks.offers],
      doodads: [...state.decks.doodads]
    },
    discard: {
      smallDeals: [...state.discard.smallDeals],
      bigDeals: [...state.discard.bigDeals],
      offers: [...state.discard.offers],
      doodads: [...state.discard.doodads]
    },
    ventures: cloneVenturesSnapshot(state.ventures),
    loans: cloneLoansSnapshot(state.loans),
    logs: [...state.logs],
    replayFrames: [...state.replayFrames],
    history: state.history.map((h) => ({ turn: h.turn, players: clonePlayersSnapshot(h.players) }))
  };
}

// ---- initGame ----

export function initGame(
  playerSetups: { name: string; color: string; scenarioId: string; dreamId: string; isLLM?: boolean; llmModel?: string; llmPersona?: string }[],
  settings?: Partial<GameSettings>
): MutableResult {
  const defaultSettings: GameSettings = {
    locale: "zh",
    startingSavingsMode: "normal",
    enablePreferredStock: true,
    enableBigDeals: true,
    enableSmallDeals: true,
    enableLLMPlayers: true,
    useCashflowDice: true
  };
  const mergedSettings = { ...defaultSettings, ...settings };

  if (!mergedSettings.enableSmallDeals && !mergedSettings.enableBigDeals) {
    throw new Error("Invalid game settings: at least one deal deck must remain enabled.");
  }

  const players = playerSetups.map((setup) => buildPlayer(setup, mergedSettings));

  const rngSeed = createRngSeed();
  let rngState = rngSeed;

  const smallDeals = buildDeckFromSource("smallDeals", mergedSettings, rngState);
  rngState = smallDeals.rngState;
  const bigDeals = buildDeckFromSource("bigDeals", mergedSettings, rngState);
  rngState = bigDeals.rngState;
  const offers = buildDeckFromSource("offers", mergedSettings, rngState);
  rngState = offers.rngState;
  const doodads = buildDeckFromSource("doodads", mergedSettings, rngState);
  rngState = doodads.rngState;

  const state: GameEngineState = {
    phase: players.length > 0 ? "ratRace" : "setup",
    players,
    currentPlayerId: players[0]?.id ?? null,
    turnState: "awaitRoll",
    rngSeed,
    rngState,
    decks: {
      smallDeals: smallDeals.deck,
      bigDeals: bigDeals.deck,
      offers: offers.deck,
      doodads: doodads.deck
    },
    discard: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
    turn: 1,
    logs: [],
    replayFrames: [],
    ventures: [],
    loans: [],
    settings: mergedSettings,
    history: [{ turn: 1, players: clonePlayersSnapshot(players) }]
  };

  const result: MutableResult = { state, logs: [], frames: [] };

  addLog(result, "log.gameInitialized", {
    rngSeed,
    settings: mergedSettings,
    players: players.map((p) => ({
      id: p.id, name: p.name, color: p.color, scenarioId: p.scenario.id,
      dreamId: p.dream?.id, cash: p.cash, passiveIncome: p.passiveIncome,
      totalIncome: p.totalIncome, totalExpenses: p.totalExpenses,
      payday: p.payday, position: p.position, track: p.track, isLLM: p.isLLM
    })),
    decks: {
      smallDeals: smallDeals.deck.map((c) => c.id),
      bigDeals: bigDeals.deck.map((c) => c.id),
      offers: offers.deck.map((c) => c.id),
      doodads: doodads.deck.map((c) => c.id)
    }
  });

  beginTurn(result);
  return result;
}

// ---- beginTurn ----

export function beginTurn(result: MutableResult): void {
  const maxIterations = Math.max(1, result.state.players.length) * 10;
  let iterations = 0;

  while (iterations < maxIterations) {
    const state = result.state;
    if (state.phase === "setup" || state.phase === "finished") return;
    if (!state.currentPlayerId || state.players.length === 0) return;

    const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
    if (!currentPlayer) return;

    // Reset transient state
    state.dice = undefined;
    discardSelectedCard(state);
    state.charityPrompt = undefined;
    state.liquidationSession = undefined;
    state.turnState = "awaitRoll";

    if (currentPlayer.skipTurns <= 0) {
      return;
    }

    currentPlayer.skipTurns -= 1;
    addLog(result, "log.playerSkipsTurn", { reason: "Downsized" }, state.currentPlayerId);
    advanceToNextPlayer(result);
    iterations += 1;
  }
}

// ---- advanceToNextPlayer ----

export function advanceToNextPlayer(result: MutableResult): void {
  const state = result.state;
  if (!state.currentPlayerId || state.players.length === 0) return;

  const currentIndex = state.players.findIndex((p) => p.id === state.currentPlayerId);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  let nextIndex: number | null = null;
  let wrapped = false;

  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = (safeCurrentIndex + offset) % state.players.length;
    const candidatePlayer = state.players[candidate];
    if (candidatePlayer && candidatePlayer.status !== "bankrupt") {
      nextIndex = candidate;
      wrapped = safeCurrentIndex + offset >= state.players.length;
      break;
    }
  }

  if (nextIndex === null) {
    state.phase = "finished";
    state.currentPlayerId = null;
    state.turnState = "awaitEnd";
    return;
  }

  discardSelectedCard(state);
  state.charityPrompt = undefined;
  state.liquidationSession = undefined;
  state.dice = undefined;

  state.currentPlayerId = state.players[nextIndex].id;
  if (wrapped) {
    state.turn += 1;
  }
  state.turnState = "awaitRoll";
  state.history.push({ turn: state.turn, players: clonePlayersSnapshot(state.players) });
}

// ---- discardSelectedCard ----

function discardSelectedCard(state: GameEngineState) {
  const card = state.selectedCard;
  if (!card) return;
  const deckKey = card.deckKey as DeckKey;
  if (deckKey === "smallDeals" || deckKey === "bigDeals" || deckKey === "offers" || deckKey === "doodads") {
    state.discard[deckKey].push(card);
  }
  state.selectedCard = undefined;
  state.marketSession = undefined;
}

// ---- rollDice ----

export function rollDice(result: MutableResult): void {
  const state = result.state;
  if (state.turnState !== "awaitRoll") return;
  if (!state.currentPlayerId) return;

  const player = state.players.find((p) => p.id === state.currentPlayerId);
  if (!player) return;

  const useCashflowDice = state.settings.useCashflowDice;
  const dieCount = useCashflowDice ? 2 : 1;
  const dice: number[] = [];
  let rngState = state.rngState;

  for (let i = 0; i < dieCount; i++) {
    const roll = nextRngIntInclusive(rngState, 1, 6);
    rngState = roll.rngState;
    dice.push(roll.value);
  }

  const total = dice.reduce((sum, d) => sum + d, 0);
  state.dice = { dice, total };
  state.rngState = rngState;

  addLog(result, "log.diceRolled", { dice, total }, state.currentPlayerId);

  if (player.track === "fastTrack") {
    resolveFastTrackMove(result, total);
  } else {
    resolveRatRaceMove(result, total);
  }
}

// ---- resolveRatRaceMove ----

function resolveRatRaceMove(result: MutableResult, steps: number): void {
  const state = result.state;
  const playerId = state.currentPlayerId;
  if (!playerId) return;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  const previousPosition = player.position;
  const boardLength = boardSquares.length;
  const visitedSquares = calculateVisitedSquares(previousPosition, steps, boardLength);
  const newPosition = visitedSquares[visitedSquares.length - 1] ?? previousPosition;

  // Check if passed Payday
  const passedPayday = visitedSquares.includes(0) && previousPosition !== 0;

  player.position = newPosition;

  const square = boardSquares[newPosition];

  if (square.type === "PAYCHECK" || passedPayday) {
    resolvePayday(result, playerId, previousPosition, steps);
  }

  if (square.type === "OPPORTUNITY") {
    state.turnState = "awaitAction";
    addLog(result, "log.landed.opportunity", { position: newPosition, squareType: square.type }, playerId);
  } else if (square.type === "LIABILITY") {
    state.turnState = "awaitCard";
    drawCard(result, "doodads");
  } else if (square.type === "OFFER") {
    state.turnState = "awaitCard";
    drawCard(result, "offers");
  } else if (square.type === "CHARITY") {
    state.turnState = "awaitCharity";
    const charityAmount = Math.round(player.totalIncome * 0.1);
    state.charityPrompt = { playerId, amount: charityAmount };
    addLog(result, "log.landed.charity", { position: newPosition, amount: charityAmount }, playerId);
  } else if (square.type === "CHILD") {
    player.children += 1;
    const childExpense = Math.max(Math.round(player.scenario.salary * 0.056), 100);
    player.childExpense += childExpense;
    player.totalExpenses += childExpense;
    recalcPlayerIncome(player);
    addLog(result, "log.landed.child", { position: newPosition, children: player.children, childExpense }, playerId);
    state.turnState = "awaitEnd";
  } else if (square.type === "DOWNSIZE") {
    player.skipTurns += 1;
    // Pay expenses immediately
    const expense = player.totalExpenses;
    const financing = ensureFunds(player, expense);
    if (financing.ok) {
      player.cash -= expense;
      if (financing.loan) {
        addLog(result, "log.bank.loanIssued", { principal: financing.loan.principal, payment: financing.loan.payment }, playerId);
      }
      addLog(result, "log.landed.downsize", { position: newPosition, expenses: expense }, playerId);
    } else {
      // Bankruptcy handling would go here
      addLog(result, "log.bankruptcy", { reason: "downsize" }, playerId);
    }
    state.turnState = "awaitEnd";
  } else {
    state.turnState = "awaitEnd";
    addLog(result, "log.landed.generic", { position: newPosition, squareType: square.type }, playerId);
  }
}

// ---- resolvePayday ----

function resolvePayday(result: MutableResult, playerId: string, previousPosition: number, stepsMoved: number): void {
  const state = result.state;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  const payday = player.payday;
  player.cash += payday;

  // Deduct loan payments
  let loanPayments = 0;
  player.liabilities.forEach((liability) => {
    if (liability.balance > 0 && liability.payment > 0) {
      player.cash -= liability.payment;
      liability.balance -= liability.payment;
      loanPayments += liability.payment;
    }
  });

  // Joint venture payouts
  state.ventures.forEach((venture) => {
    if (venture.status === "active") {
      applyVentureCashflow(state.players, venture, venture.cashflowImpact);
    }
  });

  addLog(result, "log.payday", {
    previousPosition,
    stepsMoved,
    payday,
    loanPayments,
    cash: player.cash
  }, playerId);
}

// ---- resolveFastTrackMove ----

function resolveFastTrackMove(result: MutableResult, steps: number): void {
  const state = result.state;
  const playerId = state.currentPlayerId;
  if (!playerId) return;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  const previousPosition = player.position;
  const boardLength = fastTrackSquares.length;
  const visitedSquares = calculateVisitedSquares(previousPosition, steps, boardLength);
  const newPosition = visitedSquares[visitedSquares.length - 1] ?? previousPosition;

  player.position = newPosition;

  const square = fastTrackSquares[newPosition];

  if (square.type === "FAST_PAYDAY") {
    // Fast track payday
    const payday = 100000; // Simplified
    player.cash += payday;
    addLog(result, "log.fastTrack.payday", { position: newPosition, payday }, playerId);
  } else if (square.type === "FAST_OPPORTUNITY") {
    state.turnState = "awaitCard";
    const event = getFastTrackEvent(newPosition);
    if (event) {
      const params = event.params;
      const title = typeof params?.title === "string" ? params.title : "Fast Track Opportunity";
      const description = typeof params?.description === "string" ? params.description : "";
      const cost = typeof params?.cost === "number" && Number.isFinite(params.cost) ? Math.max(0, Math.round(params.cost)) : 0;
      const cashFlow = typeof params?.cashFlow === "number" && Number.isFinite(params.cashFlow) ? Math.round(params.cashFlow) : 0;
      const assetType = typeof params?.assetType === "string" ? params.assetType : "Business";
      state.selectedCard = {
        id: event.id ?? `ft-${newPosition + 1}`,
        type: assetType,
        name: title,
        description,
        cost,
        cashFlow,
        fastTrackEvent: {
          id: event.id,
          legacyKey: event.legacyKey,
          squareId: newPosition,
          kind: event.kind,
          cost,
          cashFlow
        },
        deckKey: "offers"
      } as BaseCard;
    }
    addLog(result, "log.fastTrack.opportunity", { position: newPosition }, playerId);
    return;
  } else if (square.type === "FAST_DONATION") {
    state.turnState = "awaitCharity";
    const charityAmount = Math.round(player.totalIncome * 0.1);
    state.charityPrompt = { playerId, amount: charityAmount };
    addLog(result, "log.landed.charity", { position: newPosition, amount: charityAmount }, playerId);
    return;
  } else if (square.type === "FAST_PENALTY") {
    // Fast track penalty
    const event = getFastTrackEvent(newPosition);
    const params = event?.params;
    const penalty = typeof params?.penalty === "number" && Number.isFinite(params.penalty) ? Math.max(0, Math.round(params.penalty)) : 0;
    if (event && penalty > 0) {
      if (player.cash >= penalty) {
        player.cash -= penalty;
        addLog(result, "log.fastTrack.doodad", { position: newPosition, penalty }, playerId);
      } else {
        // Fast track liquidation
        state.liquidationSession = {
          playerId,
          requiredCash: penalty,
          reason: { kind: "fastTrackPenalty", eventId: event.id, squareId: newPosition }
        };
        state.turnState = "awaitLiquidation";
        addLog(result, "log.liquidation.required", { requiredCash: penalty }, playerId);
        return;
      }
    }
  }

  // Check win condition
  if (hasReachedFastTrackGoal(player)) {
    state.phase = "finished";
    state.turnState = "awaitEnd";
    addLog(result, "log.fastTrack.dreamAchieved", {
      dream: player.dream?.id,
      target: player.fastTrackTarget,
      passiveIncome: player.passiveIncome
    }, playerId);
    return;
  }

  state.turnState = "awaitEnd";
}

// ---- drawCard ----

export function drawCard(result: MutableResult, deck: DeckKey): void {
  const state = result.state;
  if (state.turnState !== "awaitCard" && state.turnState !== "awaitAction") return;
  if (!state.currentPlayerId) return;

  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);

  const drawResult = drawCardFromDeck(
    state.decks,
    state.discard,
    state.settings,
    state.rngState,
    deck,
    currentPlayer
  );

  state.decks = drawResult.decks;
  state.discard = drawResult.discard;
  state.rngState = drawResult.rngState;

  if (drawResult.card) {
    state.selectedCard = drawResult.card;
    state.turnState = "awaitCard";

    const preview = buildCardPreview(drawResult.card, currentPlayer);
    addLog(result, "log.cardDrawn", {
      cardId: drawResult.card.id,
      deck,
      type: drawResult.card.type,
      title: drawResult.card.name,
      cost: preview.cost,
      cashFlow: preview.cashflow,
      canPass: preview.canPass,
      primaryAction: preview.primaryAction
    }, state.currentPlayerId);

    // Check if card triggers market session
    ensureMarketSession(state);
  } else {
    addLog(result, "log.deck.empty", { deck }, state.currentPlayerId);
    state.turnState = "awaitEnd";
  }
}

// ---- ensureMarketSession ----

function ensureMarketSession(state: GameEngineState) {
  const card = state.selectedCard;
  const currentPlayerId = state.currentPlayerId;
  if (!card || !currentPlayerId) {
    state.marketSession = undefined;
    return;
  }

  const isOfferSell = card.deckKey === "offers" && isOfferSellCard(card);
  const isSecurity = isTradeableSecurityCard(card);
  if (!isOfferSell && !isSecurity) {
    state.marketSession = undefined;
    return;
  }

  const responders = cardMentionsEveryone(card)
    ? buildTurnOrder(state.players, currentPlayerId).map((p) => p.id)
    : [currentPlayerId];

  if (responders.length === 0) {
    state.marketSession = undefined;
    return;
  }

  state.marketSession = {
    cardId: card.id,
    stage: "sell",
    responders,
    responderIndex: 0,
    sell: {},
    buyQuantity: 0
  };
}

// ---- passSelectedCard ----

export function passSelectedCard(result: MutableResult): void {
  const state = result.state;
  if (state.turnState !== "awaitCard") return;
  if (!state.selectedCard) return;

  const currentPlayerId = state.currentPlayerId;
  const preview = buildCardPreview(state.selectedCard, currentPlayerId ? state.players.find((p) => p.id === currentPlayerId) : undefined);

  if (!preview.canPass) {
    addLog(result, "log.card.passDenied", { cardId: state.selectedCard.id, deck: state.selectedCard.deckKey }, currentPlayerId ?? undefined);
    return;
  }

  addLog(result, "log.card.passed", {
    cardId: state.selectedCard.id,
    deck: state.selectedCard.deckKey,
    type: state.selectedCard.type,
    title: state.selectedCard.name,
    cost: preview.cost,
    cashFlow: preview.cashflow
  }, currentPlayerId ?? undefined);

  discardSelectedCard(state);
  state.turnState = "awaitEnd";
}

// ---- applySelectedCard ----

export function applySelectedCard(result: MutableResult): void {
  const state = result.state;
  if (state.turnState !== "awaitCard") return;
  if (!state.selectedCard) return;

  const currentPlayerId = state.currentPlayerId;
  if (!currentPlayerId) return;
  const player = state.players.find((p) => p.id === currentPlayerId);
  if (!player) return;

  const preview = buildCardPreview(state.selectedCard, player);
  const cashDelta = -preview.cost;

  // Fast track event card handling
  const fastTrackEvent = state.selectedCard.fastTrackEvent;
  if (player.track === "fastTrack" && fastTrackEvent && typeof fastTrackEvent === "object") {
    handleFastTrackCard(result, player, state.selectedCard, preview, fastTrackEvent);
    return;
  }

  // Regular card handling via completeDeal
  completeDeal(result, {
    card: state.selectedCard,
    playerId: currentPlayerId,
    cashDelta,
    cashflowDelta: preview.cashflow
  });
}

function handleFastTrackCard(
  result: MutableResult,
  player: Player,
  card: BaseCard,
  preview: { cost: number; cashflow: number; canPass: boolean; primaryAction: string },
  fastTrackEvent: unknown
): void {
  const state = result.state;
  const currentPlayerId = player.id;
  const kind = (fastTrackEvent as { kind?: unknown }).kind;

  if (kind === "rollPayout" || kind === "rollCashflow") {
    const cost = Math.max(0, preview.cost);
    if (cost > player.cash) {
      addLog(result, "log.deal.failed", {
        cardId: card.id, deck: "fastTrack", cost, cashAvailable: player.cash,
        shortfall: cost - player.cash, track: player.track
      }, currentPlayerId);
      return;
    }

    const successFacesRaw = (fastTrackEvent as { successFaces?: unknown }).successFaces;
    const successFaces = Array.isArray(successFacesRaw)
      ? successFacesRaw.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : [];

    const payout = kind === "rollPayout" && typeof (fastTrackEvent as { payout?: unknown }).payout === "number"
      ? (fastTrackEvent as { payout: number }).payout : 0;
    const successCashFlow = kind === "rollCashflow" && typeof (fastTrackEvent as { successCashFlow?: unknown }).successCashFlow === "number"
      ? (fastTrackEvent as { successCashFlow: number }).successCashFlow : 0;
    const failureCashFlow = kind === "rollCashflow" && typeof (fastTrackEvent as { failureCashFlow?: unknown }).failureCashFlow === "number"
      ? (fastTrackEvent as { failureCashFlow: number }).failureCashFlow : 0;

    const rollResult = nextRngIntInclusive(state.rngState, 1, 6);
    state.rngState = rollResult.rngState;
    const die = rollResult.value;
    const success = successFaces.length > 0 ? successFaces.includes(die) : false;

    if (player.cash < cost) return;
    player.cash -= cost;

    const payoutAwardResolved = kind === "rollPayout" && success ? Math.max(0, Math.round(payout)) : 0;
    const cashflowAwardResolved = kind === "rollCashflow"
      ? Math.max(0, Math.round(success ? successCashFlow : failureCashFlow)) : 0;

    if (payoutAwardResolved > 0) {
      player.cash += payoutAwardResolved;
    }
    if (cashflowAwardResolved !== 0) {
      player.passiveIncome += cashflowAwardResolved;
    }

    const asset: Asset = {
      id: `${card.id ?? "ft"}-${crypto.randomUUID()}`,
      name: card.name ?? "Fast Track Opportunity",
      category: inferAssetCategory(card),
      cashflow: cashflowAwardResolved,
      cost,
      metadata: {
        fastTrackEvent,
        roll: die,
        success,
        payoutAward: payoutAwardResolved || undefined
      }
    };
    player.assets.push(asset);
    recalcPlayerIncome(player);

    const eventId = (fastTrackEvent as { id?: unknown }).id;
    const legacyKey = (fastTrackEvent as { legacyKey?: unknown }).legacyKey;
    const squareId = (fastTrackEvent as { squareId?: unknown }).squareId;

    addLog(result, "log.dealCompleted", {
      cardId: card.id,
      cashDelta: -cost + payoutAwardResolved,
      cashflowDelta: cashflowAwardResolved || undefined,
      assetCategory: asset.category,
      assetCost: asset.cost,
      fastTrackEvent,
      roll: { die, success, successFaces },
      payoutAward: payoutAwardResolved || undefined,
      cost,
      eventId: typeof eventId === "string" ? eventId : undefined,
      legacyKey: typeof legacyKey === "string" ? legacyKey : undefined,
      squareId: typeof squareId === "number" && Number.isFinite(squareId) ? squareId : undefined
    }, currentPlayerId);

    discardSelectedCard(state);
    state.turnState = "awaitEnd";
  }
}

// ---- completeDeal ----

export function completeDeal(
  result: MutableResult,
  opts: { card: BaseCard; playerId?: string; cashflowDelta?: number; cashDelta: number }
): void {
  const state = result.state;
  const playerId = opts.playerId ?? state.currentPlayerId;
  if (!playerId) return;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  const card = opts.card;
  const cashDelta = opts.cashDelta;
  const cashflowDelta = opts.cashflowDelta ?? 0;

  if (cashDelta < 0) {
    const cost = Math.abs(cashDelta);
    const financing = ensureFunds(player, cost);
    if (!financing.ok) {
      addLog(result, "log.deal.failed", {
        cardId: card.id, deck: card.deckKey, cost,
        cashAvailable: player.cash, shortfall: financing.shortfall, track: player.track
      }, playerId);
      return;
    }
    if (financing.loan) {
      addLog(result, "log.bank.loanIssued", {
        principal: financing.loan.principal, payment: financing.loan.payment
      }, playerId);
    }
    player.cash -= cost;
  } else if (cashDelta > 0) {
    player.cash += cashDelta;
  }

  if (cashflowDelta !== 0) {
    player.passiveIncome += cashflowDelta;
  }

  // Create asset if applicable
  if (derivePrimaryAction(card) === "buy" && getDeckKey(card)) {
    const assetCost = Math.abs(cashDelta);
    const asset: Asset = {
      id: `${card.id}-${crypto.randomUUID()}`,
      name: card.name,
      category: inferAssetCategory(card),
      cashflow: cashflowDelta,
      cost: assetCost,
      metadata: {
        cardId: card.id,
        cardType: card.type,
        downPayment: typeof card.downPayment === "number" ? card.downPayment : undefined,
        landType: typeof card.landType === "string" ? card.landType : undefined,
        symbol: typeof card.symbol === "string" ? card.symbol : undefined,
        units: typeof card.units === "number" ? card.units : undefined,
        mortgage: typeof card.mortgage === "number" ? card.mortgage : undefined
      }
    };
    player.assets.push(asset);
  }

  recalcPlayerIncome(player);

  const beforeStatus = captureFastTrackStatus(state.players);

  addLog(result, "log.dealCompleted", {
    cardId: card.id,
    deck: card.deckKey,
    type: card.type,
    title: card.name,
    cashDelta,
    cashflowDelta: cashflowDelta || undefined,
    assetCategory: inferAssetCategory(card),
    track: player.track
  }, playerId);

  detectFastTrackUnlocks(beforeStatus, state.players, (p) => {
    addLog(result, "log.fastTrackUnlocked", undefined, p.id);
  });

  discardSelectedCard(state);
  state.turnState = "awaitEnd";
}

// ---- nextPlayer ----

export function nextPlayer(result: MutableResult): void {
  advanceToNextPlayer(result);
  beginTurn(result);
}

// ---- Main applyAction dispatcher ----

export function applyAction(state: GameEngineState, action: GameAction): ApplyResult {
  const result: MutableResult = {
    state: copyState(state),
    logs: [],
    frames: []
  };

  switch (action.type) {
    case "initGame":
      // initGame returns its own result, so we handle it differently
      return initGame(action.payload.players as unknown as SetupPlayer[], action.payload.settings);
    case "beginTurn":
      beginTurn(result);
      break;
    case "rollDice":
      rollDice(result);
      break;
    case "drawCard":
      drawCard(result, action.deck);
      break;
    case "applySelectedCard":
      applySelectedCard(result);
      break;
    case "passSelectedCard":
      passSelectedCard(result);
      break;
    case "nextPlayer":
      nextPlayer(result);
      break;
    case "donateCharity":
      donateCharity(result);
      break;
    case "skipCharity":
      skipCharity(result);
      break;
    case "enterFastTrack":
      enterFastTrack(result, action.playerId);
      break;
    case "sellLiquidationAsset":
      sellLiquidationAsset(result, action.assetId, action.quantity);
      break;
    case "finalizeLiquidation":
      finalizeLiquidation(result);
      break;
    case "resolveMarket":
      resolveMarket(result, action.payload);
      break;
    case "confirmMarketStep":
      confirmMarketStep(result);
      break;
    case "skipMarketStep":
      skipMarketStep(result);
      break;
    case "skipMarketAll":
      skipMarketAll(result);
      break;
    case "setMarketSellQuantity":
      setMarketSellQuantity(result, action.assetId, action.quantity);
      break;
    case "setMarketBuyQuantity":
      setMarketBuyQuantity(result, action.quantity);
      break;
    case "addJointVenture":
      addJointVenture(result, action.venture);
      break;
    case "addLoan":
      addLoan(result, action.loan);
      break;
    case "repayLoan":
      repayLoan(result, action.loanId, action.amount);
      break;
    case "repayBankLoan":
      repayBankLoan(result, action.liabilityId, action.amount);
      break;
    case "sellFireSaleAsset":
      sellFireSaleAsset(result, action.assetId, action.quantity);
      break;
    case "setLocale":
      result.state.settings.locale = action.locale;
      break;
    default:
      break;
  }

  return result;
}

// ---- Charity ----

export function donateCharity(result: MutableResult): void {
  const state = result.state;
  if (state.turnState !== "awaitCharity") return;
  const prompt = state.charityPrompt;
  if (!prompt) return;
  const player = state.players.find((p) => p.id === prompt.playerId);
  if (!player) return;

  if (player.cash >= prompt.amount) {
    player.cash -= prompt.amount;
    player.charityTurns = 3;
    addLog(result, "log.charity.donated", { amount: prompt.amount }, prompt.playerId);
  } else {
    addLog(result, "log.charity.failed", { amount: prompt.amount }, prompt.playerId);
  }

  state.charityPrompt = undefined;
  state.turnState = "awaitEnd";
}

export function skipCharity(result: MutableResult): void {
  const state = result.state;
  if (state.turnState !== "awaitCharity") return;
  const prompt = state.charityPrompt;
  if (!prompt) return;

  addLog(result, "log.charity.skipped", { amount: prompt.amount }, prompt.playerId);
  state.charityPrompt = undefined;
  state.turnState = "awaitEnd";
}

// ---- Fast Track ----

export function enterFastTrack(result: MutableResult, playerId: string): void {
  const state = result.state;
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.fastTrackUnlocked || player.track !== "ratRace") return;

  player.track = "fastTrack";
  player.position = 0;
  player.fastTrackTarget = player.dream?.cost ?? 50000;

  // Reset salary-based income
  recalcPlayerIncome(player);

  addLog(result, "log.fastTrack.entered", {
    target: player.fastTrackTarget,
    passiveIncome: player.passiveIncome
  }, playerId);
}

// ---- Liquidation ----

export function sellLiquidationAsset(result: MutableResult, assetId: string, quantity: number): void {
  const state = result.state;
  if (state.turnState !== "awaitLiquidation") return;
  const session = state.liquidationSession;
  if (!session) return;

  const player = state.players.find((p) => p.id === session.playerId);
  if (!player || player.track !== "fastTrack") return;

  const assetIndex = player.assets.findIndex((a) => a.id === assetId);
  if (assetIndex < 0) return;
  const asset = player.assets[assetIndex];

  const totalQty = getAssetAvailableQuantity(asset);
  const rawQty = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isFinite(rawQty)) return;
  const sellQty = Math.min(Math.max(1, Math.floor(rawQty)), totalQty);
  if (sellQty <= 0) return;

  const fraction = totalQty > 0 ? sellQty / totalQty : 1;
  const soldCost = Math.round(asset.cost * fraction);
  const soldCashflow = Math.round(asset.cashflow * fraction);
  const proceeds = Math.max(Math.round(soldCost * 0.5), 0);

  player.cash += proceeds;
  player.passiveIncome -= soldCashflow;

  if (sellQty >= totalQty) {
    player.assets.splice(assetIndex, 1);
  } else {
    player.assets[assetIndex] = {
      ...asset,
      quantity: totalQty - sellQty,
      cost: Math.max(0, asset.cost - soldCost),
      cashflow: asset.cashflow - soldCashflow
    };
  }

  recalcPlayerIncome(player);

  addLog(result, "log.liquidation.assetSold", {
    assetId,
    assetName: asset.name,
    quantity: sellQty,
    proceeds,
    cash: player.cash
  }, session.playerId);
}

export function finalizeLiquidation(result: MutableResult): void {
  const state = result.state;
  if (state.turnState !== "awaitLiquidation") return;
  const session = state.liquidationSession;
  if (!session) return;

  const player = state.players.find((p) => p.id === session.playerId);
  if (!player) return;

  if (player.cash >= session.requiredCash) {
    player.cash -= session.requiredCash;
    addLog(result, "log.liquidation.paid", {
      requiredCash: session.requiredCash,
      remainingCash: player.cash
    }, session.playerId);
  } else {
    // Bankruptcy
    player.status = "bankrupt";
    addLog(result, "log.bankruptcy", {
      reason: "liquidation",
      requiredCash: session.requiredCash,
      cashAvailable: player.cash
    }, session.playerId);
  }

  state.liquidationSession = undefined;
  state.turnState = "awaitEnd";
}

// ---- Market Session ----

type MarketSellSelectionDetail = { assetId: string; name: string; quantity: number };

const buildMarketSellSelectionDetails = (
  player: Player,
  card: BaseCard,
  selections: Record<string, number>
): MarketSellSelectionDetail[] => {
  const entries: MarketSellSelectionDetail[] = [];
  const normalizedSymbol = typeof card.symbol === "string" ? card.symbol.toLowerCase() : "";

  Object.entries(selections).forEach(([assetId, requested]) => {
    const raw = typeof requested === "number" ? requested : Number(requested);
    if (!Number.isFinite(raw)) return;
    const normalized = Math.floor(raw);
    if (normalized <= 0) return;

    const asset = player.assets.find((candidate) => candidate.id === assetId);
    if (!asset) return;

    if (card.deckKey === "offers") {
      if (!matchesOffer(asset, card)) return;
    } else if (isTradeableSecurityCard(card)) {
      if (asset.category !== "stock") return;
      const assetSymbol = asset.metadata?.symbol;
      if (typeof assetSymbol !== "string" || assetSymbol.toLowerCase() !== normalizedSymbol) return;
    } else {
      return;
    }

    const available = getAssetAvailableQuantity(asset);
    const quantity = Math.min(normalized, available);
    if (quantity <= 0) return;

    entries.push({ assetId, name: asset.name, quantity });
  });

  return entries;
};

const normalizeQuantity = (value: unknown, max: number): number => {
  if (!Number.isFinite(max) || max <= 0) return 0;
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return 0;
  const normalized = Math.floor(raw);
  if (normalized <= 0) return 0;
  return Math.min(normalized, Math.floor(max));
};

export function resolveMarket(result: MutableResult, payload?: unknown): void {
  const state = result.state;
  if (state.turnState !== "awaitMarket") return;
  if (!state.selectedCard) return;
  if (!state.currentPlayerId) return;

  const cardSnapshot = state.selectedCard;
  const currentPlayerId = state.currentPlayerId;
  const sellSelections = (payload as { sell?: Record<string, Record<string, number>> } | undefined)?.sell ?? {};
  const buyQuantity = (payload as { buyQuantity?: number } | undefined)?.buyQuantity ?? 0;

  const beforeStatus = captureFastTrackStatus(state.players);
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
  const bankLoans: Array<{ principal: number; payment: number }> = [];

  if (cardSnapshot.deckKey === "offers") {
    const kind = isOfferImproveCard(cardSnapshot)
      ? "improve"
      : isOfferForcedLimitedSaleCard(cardSnapshot)
        ? "forcedLimited"
        : isOfferSellCard(cardSnapshot)
          ? "sell"
          : "noop";

    const allowAllPlayers = kind !== "sell" || cardMentionsEveryone(cardSnapshot);
    const turnOrder = buildTurnOrder(state.players, currentPlayerId);
    const allowedPlayerIds = new Set<string>(allowAllPlayers ? turnOrder.map((p) => p.id) : [currentPlayerId]);

    turnOrder.forEach((player) => {
      if (!allowedPlayerIds.has(player.id)) return;
      let cashGained = 0;
      let passiveDelta = 0;
      let assetsSold = 0;

      if (kind === "improve") {
        const delta = typeof cardSnapshot.cashFlow === "number" ? cardSnapshot.cashFlow : 0;
        if (delta !== 0) {
          player.assets = player.assets.map((asset) => {
            if (!matchesOffer(asset, cardSnapshot)) return asset;
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
          if (!matchesOffer(asset, cardSnapshot)) {
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
          if (!matchesOffer(asset, cardSnapshot)) return;

          const available = getAssetAvailableQuantity(asset);
          const quantityToSell = normalizeQuantity(requested, available);
          if (quantityToSell <= 0) return;

          const units = typeof asset.metadata?.units === "number" ? asset.metadata.units : 1;
          const offerPerUnit = typeof cardSnapshot.offerPerUnit === "number" ? cardSnapshot.offerPerUnit : undefined;
          const offer = typeof cardSnapshot.offer === "number" ? cardSnapshot.offer : undefined;
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
            const fraction = available > 0 ? quantityToSell / available : 1;
            const soldCost = Math.round(asset.cost * fraction);
            const soldCashflow = Math.round(asset.cashflow * fraction);

            passiveDelta -= soldCashflow;

            player.assets[index] = {
              ...asset,
              quantity: available - quantityToSell,
              cost: Math.max(0, asset.cost - soldCost),
              cashflow: asset.cashflow - soldCashflow
            };
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
  } else if (isStockSplitEventCard(cardSnapshot)) {
    const symbol = typeof cardSnapshot.symbol === "string" ? cardSnapshot.symbol : "";
    const kind = getStockSplitKind(cardSnapshot);
    if (symbol && kind) {
      const normalizedSymbol = symbol.toLowerCase();
      state.players.forEach((player) => {
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
  } else if (isTradeableSecurityCard(cardSnapshot)) {
    const symbol = typeof cardSnapshot.symbol === "string" ? cardSnapshot.symbol : "";
    const price = typeof cardSnapshot.price === "number" ? cardSnapshot.price : 0;
    if (symbol && Number.isFinite(price) && price > 0) {
      const allowAllPlayers = cardMentionsEveryone(cardSnapshot);
      const normalizedSymbol = symbol.toLowerCase();
      const turnOrder = buildTurnOrder(state.players, currentPlayerId);
      const allowedPlayerIds = new Set<string>(allowAllPlayers ? turnOrder.map((p) => p.id) : [currentPlayerId]);

      // Sell first
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
            const fraction = available > 0 ? toSell / available : 1;
            const soldCost = Math.round(asset.cost * fraction);
            player.assets[index] = {
              ...asset,
              quantity: remaining,
              cashflow: nextCashflow,
              cost: Math.max(0, asset.cost - soldCost)
            };
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

      // Buy (current player only)
      const current = state.players.find((p) => p.id === currentPlayerId);
      if (current) {
        const toBuy = normalizeQuantity(buyQuantity, Number.MAX_SAFE_INTEGER);
        if (toBuy > 0) {
          const cost = price * toBuy;
          const cashAvailable = current.cash;
          const financing = ensureFunds(current, cost);
          if (financing.ok) {
            if (financing.loan) bankLoans.push(financing.loan);
            current.cash -= cost;

            const dividendPerShare = typeof cardSnapshot.dividend === "number" ? cardSnapshot.dividend : 0;
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
                id: `stock-${crypto.randomUUID()}`,
                name: cardSnapshot.name ? `${cardSnapshot.name} (${symbol})` : symbol,
                category: "stock",
                cashflow: dividendPerShare ? dividendPerShare * toBuy : 0,
                cost,
                quantity: toBuy,
                metadata: {
                  symbol,
                  securityType: cardSnapshot.type,
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
            stockTrades.push({
              playerId: current.id,
              symbol,
              price,
              soldShares: 0,
              boughtShares: 0,
              cashDelta: 0,
              dividendDelta: 0
            });
            current.cash = cashAvailable;
          }
        }
      }
    }
  }

  discardSelectedCard(state);
  state.turnState = "awaitEnd";

  detectFastTrackUnlocks(beforeStatus, state.players, (p) => {
    addLog(result, "log.fastTrackUnlocked", undefined, p.id);
  });

  bankLoans.forEach((loan) => {
    addLog(result, "log.bank.loanIssued", { principal: loan.principal, payment: loan.payment }, currentPlayerId);
  });

  if (offerOutcomes.length > 0) {
    offerOutcomes.forEach((outcome) => {
      addLog(
        result,
        "log.offerResolved",
        { cardId: cardSnapshot.id, cashGained: outcome.cashGained, passiveDelta: outcome.passiveDelta, assetsSold: outcome.assetsSold },
        outcome.playerId
      );
    });
  }

  if (stockTrades.length > 0) {
    stockTrades.forEach((trade) => {
      addLog(
        result,
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

  addLog(
    result,
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
}

export function confirmMarketStep(result: MutableResult): void {
  const state = result.state;
  if (state.turnState !== "awaitMarket") return;
  const card = state.selectedCard;
  if (!card || !state.currentPlayerId) return;
  const session = state.marketSession;
  if (!session || session.cardId !== card.id) {
    resolveMarket(result);
    return;
  }

  if (session.stage === "sell") {
    const responderId = session.responders[session.responderIndex];
    if (!responderId) return;
    const responder = state.players.find((p) => p.id === responderId);
    const perPlayer = session.sell[responderId] ?? {};
    const selections = responder ? buildMarketSellSelectionDetails(responder, card, perPlayer) : [];

    addLog(
      result,
      "log.market.sellResponse",
      {
        cardId: card.id,
        deck: card.deckKey,
        type: card.type,
        responderIndex: session.responderIndex + 1,
        responderTotal: session.responders.length,
        selections
      },
      responderId
    );

    const isLastResponder = session.responderIndex >= session.responders.length - 1;
    if (!isLastResponder) {
      if (state.marketSession) {
        state.marketSession.responderIndex += 1;
      }
      return;
    }

    if (isTradeableSecurityCard(card)) {
      if (state.marketSession) {
        state.marketSession.stage = "buy";
        state.marketSession.buyQuantity = 0;
      }
      return;
    }

    resolveMarket(result, { buyQuantity: 0, sell: session.sell });
    return;
  }

  if (session.stage === "buy") {
    const buyQty = session.buyQuantity;
    addLog(
      result,
      "log.market.buyResponse",
      {
        cardId: card.id,
        deck: card.deckKey,
        type: card.type,
        symbol: card.symbol,
        price: card.price,
        buyQuantity: buyQty
      },
      state.currentPlayerId
    );
    resolveMarket(result, { buyQuantity: buyQty, sell: session.sell });
  }
}

export function skipMarketStep(result: MutableResult): void {
  const state = result.state;
  if (state.turnState !== "awaitMarket") return;
  const cardSnapshot = state.selectedCard;
  const sessionSnapshot = state.marketSession;
  if (!cardSnapshot || !sessionSnapshot) {
    resolveMarket(result, { buyQuantity: 0, sell: {} });
    return;
  }

  if (sessionSnapshot.stage === "sell") {
    const responderId = sessionSnapshot.responders[sessionSnapshot.responderIndex];
    if (!responderId) return;
    if (state.marketSession && state.selectedCard && state.marketSession.cardId === cardSnapshot.id && state.selectedCard.id === cardSnapshot.id) {
      delete state.marketSession.sell[responderId];
    }
    confirmMarketStep(result);
    return;
  }

  if (sessionSnapshot.stage === "buy") {
    if (state.marketSession) {
      state.marketSession.buyQuantity = 0;
    }
    confirmMarketStep(result);
  }
}

export function skipMarketAll(result: MutableResult): void {
  const state = result.state;
  if (state.turnState !== "awaitMarket") return;
  const card = state.selectedCard;
  if (!card || !state.currentPlayerId) return;
  const session = state.marketSession;
  if (!session || session.cardId !== card.id) {
    resolveMarket(result, { buyQuantity: 0, sell: {} });
    return;
  }

  if (session.stage === "sell") {
    const remainingResponders = session.responders.slice(session.responderIndex);
    remainingResponders.forEach((responderId, offset) => {
      const responder = state.players.find((p) => p.id === responderId);
      const perPlayer = offset === 0 ? session.sell[responderId] ?? {} : {};
      const selections = responder ? buildMarketSellSelectionDetails(responder, card, perPlayer) : [];
      addLog(
        result,
        "log.market.sellResponse",
        {
          cardId: card.id,
          deck: card.deckKey,
          type: card.type,
          responderIndex: session.responderIndex + offset + 1,
          responderTotal: session.responders.length,
          selections,
          skippedAll: true
        },
        responderId
      );
    });
  }

  if (isTradeableSecurityCard(card)) {
    addLog(
      result,
      "log.market.buyResponse",
      {
        cardId: card.id,
        deck: card.deckKey,
        type: card.type,
        symbol: card.symbol,
        price: card.price,
        buyQuantity: 0,
        skippedAll: true
      },
      state.currentPlayerId
    );
  }

  if (state.marketSession && state.selectedCard && state.marketSession.cardId === state.selectedCard.id) {
    state.marketSession.sell = {};
    state.marketSession.buyQuantity = 0;
  }

  resolveMarket(result, { buyQuantity: 0, sell: {} });
}

export function setMarketSellQuantity(result: MutableResult, assetId: string, quantity: number): void {
  const state = result.state;
  if (state.turnState !== "awaitMarket") return;
  const cardSnapshot = state.selectedCard;
  const sessionSnapshot = state.marketSession;
  if (!cardSnapshot || !sessionSnapshot) return;
  if (sessionSnapshot.stage !== "sell") return;

  const card = state.selectedCard;
  const session = state.marketSession;
  if (!card || !session) return;
  if (card.id !== cardSnapshot.id) return;
  if (session.cardId !== card.id) return;
  if (session.stage !== "sell") return;
  const responderId = session.responders[session.responderIndex];
  if (!responderId) return;
  const responder = state.players.find((player) => player.id === responderId);
  if (!responder) return;
  const asset = responder.assets.find((candidate) => candidate.id === assetId);
  if (!asset) return;

  if (card.deckKey === "offers") {
    if (!matchesOffer(asset, card)) return;
  } else if (isTradeableSecurityCard(card)) {
    const symbol = typeof card.symbol === "string" ? card.symbol.toLowerCase() : "";
    const assetSymbol = asset.metadata?.symbol;
    if (asset.category !== "stock" || typeof assetSymbol !== "string" || assetSymbol.toLowerCase() !== symbol) return;
  } else {
    return;
  }

  const available = getAssetAvailableQuantity(asset);
  const raw = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isFinite(raw)) return;
  const normalized = Math.min(Math.max(0, Math.floor(raw)), available);

  if (!session.sell[responderId]) {
    session.sell[responderId] = {};
  }

  if (normalized <= 0) {
    delete session.sell[responderId][assetId];
    if (Object.keys(session.sell[responderId]).length === 0) {
      delete session.sell[responderId];
    }
  } else {
    session.sell[responderId][assetId] = normalized;
  }
}

export function setMarketBuyQuantity(result: MutableResult, quantity: number): void {
  const state = result.state;
  if (state.turnState !== "awaitMarket") return;
  const cardSnapshot = state.selectedCard;
  const sessionSnapshot = state.marketSession;
  if (!cardSnapshot || !sessionSnapshot) return;
  if (sessionSnapshot.stage !== "buy") return;
  if (!isTradeableSecurityCard(cardSnapshot)) return;

  const raw = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isFinite(raw)) return;
  const normalized = Math.max(0, Math.floor(raw));

  const card = state.selectedCard;
  const session = state.marketSession;
  if (!card || !session) return;
  if (card.id !== cardSnapshot.id) return;
  if (session.cardId !== card.id) return;
  if (session.stage !== "buy") return;
  if (!isTradeableSecurityCard(card)) return;
  session.buyQuantity = normalized;
}

// ---- Joint Ventures (simplified) ----

export function addJointVenture(result: MutableResult, venture: Omit<import("../types").JointVenture, "id" | "createdAt" | "status">): void {
  const state = result.state;
  const newVenture: import("../types").JointVenture = {
    ...venture,
    id: crypto.randomUUID(),
    status: "forming",
    createdAt: new Date().toISOString()
  };
  state.ventures.push(newVenture);
  addLog(result, "log.ventures.created", { ventureId: newVenture.id, name: newVenture.name });
}

// ---- Loans (simplified) ----

export function addLoan(result: MutableResult, loan: Omit<import("../types").PlayerLoan, "id" | "status" | "remaining">): void {
  const state = result.state;
  const newLoan: import("../types").PlayerLoan = {
    ...loan,
    id: crypto.randomUUID(),
    status: "active",
    remaining: loan.principal
  };
  state.loans.push(newLoan);
  addLog(result, "log.loan.created", { loanId: newLoan.id, principal: newLoan.principal });
}

export function repayLoan(result: MutableResult, loanId: string, amount: number): void {
  const state = result.state;
  const loan = state.loans.find((l) => l.id === loanId);
  if (!loan) return;
  const borrower = state.players.find((p) => p.id === loan.borrowerId);
  if (!borrower || borrower.cash < amount) return;

  borrower.cash -= amount;
  loan.remaining = Math.max(0, loan.remaining - amount);
  if (loan.remaining === 0) {
    loan.status = "repaid";
  }
  addLog(result, "log.loan.repaid", { loanId, amount, remaining: loan.remaining }, loan.borrowerId);
}

export function repayBankLoan(result: MutableResult, liabilityId: string, amount: number): void {
  const state = result.state;
  // Find the liability across all players
  for (const player of state.players) {
    const liabilityIndex = player.liabilities.findIndex((l) => l.id === liabilityId);
    if (liabilityIndex >= 0) {
      const liability = player.liabilities[liabilityIndex];
      if (!liability || player.cash < amount) continue;

      const payment = Math.min(amount, liability.balance);
      player.cash -= payment;
      liability.balance -= payment;
      player.totalExpenses -= liability.payment;

      if (liability.balance <= 0) {
        player.liabilities.splice(liabilityIndex, 1);
      }

      recalcPlayerIncome(player);
      addLog(result, "log.bank.loanRepaid", { liabilityId, amount: payment, balance: liability.balance }, player.id);
      return;
    }
  }
}

export function sellFireSaleAsset(result: MutableResult, assetId: string, quantity: number): void {
  const state = result.state;
  for (const player of state.players) {
    const assetIndex = player.assets.findIndex((a) => a.id === assetId);
    if (assetIndex >= 0) {
      const asset = player.assets[assetIndex];
      const totalQty = getAssetAvailableQuantity(asset);
      const sellQty = Math.min(Math.max(1, Math.floor(quantity)), totalQty);
      if (sellQty <= 0) continue;

      const fraction = totalQty > 0 ? sellQty / totalQty : 1;
      const soldCost = Math.round(asset.cost * fraction);
      const soldCashflow = Math.round(asset.cashflow * fraction);
      const proceeds = Math.max(Math.round(soldCost * 0.5), 0);

      player.cash += proceeds;
      player.passiveIncome -= soldCashflow;

      if (sellQty >= totalQty) {
        player.assets.splice(assetIndex, 1);
      } else {
        player.assets[assetIndex] = {
          ...asset,
          quantity: totalQty - sellQty,
          cost: Math.max(0, asset.cost - soldCost),
          cashflow: asset.cashflow - soldCashflow
        };
      }

      recalcPlayerIncome(player);
      addLog(result, "log.asset.fireSale", { assetId, assetName: asset.name, quantity: sellQty, proceeds }, player.id);
      return;
    }
  }
}

// Re-export types
export type { GameAction, GameEngineState, DeckKey };
