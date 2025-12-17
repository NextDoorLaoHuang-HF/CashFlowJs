import { fastTrackSquares, type BoardSquareType } from "./board";

export type FastTrackEventKind =
  | "payday"
  | "passiveBoost"
  | "investment"
  | "rollPayout"
  | "rollCashflow"
  | "donation"
  | "penalty"
  | "doodad"
  | "dream"
  | "noop";

export type FastTrackEventDefinition = {
  id: string;
  squareId: number;
  squareType: BoardSquareType;
  kind: FastTrackEventKind;
  logKey: string;
  params?: Record<string, unknown>;
  legacyKey?: string;
};

const defaultLogKeyForType = (squareType: BoardSquareType): string => `log.board.${squareType.toLowerCase()}`;

type LegacyInvestment = {
  title: string;
  description: string;
  cost: number;
  cashFlow: number;
  assetType: "Business" | "Real Estate";
};

type LegacyRollPayout = {
  title: string;
  description: string;
  cost: number;
  payout: number;
  successFaces: number[];
  assetType: "Stock";
};

type LegacyRollCashflow = {
  title: string;
  description: string;
  cost: number;
  successCashFlow: number;
  failureCashFlow: number;
  successFaces: number[];
  assetType: "Business";
};

type LegacyDoodad = {
  title: string;
  description: string;
  variant: "healthcare" | "loseHalfCash" | "loseLowestCashflowAsset" | "repairs";
};

const legacyInvestments: Record<number, LegacyInvestment> = {
  3: { title: "Burger Shop", description: "+9,500/mo Cash Flow 38% Cash-on-Cash return", cashFlow: 9500, cost: 300000, assetType: "Business" },
  4: { title: "Heat & A/C Service", description: "+10,000/mo Cash Flow 60% Cash-on-Cash return", cashFlow: 10000, cost: 200000, assetType: "Business" },
  5: { title: "Quick Food Market", description: "+5,000/mo Cash Flow 50% Cash-on-Cash return", cashFlow: 5000, cost: 120000, assetType: "Business" },
  6: { title: "Assisted Living Center", description: "+8,000/mo Cash Flow 24% Cash-on-Cash return", cashFlow: 8000, cost: 400000, assetType: "Business" },
  8: { title: "Ticket Sales Company", description: "+5,000/mo Cash Flow 40% Cash-on-Cash return", cashFlow: 5000, cost: 150000, assetType: "Business" },
  9: { title: "Hobby Supply Store", description: "+3,000/mo Cash Flow 36% Cash-on-Cash return", cashFlow: 3000, cost: 100000, assetType: "Business" },
  11: { title: "Fried Chicken Restaurant", description: "+10,000/mo Cash Flow 40% Cash-on-Cash return", cashFlow: 10000, cost: 300000, assetType: "Business" },
  12: { title: "Dry Dock Storage", description: "+3,000/mo Cash Flow 36% Cash-on-Cash return", cashFlow: 3000, cost: 100000, assetType: "Business" },
  13: { title: "Beauty Salon", description: "+10,000/mo Cash Flow 48% Cash-on-Cash return", cashFlow: 10000, cost: 250000, assetType: "Business" },
  15: { title: "Auto Repair Shop", description: "+6,000/mo Cash Flow 48% Cash-on-Cash return", cashFlow: 6000, cost: 150000, assetType: "Business" },
  16: {
    title: "Extreme Sports Equipment Rental",
    description: "+5,000/mo Cash Flow 40% Cash-on-Cash return",
    cashFlow: 5000,
    cost: 150000,
    assetType: "Business"
  },
  19: { title: "Movie Theater", description: "+6,000/mo Cash Flow 48% Cash-on-Cash return", cashFlow: 6000, cost: 150000, assetType: "Business" },
  20: { title: "Research Disease Center", description: "+8,000/mo Cash Flow 32% Cash-on-Cash return", cashFlow: 8000, cost: 300000, assetType: "Business" },
  22: { title: "App Development Company", description: "+5,000/mo Cash Flow 40% Cash-on-Cash return", cashFlow: 5000, cost: 150000, assetType: "Business" },
  25: {
    title: "400-Unit Apartment Building",
    description: "+8,000/mo Cash Flow 48% Cash-on-Cash return",
    cashFlow: 8000,
    cost: 200000,
    assetType: "Real Estate"
  },
  26: { title: "Island Vacation Rentals", description: "+3,000/mo Cash Flow 36% Cash-on-Cash return", cashFlow: 3000, cost: 100000, assetType: "Business" },
  28: { title: "Build Pro Golf Course", description: "+6,000/mo Cash Flow 48% Cash-on-Cash return", cashFlow: 6000, cost: 150000, assetType: "Business" },
  29: { title: "Pizza Shop", description: "+7,000/mo Cash Flow 37.3% Cash-on-Cash return", cashFlow: 7000, cost: 225000, assetType: "Business" },
  31: { title: "Collectibles Store", description: "+3,000/mo Cash Flow 36% Cash-on-Cash return", cashFlow: 3000, cost: 100000, assetType: "Business" },
  32: { title: "Frozen Yogurt Shop", description: "+3,000/mo Cash Flow 30% Cash-on-Cash return", cashFlow: 3000, cost: 120000, assetType: "Business" },
  35: { title: "200-Unit Mini Storage", description: "+6,000/mo Cash Flow 36% Cash-on-Cash return", cashFlow: 6000, cost: 200000, assetType: "Real Estate" },
  36: { title: "Dry Cleaning Business", description: "+3,000/mo Cash Flow 24% Cash-on-Cash return", cashFlow: 3000, cost: 150000, assetType: "Business" },
  37: { title: "Mobile Home Park", description: "+9,000/mo Cash Flow 27% Cash-on-Cash return", cashFlow: 9000, cost: 400000, assetType: "Real Estate" },
  39: { title: "Family Restaurant", description: "+14,000/mo Cash Flow 56% Cash-on-Cash return", cashFlow: 14000, cost: 300000, assetType: "Business" },
  40: { title: "Private Wildlife Reserve", description: "+5,000/mo Cash Flow 30% Cash-on-Cash return", cashFlow: 5000, cost: 120000, assetType: "Real Estate" }
};

