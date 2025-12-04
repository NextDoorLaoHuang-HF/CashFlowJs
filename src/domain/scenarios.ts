import type { ScenarioDefinition } from '@/state/types';

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'airline-pilot',
    title: 'Airline Pilot',
    salary: 9500,
    savings: 400,
    expenses: {
      taxes: 2350,
      mortgage: 1300,
      car: 300,
      creditCard: 660,
      retail: 50,
      other: 2210,
    },
    liabilities: {
      mortgage: 143000,
      car: 15000,
      creditCard: 22000,
      retail: 1000,
    },
  },
  {
    id: 'business-manager',
    title: 'Business Manager',
    salary: 4600,
    savings: 400,
    expenses: {
      taxes: 910,
      mortgage: 700,
      car: 120,
      creditCard: 90,
      retail: 50,
      other: 1000,
    },
    liabilities: {
      mortgage: 75000,
      car: 6000,
      creditCard: 3000,
      retail: 1000,
    },
  },
  {
    id: 'doctor',
    title: 'Doctor (MD)',
    salary: 13200,
    savings: 400,
    expenses: {
      taxes: 3420,
      mortgage: 1900,
      car: 380,
      creditCard: 270,
      retail: 50,
      other: 2880,
    },
    liabilities: {
      mortgage: 202000,
      car: 19000,
      creditCard: 9000,
      retail: 1000,
    },
  },
  {
    id: 'engineer',
    title: 'Engineer',
    salary: 4900,
    savings: 400,
    expenses: {
      taxes: 1050,
      mortgage: 700,
      car: 140,
      creditCard: 120,
      retail: 50,
      other: 1090,
    },
    liabilities: {
      mortgage: 75000,
      car: 7000,
      creditCard: 4000,
      retail: 1000,
    },
  },
  {
    id: 'janitor',
    title: 'Janitor',
    salary: 1600,
    savings: 560,
    expenses: {
      taxes: 280,
      mortgage: 200,
      car: 60,
      creditCard: 60,
      retail: 50,
      other: 300,
    },
    liabilities: {
      mortgage: 20000,
      car: 4000,
      creditCard: 2000,
      retail: 1000,
    },
  },
  {
    id: 'lawyer',
    title: 'Lawyer',
    salary: 7500,
    savings: 400,
    expenses: {
      taxes: 1830,
      mortgage: 1100,
      car: 220,
      creditCard: 180,
      retail: 50,
      other: 1650,
    },
    liabilities: {
      mortgage: 115000,
      car: 11000,
      creditCard: 6000,
      retail: 1000,
    },
  },
  {
    id: 'mechanic',
    title: 'Mechanic',
    salary: 2000,
    savings: 670,
    expenses: {
      taxes: 360,
      mortgage: 300,
      car: 60,
      creditCard: 60,
      retail: 50,
      other: 450,
    },
    liabilities: {
      mortgage: 31000,
      car: 3000,
      creditCard: 2000,
      retail: 1000,
    },
  },
  {
    id: 'nurse',
    title: 'Nurse',
    salary: 3100,
    savings: 480,
    expenses: {
      taxes: 600,
      mortgage: 400,
      car: 100,
      creditCard: 90,
      retail: 50,
      other: 710,
    },
    liabilities: {
      mortgage: 47000,
      car: 5000,
      creditCard: 3000,
      retail: 1000,
    },
  },
  {
    id: 'police-officer',
    title: 'Police Officer',
    salary: 3000,
    savings: 520,
    expenses: {
      taxes: 580,
      mortgage: 400,
      car: 100,
      creditCard: 60,
      retail: 50,
      other: 690,
    },
    liabilities: {
      mortgage: 46000,
      car: 5000,
      creditCard: 2000,
      retail: 1000,
    },
  },
  {
    id: 'secretary',
    title: 'Secretary',
    salary: 2500,
    savings: 710,
    expenses: {
      taxes: 460,
      mortgage: 400,
      car: 80,
      creditCard: 60,
      retail: 50,
      other: 570,
    },
    liabilities: {
      mortgage: 38000,
      car: 4000,
      creditCard: 2000,
      retail: 1000,
    },
  },
  {
    id: 'teacher',
    title: 'Teacher (K-12)',
    salary: 3300,
    savings: 400,
    expenses: {
      taxes: 630,
      mortgage: 500,
      car: 100,
      creditCard: 90,
      retail: 50,
      other: 760,
    },
    liabilities: {
      mortgage: 50000,
      car: 5000,
      creditCard: 3000,
      retail: 1000,
    },
  },
  {
    id: 'truck-driver',
    title: 'Truck Driver',
    salary: 2500,
    savings: 750,
    expenses: {
      taxes: 460,
      mortgage: 400,
      car: 80,
      creditCard: 60,
      retail: 50,
      other: 570,
    },
    liabilities: {
      mortgage: 38000,
      car: 4000,
      creditCard: 2000,
      retail: 1000,
    },
  },
  {
    id: 'ceo',
    title: 'CEO',
    salary: 24000,
    savings: 60000,
    expenses: {
      taxes: 7200,
      mortgage: 1900,
      car: 800,
      creditCard: 250,
      retail: 50,
      other: 4200,
    },
    liabilities: {
      mortgage: 750000,
      car: 30000,
      creditCard: 11000,
      retail: 1000,
    },
  },
];

export const SCENARIO_LOOKUP = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIO_LOOKUP.get(id);
}

export function getRandomScenario(): ScenarioDefinition {
  if (!SCENARIOS.length) {
    throw new Error('No scenarios have been defined.');
  }
  const index = Math.floor(Math.random() * SCENARIOS.length);
  return SCENARIOS[index];
}
