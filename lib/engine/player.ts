import { dreams, scenarios } from "../data/scenarios";
import type { GameSettings, Player } from "../types";
import { recalcPlayerIncome } from "./helpers";

export type SetupPlayer = {
  name: string;
  color: string;
  scenarioId: string;
  dreamId: string;
  isLLM?: boolean;
  llmModel?: string;
  llmPersona?: string;
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

export const buildPlayer = (setup: SetupPlayer, settings: GameSettings): Player => {
  const scenario = scenarios.find((sc) => sc.id === setup.scenarioId) ?? scenarios[0];
  const dream = dreams.find((d) => d.id === setup.dreamId);
  const expenses =
    scenario.taxes +
    scenario.mortgagePayment +
    scenario.carPayment +
    scenario.creditCardPayment +
    scenario.retailPayment +
    scenario.otherExpenses;

  const player: Player = {
    id: crypto.randomUUID(),
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
    status: "active",
    track: "ratRace"
  };

  recalcPlayerIncome(player);
  return player;
};
