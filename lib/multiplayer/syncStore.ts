"use client";

import { create } from "zustand";
import type { GameEngineState } from "../engine/gameEngine";
import type { GameSettings, Player } from "../types";

type MultiplayerStore = {
  // Connection state
  roomId: string | null;
  roomCode: string | null;
  userId: string | null;
  playerSlot: number | null;
  isHost: boolean;

  // Game state (mirrored from server)
  phase: GameEngineState["phase"];
  players: Player[];
  currentPlayerId: string | null;
  turnState: GameEngineState["turnState"];
  dice: GameEngineState["dice"];
  selectedCard: GameEngineState["selectedCard"];
  marketSession: GameEngineState["marketSession"];
  liquidationSession: GameEngineState["liquidationSession"];
  charityPrompt: GameEngineState["charityPrompt"];
  turn: number;
  logs: GameEngineState["logs"];
  settings: GameSettings;

  // Version tracking for optimistic locking
  stateVersion: number;

  // Loading / error states
  isLoading: boolean;
  error: string | null;
  lastActionTimestamp: number;

  // Actions
  setRoom: (roomId: string, roomCode: string, userId: string, playerSlot: number, isHost: boolean) => void;
  clearRoom: () => void;
  syncState: (serverState: Partial<GameEngineState> & { version?: number }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markActionSent: () => void;
};

export const useMultiplayerStore = create<MultiplayerStore>((set) => ({
  roomId: null,
  roomCode: null,
  userId: null,
  playerSlot: null,
  isHost: false,

  phase: "setup",
  players: [],
  currentPlayerId: null,
  turnState: "awaitRoll",
  dice: undefined,
  selectedCard: undefined,
  marketSession: undefined,
  liquidationSession: undefined,
  charityPrompt: undefined,
  turn: 0,
  logs: [],
  settings: {
    locale: "zh",
    startingSavingsMode: "normal",
    enablePreferredStock: true,
    enableBigDeals: true,
    enableSmallDeals: true,
    enableLLMPlayers: true,
    useCashflowDice: true
  },

  stateVersion: 0,
  isLoading: false,
  error: null,
  lastActionTimestamp: 0,

  setRoom: (roomId, roomCode, userId, playerSlot, isHost) =>
    set({ roomId, roomCode, userId, playerSlot, isHost }),

  clearRoom: () =>
    set({
      roomId: null,
      roomCode: null,
      userId: null,
      playerSlot: null,
      isHost: false,
      phase: "setup",
      players: [],
      currentPlayerId: null,
      turnState: "awaitRoll",
      dice: undefined,
      selectedCard: undefined,
      marketSession: undefined,
      liquidationSession: undefined,
      charityPrompt: undefined,
      turn: 0,
      logs: [],
      error: null
    }),

  syncState: (serverState) =>
    set((state) => ({
      phase: serverState.phase ?? state.phase,
      players: serverState.players ?? state.players,
      currentPlayerId: serverState.currentPlayerId ?? state.currentPlayerId,
      turnState: serverState.turnState ?? state.turnState,
      dice: serverState.dice ?? state.dice,
      selectedCard: serverState.selectedCard ?? state.selectedCard,
      marketSession: serverState.marketSession ?? state.marketSession,
      liquidationSession: serverState.liquidationSession ?? state.liquidationSession,
      charityPrompt: serverState.charityPrompt ?? state.charityPrompt,
      turn: serverState.turn ?? state.turn,
      logs: serverState.logs ?? state.logs,
      settings: serverState.settings ?? state.settings,
      stateVersion: serverState.version ?? state.stateVersion
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  markActionSent: () => set({ lastActionTimestamp: Date.now() })
}));
