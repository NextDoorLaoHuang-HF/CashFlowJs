export type Scenario = {
  id: string;
  label: string;
  salary: number;
  savings: number;
  taxes: number;
  mortgagePayment: number;
  carPayment: number;
  creditCardPayment: number;
  retailPayment: number;
  otherExpenses: number;
  mortgage: number;
  carLoan: number;
  creditDebt: number;
  retailDebt: number;
};

const rawScenarioTuples: Array<[string, number, number, number, number, number, number, number, number, number, number, number, number]> = [
  ["Airline Pilot", 9500, 400, 2350, 1300, 300, 660, 50, 2210, 143000, 15000, 22000, 1000],
  ["Business Manager", 4600, 400, 910, 700, 120, 90, 50, 1000, 75000, 6000, 3000, 1000],
  ["Doctor (MD)", 13200, 400, 3420, 1900, 380, 270, 50, 2880, 202000, 19000, 9000, 1000],
  ["Engineer", 4900, 400, 1050, 700, 140, 120, 50, 1090, 75000, 7000, 4000, 1000],
  ["Janitor", 1600, 560, 280, 200, 60, 60, 50, 300, 20000, 4000, 2000, 1000],
  ["Lawyer", 7500, 400, 1830, 1100, 220, 180, 50, 1650, 115000, 11000, 6000, 1000],
  ["Mechanic", 2000, 670, 360, 300, 60, 60, 50, 450, 31000, 3000, 2000, 1000],
  ["Nurse", 3100, 480, 600, 400, 100, 90, 50, 710, 47000, 5000, 3000, 1000],
  ["Police Officer", 3000, 520, 580, 400, 100, 60, 50, 690, 46000, 5000, 2000, 1000],
  ["Secretary", 2500, 710, 460, 400, 80, 60, 50, 570, 38000, 4000, 2000, 1000],
  ["Teacher (K-12)", 3300, 400, 630, 500, 100, 90, 50, 760, 50000, 5000, 3000, 1000],
  ["Truck Driver", 2500, 750, 460, 400, 80, 60, 50, 570, 38000, 4000, 2000, 1000],
  ["CEO", 24000, 60000, 7200, 1900, 800, 250, 50, 4200, 750000, 30000, 11000, 1000]
];

export const scenarios: Scenario[] = rawScenarioTuples.map((tuple) => ({
  id: tuple[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  label: tuple[0],
  salary: tuple[1],
  savings: tuple[2],
  taxes: tuple[3],
  mortgagePayment: tuple[4],
  carPayment: tuple[5],
  creditCardPayment: tuple[6],
  retailPayment: tuple[7],
  otherExpenses: tuple[8],
  mortgage: tuple[9],
  carLoan: tuple[10],
  creditDebt: tuple[11],
  retailDebt: tuple[12]
}));

export type Dream = {
  id: string;
  title: string;
  description: string;
  cost: number;
  perk: string;
};

const dreamTitles = [
  "STOCK MARKET FOR KIDS",
  "YACHT RACING",
  "CANNES FILM FESTIVAL",
  "PRIVATE FISHING CABIN ON A MONTANA LAKE",
  "PARK NAMED AFTER YOU",
  "RUN FOR MAYOR",
  "GIFT OF FAITH",
  "HELI SKI THE SWISS ALPS",
  "DINNER WITH THE PRESIDENT",
  "RESEARCH CENTER FOR CANCER AND AIDS",
  "7 WONDERS OF THE WORLD",
  "SAVE THE OCEAN MAMMALS",
  "BE A JET SETTER",
  "GOLF AROUND THE WORLD",
  "A KIDS LIBRARY",
  "SOUTH SEA ISLAND FANTASY",
  "CAPITALISTS PEACE CORPS",
  "CRUISE THE MEDITERRANEAN",
  "MINI FARM IN THE CITY",
  "AFRICAN PHOTO SAFARI",
  "BUY A FOREST",
  "PRO TEAM BOX SEATS",
  "ANCIENT ASIAN CITIES"
];

const dreamDescriptions = [
  "Fund a business and investment school for young capitalists, including a student-run stock exchange.",
  "Spend one week racing a 12-meter yacht in Perth, Australia, with a world class crew.",
  "Party with the stars for a week in Cannes and land a cameo in a festival film.",
  "Own a floatplane-access fishing hideout in Montana that is stocked year-round.",
  "Redevelop an abandoned warehouse into a public park that carries your name.",
  "Use your financial prowess to run and win a mayoral race that propels you nationally.",
  "Fund expansion of a thriving community faith center, adding classrooms and housing.",
  "Ski remote Swiss Alps drops by helicopter and stay in a refurbished castle.",
  "Reserve an entire ballroom for a gala dinner with the president and world leaders.",
  "Bring together top researchers to eradicate cancer and AIDS with a dedicated lab.",
  "Tour the seven wonders using planes, boats, camels, and limos in absolute luxury.",
  "Sponsor a month-long expedition to protect endangered sea animals.",
  "Fly by private jet for a year to anywhere at a moment's notice.",
  "Play the fifty best golf courses worldwide with three friends tagging along.",
  "Build a new wing in the city library dedicated to young writers and artists.",
  "Live the South Sea island fantasy for two pampered months.",
  "Launch entrepreneurial schools in developing nations with volunteer instructors.",
  "Sail your private yacht through hidden Mediterranean harbors with twelve friends.",
  "Create an urban farm to teach children how food systems and ecosystems work.",
  "Take six friends on a luxurious African photo safari.",
  "Protect 1,000 acres of old-growth forest and build an immersive nature walk.",
  "Secure a skybox with concierge service for every game of your favorite team.",
  "Travel by private plane to remote historic Asian cities with a renowned guide."
];

const perkLibrary = [
  "Education projects double the value of student-themed assets you acquire.",
  "Adventure perks allow you to reroll a single die once per turn.",
  "Celebrity access increases offer payouts by 10%.",
  "Nature retreats reduce liability costs by 15%.",
  "Civic perks add +1 passive income per charity donation.",
  "Political capital lets you negotiate loans two turns faster.",
  "Faith projects make charity cards grant +$500 bonus cash.",
  "Extreme sports grant +1 move on big deals.",
  "Diplomacy perks increase joint venture success chance by 15%.",
  "Research philanthropy doubles passive income from business assets.",
  "Explorer perks unlock map scouting that boosts fast-track entries.",
  "Ocean advocacy reduces doodad penalties by 25%.",
  "Jet setter perk waives travel-related expenses in liability cards.",
  "Golf connections boost offer resale values by 20%.",
  "Library projects reduce education expense liabilities by 50%.",
  "Island fantasy grants +$2000 cash whenever you hit Paycheck.",
  "Peace corps perk doubles impact of cooperative ventures.",
  "Mediterranean cruise increases passive income from real estate by 10%.",
  "Urban farm perk adds +$1000 cash when you draw child cards.",
  "Safari perk increases collectible asset values by 30%.",
  "Forest perk reduces downsize turns by one.",
  "Skybox perk grants +$500 cash whenever an offer is completed.",
  "Ancient cities perk unlocks fast-track entry discount of 20%."
];

export const dreams: Dream[] = dreamTitles.map((title, index) => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  title,
  description: dreamDescriptions[index],
  cost: 50000 + index * 5000,
  perk: perkLibrary[index]
}));