const legacyRollPayoutEvents: Record<number, LegacyRollPayout> = {
  23: {
    title: "Software Co. IPO",
    description: "Pay $25,000 and roll one die. On a 6 collect $500,000; otherwise collect $0.",
    cost: 25000,
    payout: 500000,
    successFaces: [6],
    assetType: "Stock"
  },
  33: {
    title: "Bio Tech Co. IPO",
    description: "Pay $50,000 and roll one die. On a 5 or 6 collect $500,000; otherwise collect $0.",
    cost: 50000,
    payout: 500000,
    successFaces: [5, 6],
    assetType: "Stock"
  }
};

const legacyRollCashflowEvents: Record<number, LegacyRollCashflow> = {
  17: {
    title: "Foreign Oil Deal",
    description: "Pay $750,000 and roll one die. On a 6 gain +$75,000/mo cashflow; otherwise gain $0.",
    cost: 750000,
    successCashFlow: 75000,
    failureCashFlow: 0,
    successFaces: [6],
    assetType: "Business"
  }
};

const legacyDoodadsByIndex: Record<number, LegacyDoodad> = {
  1: {
    title: "Healthcare!",
    description: "Roll one die. On 4-6 you are not covered and must pay all of your cash; on 1-3 you are covered.",
    variant: "healthcare"
  },
  2: { title: "Lawsuit!", description: "Pay one half of your cash to defend yourself.", variant: "loseHalfCash" },
  3: { title: "Tax Audit!", description: "Pay accountants and lawyers one half of your cash.", variant: "loseHalfCash" },
  4: { title: "Bad Partner!", description: "Lose lowest cash-flowing asset.", variant: "loseLowestCashflowAsset" },
  5: { title: "Divorce!", description: "Lose half of your cash.", variant: "loseHalfCash" },
  6: {
    title: "Unforseen Repairs!",
    description: "Pay 10x monthly cash flow of lowest cash flowing asset or lose business.",
    variant: "repairs"
  }
};

