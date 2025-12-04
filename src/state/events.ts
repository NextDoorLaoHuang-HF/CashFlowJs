import mitt from 'mitt';
import type { GameEvent, GamePhase, Player, TurnState } from './types';

export type EventMap = {
  'phase:changed': GamePhase;
  'player:updated': Player;
  'turn:advanced': TurnState;
  'state:saved': { playerCount: number; round: number };
  'state:loaded': { playerCount: number; round: number };
  'log:appended': GameEvent;
};

export const events = mitt<EventMap>();
