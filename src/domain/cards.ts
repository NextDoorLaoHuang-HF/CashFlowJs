import type { CardDefinition, DeckState } from '@/state/types';

function shuffle<T>(items: T[]): T[] {
  const clone = items.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

const SMALL_DEAL_SEED: CardDefinition[] = [
  {
    id: 'gro4us-30',
    name: 'GRO4US Fund',
    kind: 'mutual',
    deck: 'small',
    description: 'Market upswing drives the fund north.',
    rule: 'Only you may buy units at this price.',
    price: 30,
  },
  {
    id: 'gro4us-10',
    name: 'GRO4US Fund',
    kind: 'mutual',
    deck: 'small',
    description: 'Weak earnings reduce the fund value.',
    rule: 'Only you may buy units at this price.',
    price: 10,
  },
  {
    id: 'myt4u-20',
    name: 'MYT4U Electronics',
    kind: 'stock',
    deck: 'small',
    description: 'Fast growing seller of home electronics headed by 32 year old Harvard grad.',
    rule: 'Only you may buy as many shares as you want.',
    price: 20,
  },
  {
    id: 'myt4u-05',
    name: 'MYT4U Electronics',
    kind: 'stock',
    deck: 'small',
    description: 'Trade war panic leads to record low share price.',
    rule: 'Only you may buy as many shares as you want.',
    price: 5,
  },
  {
    id: 'ok4u-40',
    name: 'OK4U Drug Co.',
    kind: 'stock',
    deck: 'small',
    description: 'Market strength leads to high share price.',
    rule: 'Only you may buy as many shares as you want.',
    price: 40,
  },
];

const BIG_DEAL_SEED: CardDefinition[] = [
  {
    id: '8-plex',
    name: '8-Plex Rental',
    kind: 'real-estate',
    deck: 'big',
    description: 'Turnkey rental property in an up-and-coming neighborhood.',
    rule: 'Requires 20% down payment; generates monthly cashflow.',
    price: 275000,
    cashflow: 1500,
  },
  {
    id: 'car-wash',
    name: 'Express Car Wash',
    kind: 'business',
    deck: 'big',
    description: 'Existing owner wants to retire and sell their car wash.',
    rule: 'Finance via bank loan; repay with passive income.',
    price: 500000,
    cashflow: 3500,
  },
];

const MARKET_SEED: CardDefinition[] = [
  {
    id: 'market-boom',
    name: 'Bull Market',
    kind: 'doodad',
    deck: 'market',
    description: 'All stock positions gain +$5 per share.',
    rule: 'Apply immediately to every player holding stock.',
    payout: 5,
  },
  {
    id: 'downsized',
    name: 'Downsized',
    kind: 'doodad',
    deck: 'market',
    description: 'Pay expenses and skip two turns unless you have insurance.',
    rule: 'Players with insurance skip the penalty.',
    payout: -1,
  },
];

export function buildDecks(): DeckState {
  return {
    smallDeals: shuffle(SMALL_DEAL_SEED),
    bigDeals: shuffle(BIG_DEAL_SEED),
    market: shuffle(MARKET_SEED),
  };
}

export function drawFromDeck(
  state: DeckState,
  deck: keyof DeckState
): {
  card: CardDefinition | null;
  deckState: DeckState;
} {
  const source = state[deck];
  if (source.length === 0) {
    return { card: null, deckState: state };
  }
  const [card, ...rest] = source;
  return {
    card,
    deckState: {
      ...state,
      [deck]: rest,
    },
  };
}

export function recycleCard(
  state: DeckState,
  deck: keyof DeckState,
  card: CardDefinition
): DeckState {
  return {
    ...state,
    [deck]: [...state[deck], card],
  };
}
