import { cards } from "../data/cards";
import type { BaseCard, GameSettings } from "../types";
import { shuffleWithRng } from "./rng";
import type { DeckKey } from "./types";

type CardDefinition = {
  id?: string;
  type?: string;
  name?: string;
  description?: string;
  text?: string;
  rule?: string;
  rule1?: string;
  rule2?: string;
  deckKey?: string;
  [key: string]: unknown;
};

const deckSources: Record<DeckKey, Record<string, CardDefinition>> = {
  smallDeals: cards.smallDeal,
  bigDeals: cards.bigDeal,
  offers: cards.offer,
  doodads: cards.doodad
};

const filterCardBySettings = (card: BaseCard, settings: GameSettings, deckKey: DeckKey): boolean => {
  if (deckKey === "smallDeals" && !settings.enablePreferredStock) {
    const typeLabel = card.type?.toLowerCase() ?? "";
    if (typeLabel.includes("preferred stock")) {
      return false;
    }
  }
  return true;
};

const cloneDeck = (deck: Record<string, CardDefinition>, deckKey: DeckKey): BaseCard[] =>
  Object.keys(deck).map((key) => {
    const card = deck[key];
    const fallbackDescription = typeof card.decription === "string" ? card.decription : "";
    const description =
      typeof card.description === "string"
        ? card.description
        : typeof card.text === "string"
          ? card.text
          : fallbackDescription;
    const name = typeof card.name === "string" ? card.name : key;
    const type = typeof card.type === "string" ? card.type : deckKey === "doodads" ? "Doodad" : "Card";
    return {
      ...card,
      id: card.id ?? key,
      deckKey,
      type,
      name,
      description
    };
  });

export const buildDeckFromSource = (
  deckKey: DeckKey,
  settings: GameSettings,
  rngState: number
): { deck: BaseCard[]; rngState: number } => {
  if (deckKey === "smallDeals" && !settings.enableSmallDeals) {
    return { deck: [], rngState };
  }
  if (deckKey === "bigDeals" && !settings.enableBigDeals) {
    return { deck: [], rngState };
  }
  const baseDeck = cloneDeck(deckSources[deckKey], deckKey);
  const filtered = baseDeck.filter((card) => filterCardBySettings(card, settings, deckKey));
  const shuffled = shuffleWithRng(filtered, rngState);
  return { deck: shuffled.list, rngState: shuffled.rngState };
};

export const drawCardFromDeck = (
  decks: Record<DeckKey, BaseCard[]>,
  discard: Record<DeckKey, BaseCard[]>,
  settings: GameSettings,
  rngState: number,
  deck: DeckKey,
  currentPlayer?: { children: number }
): { card?: BaseCard; decks: Record<DeckKey, BaseCard[]>; discard: Record<DeckKey, BaseCard[]>; rngState: number } => {
  const maxAttempts = decks[deck].length + discard[deck].length + 2;
  let attempts = 0;
  let newDecks = { ...decks };
  let newDiscard = { ...discard };
  let newRngState = rngState;

  while (attempts < maxAttempts) {
    if (newDecks[deck].length === 0) {
      const shuffled = shuffleWithRng(newDiscard[deck], newRngState);
      newRngState = shuffled.rngState;
      newDecks = { ...newDecks, [deck]: shuffled.list.filter((card) => filterCardBySettings(card, settings, deck)) };
      newDiscard = { ...newDiscard, [deck]: [] };
    }
    const card = newDecks[deck].shift();
    if (!card) {
      break;
    }
    const requiresChild = deck === "doodads" && card.child === true;
    if (requiresChild && (!currentPlayer || currentPlayer.children <= 0)) {
      newDiscard = { ...newDiscard, [deck]: [...newDiscard[deck], card] };
      attempts += 1;
      continue;
    }
    return {
      card: { ...card, deckKey: deck },
      decks: newDecks,
      discard: newDiscard,
      rngState: newRngState
    };
  }

  return { decks: newDecks, discard: newDiscard, rngState: newRngState };
};
