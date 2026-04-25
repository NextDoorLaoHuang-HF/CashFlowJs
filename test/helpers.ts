import type { GameEngineState, Player, GameSettings, Asset, Liability } from "@/lib/types";
import type { DeckKey } from "@/lib/engine/types";

export const createTestScenario = (): Player["scenario"] => ({
  id: "janitor",
  label: "Janitor",
  salary: 1600,
  savings: 560,
  taxes: 280,
  mortgagePayment: 200,
  carPayment: 60,
  creditCardPayment: 60,
  retailPayment: 50,
  otherExpenses: 300,
  mortgage: 20000,
  carLoan: 4000,
  creditDebt: 2000,
  retailDebt: 1000
});

export const createTestPlayer = (overrides?: Partial<Player>): Player => {
  const scenario = createTestScenario();
  const expenses =
    scenario.taxes +
    scenario.mortgagePayment +
    scenario.carPayment +
    scenario.creditCardPayment +
    scenario.retailPayment +
    scenario.otherExpenses;

  return {
    id: "p1",
    name: "Test Player",
    color: "#ff0000",
    scenario,
    cash: 1000,
    passiveIncome: 0,
    totalIncome: scenario.salary,
    totalExpenses: expenses,
    payday: scenario.salary - expenses,
    position: 0,
    assets: [],
    liabilities: [],
    charityTurns: 0,
    children: 0,
    childExpense: 0,
    skipTurns: 0,
    fastTrackUnlocked: false,
    status: "active",
    track: "ratRace",
    ...overrides
  };
};

export const createTestSettings = (overrides?: Partial<GameSettings>): GameSettings => ({
  locale: "zh",
  startingSavingsMode: "normal",
  enablePreferredStock: true,
  enableBigDeals: true,
  enableSmallDeals: true,
  enableLLMPlayers: false,
  useCashflowDice: true,
  ...overrides
});

export const createTestState = (overrides?: Partial<GameEngineState>): GameEngineState => {
  const player = createTestPlayer();
  const settings = createTestSettings();

  return {
    phase: "ratRace",
    players: [player],
    currentPlayerId: player.id,
    turnState: "awaitRoll",
    rngSeed: 12345,
    rngState: 12345,
    decks: {
      smallDeals: [],
      bigDeals: [],
      offers: [],
      doodads: []
    },
    discard: { smallDeals: [], bigDeals: [], offers: [], doodads: [] },
    turn: 1,
    logs: [],
    replayFrames: [],
    ventures: [],
    loans: [],
    settings,
    history: [],
    ...overrides
  };
};

export const createTestAsset = (overrides?: Partial<Asset>): Asset => ({
  id: "asset-1",
  name: "Test Asset",
  category: "realEstate",
  cashflow: 100,
  cost: 5000,
  quantity: 1,
  metadata: {},
  ...overrides
});

export const createTestLiability = (overrides?: Partial<Liability>): Liability => ({
  id: "liability-1",
  name: "Test Loan",
  payment: 100,
  balance: 5000,
  category: "loan",
  metadata: {},
  ...overrides
});

export const createTestCard = (overrides?: Record<string, unknown>): import("@/lib/types").BaseCard => ({
  id: "card-1",
  type: "Stock",
  name: "Test Card",
  description: "A test card",
  ...overrides
});
