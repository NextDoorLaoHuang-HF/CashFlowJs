import { PLAYER_COLORS, type Player, type PlayerColor } from '@/state/types';
import { buildFinanceSnapshot, deriveStartingCash } from './finance';
import { getRandomScenario, getScenarioById } from './scenarios';

export const RAT_RACE_SPACES = 24;

export function createDraftPlayer(slot: number): Player {
  const color = PLAYER_COLORS[(slot - 1) % PLAYER_COLORS.length];
  return {
    id: `player-${slot}`,
    slot,
    name: `Player ${slot}`,
    color,
    scenarioId: null,
    hasInsurance: false,
    cash: 0,
    position: 0,
    status: 'draft',
    income: { salary: 0, passive: 0, other: 0 },
    expenses: {
      taxes: 0,
      mortgage: 0,
      car: 0,
      creditCard: 0,
      retail: 0,
      other: 0,
      child: 0,
      total: 0,
    },
    loans: {
      mortgage: 0,
      car: 0,
      creditCard: 0,
      retail: 0,
      bank: 0,
    },
    passiveIncome: 0,
    payday: 0,
    lastRoll: null,
  };
}

export function ensurePlayerSlots(players: Player[], limit: number): Player[] {
  const bySlot = new Map(players.map((player) => [player.slot, player]));
  const output: Player[] = [];
  for (let slot = 1; slot <= limit; slot += 1) {
    const existing = bySlot.get(slot);
    output.push(existing ?? createRandomizedPlayer(slot));
  }
  return output;
}

export interface PlayerPatch {
  name?: string;
  color?: PlayerColor;
  scenarioId?: string | null;
  hasInsurance?: boolean;
}

export function applyPlayerPatch(player: Player, patch: PlayerPatch): Player {
  let next: Player = {
    ...player,
    ...('name' in patch && patch.name !== undefined ? { name: patch.name } : {}),
    ...('color' in patch && patch.color ? { color: patch.color } : {}),
    ...('hasInsurance' in patch && patch.hasInsurance !== undefined
      ? { hasInsurance: patch.hasInsurance }
      : {}),
  } as Player;

  if (patch.scenarioId) {
    const scenario = getScenarioById(patch.scenarioId);
    if (scenario) {
      const finance = buildFinanceSnapshot(scenario);
      next = {
        ...next,
        scenarioId: scenario.id,
        income: finance.income,
        expenses: finance.expenses,
        passiveIncome: finance.passiveIncome,
        payday: finance.payday,
        loans: {
          ...next.loans,
          mortgage: scenario.liabilities.mortgage,
          car: scenario.liabilities.car,
          creditCard: scenario.liabilities.creditCard,
          retail: scenario.liabilities.retail,
        },
        cash: deriveStartingCash(scenario),
        status: 'active',
      };
    }
  }

  if (patch.scenarioId === null) {
    const draft = createDraftPlayer(player.slot);
    next = {
      ...draft,
      id: player.id,
      name: next.name ?? draft.name,
      color: next.color ?? draft.color,
    };
  }

  return next;
}

function createRandomizedPlayer(slot: number): Player {
  const draft = createDraftPlayer(slot);
  const scenario = getRandomScenario();
  return applyPlayerPatch(draft, { scenarioId: scenario.id });
}

export function rotateColor(current: PlayerColor): PlayerColor {
  const index = PLAYER_COLORS.indexOf(current);
  if (index === -1) {
    return PLAYER_COLORS[0];
  }
  return PLAYER_COLORS[(index + 1) % PLAYER_COLORS.length];
}