export const fastTrackEventTable: FastTrackEventDefinition[] = (() => {
  let doodadCount = 0;
  let cashflowDayCount = 0;

  return fastTrackSquares.map((square, index) => {
    const squareNumber = index + 1;
    const id = `ft-${squareNumber}`;
    const squareType = square.type;

    if (squareType === "FAST_PENALTY") {
      doodadCount += 1;
      const doodad = legacyDoodadsByIndex[doodadCount];
      if (doodad) {
        return {
          id,
          squareId: index,
          squareType,
          kind: "doodad",
          logKey: defaultLogKeyForType(squareType),
          params: { ...doodad, doodadIndex: doodadCount },
          legacyKey: `doodad${doodadCount}`
        };
      }
      return {
        id,
        squareId: index,
        squareType,
        kind: "penalty",
        logKey: defaultLogKeyForType(squareType),
        params: { minPenalty: 3000 },
        legacyKey: `doodad${doodadCount}`
      };
    }

    if (squareType === "FAST_DONATION") {
      return {
        id,
        squareId: index,
        squareType,
        kind: "donation",
        logKey: defaultLogKeyForType(squareType),
        params: { rate: 0.2, minDonation: 5000, charityTurns: 3 },
        legacyKey: "charity"
      };
    }

    if (squareType === "FAST_PAYDAY") {
      cashflowDayCount += 1;
      return {
        id,
        squareId: index,
        squareType,
        kind: "payday",
        logKey: defaultLogKeyForType(squareType),
        legacyKey: `cashFlowDay${cashflowDayCount}`
      };
    }

    if (squareType === "FAST_DREAM") {
      return {
        id,
        squareId: index,
        squareType,
        kind: "dream",
        logKey: defaultLogKeyForType(squareType),
        legacyKey: "dream"
      };
    }

    if (squareType === "FAST_OPPORTUNITY") {
      const rollPayout = legacyRollPayoutEvents[squareNumber];
      if (rollPayout) {
        return {
          id,
          squareId: index,
          squareType,
          kind: "rollPayout",
          logKey: defaultLogKeyForType(squareType),
          params: rollPayout,
          legacyKey: `square${squareNumber}`
        };
      }

      const rollCashflow = legacyRollCashflowEvents[squareNumber];
      if (rollCashflow) {
        return {
          id,
          squareId: index,
          squareType,
          kind: "rollCashflow",
          logKey: defaultLogKeyForType(squareType),
          params: rollCashflow,
          legacyKey: `square${squareNumber}`
        };
      }

      const investment = legacyInvestments[squareNumber];
      if (investment) {
        return {
          id,
          squareId: index,
          squareType,
          kind: "investment",
          logKey: defaultLogKeyForType(squareType),
          params: investment,
          legacyKey: `square${squareNumber}`
        };
      }
      return {
        id,
        squareId: index,
        squareType,
        kind: "passiveBoost",
        logKey: defaultLogKeyForType(squareType),
        params: { minBoost: 2000, paydayMultiplier: 0.5 },
        legacyKey: `square${squareNumber}`
      };
    }

    return {
      id,
      squareId: index,
      squareType,
      kind: "noop",
      logKey: defaultLogKeyForType(squareType),
      legacyKey: `square${squareNumber}`
    };
  });
})();

const fastTrackEventBySquareId = new Map<number, FastTrackEventDefinition>(
  fastTrackEventTable.map((event) => [event.squareId, event])
);

export const getFastTrackEvent = (squareId: number): FastTrackEventDefinition | undefined => fastTrackEventBySquareId.get(squareId);
