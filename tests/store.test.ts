import { beforeEach, describe, expect, it } from 'vitest';
import { rootStore, resetGame, setPlayerLimit, startRatRace, updatePlayer } from '@/state/store';

describe('root store', () => {
  beforeEach(() => {
    resetGame();
  });

  it('resizes player slots when the limit changes', () => {
    setPlayerLimit(2);
    expect(rootStore.getState().players).toHaveLength(2);
    setPlayerLimit(5);
    expect(rootStore.getState().players).toHaveLength(5);
  });

  it('auto-assigns scenarios to new player slots', () => {
    const players = rootStore.getState().players;
    expect(players.every((player) => player.scenarioId)).toBe(true);
  });

  it('allows starting the rat race without manual configuration', () => {
    expect(() => startRatRace()).not.toThrow();
    const state = rootStore.getState();
    expect(state.phase).toBe('ratRace');
    expect(state.turn.order.length).toBeGreaterThan(0);
  });

  it('throws an error if all players are cleared manually', () => {
    const players = rootStore.getState().players;
    players.forEach((player) => updatePlayer(player.slot, { scenarioId: null }));
    expect(() => startRatRace()).toThrow();
  });
});
