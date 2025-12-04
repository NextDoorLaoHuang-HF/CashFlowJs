import type { ExpenseBreakdown, IncomeBreakdown, ScenarioDefinition } from '@/state/types';

export interface FinanceSnapshot {
  income: IncomeBreakdown;
  expenses: ExpenseBreakdown;
  payday: number;
  passiveIncome: number;
}

const CHILD_COST = 0;

export function calculateExpenses(
  scenario: ScenarioDefinition,
  overrides?: Partial<ExpenseBreakdown>
): ExpenseBreakdown {
  const snapshot: ExpenseBreakdown = {
    taxes: scenario.expenses.taxes,
    mortgage: scenario.expenses.mortgage,
    car: scenario.expenses.car,
    creditCard: scenario.expenses.creditCard,
    retail: scenario.expenses.retail,
    other: scenario.expenses.other,
    child: CHILD_COST,
    total: 0,
    ...overrides,
  };

  const total =
    snapshot.taxes +
    snapshot.mortgage +
    snapshot.car +
    snapshot.creditCard +
    snapshot.retail +
    snapshot.other +
    snapshot.child;

  return {
    ...snapshot,
    total,
  };
}

export function calculateIncome(
  scenario: ScenarioDefinition,
  passiveIncome = 0,
  overrides?: Partial<IncomeBreakdown>
): IncomeBreakdown {
  return {
    salary: scenario.salary,
    passive: passiveIncome,
    other: 0,
    ...overrides,
  };
}

export function calculatePayday(income: IncomeBreakdown, expenses: ExpenseBreakdown): number {
  return income.salary + income.passive + income.other - expenses.total;
}

export function deriveStartingCash(scenario: ScenarioDefinition, multiplier = 1): number {
  return Math.max(scenario.savings * multiplier, 0);
}

export function buildFinanceSnapshot(
  scenario: ScenarioDefinition,
  passiveIncome = 0
): FinanceSnapshot {
  const income = calculateIncome(scenario, passiveIncome);
  const expenses = calculateExpenses(scenario);
  const payday = calculatePayday(income, expenses);
  return {
    income,
    expenses,
    payday,
    passiveIncome,
  };
}
