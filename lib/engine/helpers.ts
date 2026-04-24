import type { Asset, JointVenture, Player, PlayerLoan } from "../types";
import { shuffleWithRng, type ShuffledResult } from "./rng";

export const roundToNearestThousand = (value: number): number => Math.ceil(value / 1000) * 1000;

export type BankLoanResult = { principal: number; payment: number } | null;

export const applyBankLoan = (player: Player, amountNeeded: number): BankLoanResult => {
  if (player.track === "fastTrack") {
    return null;
  }
  const principal = roundToNearestThousand(amountNeeded);
  if (principal <= 0) return null;
  const payment = Math.round(principal * 0.1);
  player.cash += principal;
  player.liabilities.push({
    id: `bank-loan-${crypto.randomUUID()}`,
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

export const ensureFunds = (player: Player, cost: number): FinancingOutcome => {
  const required = Math.max(0, Math.abs(cost));
  if (required <= 0) return { ok: true };
  if (player.cash >= required) return { ok: true };
  const shortfall = required - player.cash;
  const loan = applyBankLoan(player, shortfall);
  if (loan) return { ok: true, loan };
  return { ok: false, shortfall };
};

export const recalcPlayerIncome = (player: Player) => {
  const salary = player.track === "fastTrack" ? 0 : player.scenario.salary;
  player.totalIncome = salary + player.passiveIncome;
  player.payday = player.totalIncome - player.totalExpenses;
  if (player.track === "ratRace" && !player.fastTrackUnlocked && player.totalExpenses > 0 && player.passiveIncome >= player.totalExpenses) {
    player.fastTrackUnlocked = true;
  }
};

export const hasReachedFastTrackGoal = (player: Player): boolean =>
  player.track === "fastTrack" && typeof player.fastTrackTarget === "number" && player.passiveIncome >= player.fastTrackTarget;

export const calculateVisitedSquares = (start: number, steps: number, boardLength: number): number[] => {
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

export const buildTurnOrder = (players: Player[], startPlayerId: string): Player[] => {
  const activePlayers = players.filter((player) => player.status !== "bankrupt");
  const startIndex = activePlayers.findIndex((player) => player.id === startPlayerId);
  if (startIndex < 0) {
    return activePlayers;
  }
  return [...activePlayers.slice(startIndex), ...activePlayers.slice(0, startIndex)];
};

export const applyVentureCashflow = (players: Player[], venture: JointVenture, totalDelta: number) => {
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

export const clonePlayerSnapshot = (player: Player): Player => ({
  ...player,
  assets: player.assets.map((asset) => ({ ...asset, metadata: asset.metadata ? { ...asset.metadata } : undefined })),
  liabilities: player.liabilities.map((liability) => ({ ...liability, metadata: liability.metadata ? { ...liability.metadata } : undefined }))
});

export const clonePlayersSnapshot = (players: Player[]): Player[] => players.map(clonePlayerSnapshot);

export const cloneLoansSnapshot = (loans: PlayerLoan[]): PlayerLoan[] => loans.map((loan) => ({ ...loan }));

export const cloneVenturesSnapshot = (ventures: JointVenture[]): JointVenture[] =>
  ventures.map((venture) => ({
    ...venture,
    participants: venture.participants.map((participant) => ({ ...participant }))
  }));

export const captureFastTrackStatus = (players: Player[]): Record<string, boolean> =>
  players.reduce<Record<string, boolean>>((acc, player) => {
    acc[player.id] = player.fastTrackUnlocked;
    return acc;
  }, {});

export const detectFastTrackUnlocks = (
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
