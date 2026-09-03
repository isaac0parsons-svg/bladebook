export type TeamLogoType = "burst" | "blade" | "doom" | "duo" | "link" | "luxury" | "crown";

export interface TournamentTeam {
  id: string;
  name: string;
  shortName: string;
  members: readonly [string, string];
  accent: string;
  accentRgb: string;
  monogram: string;
  logoType: TeamLogoType;
  marketLabel: string;
  flavourLine: string;
  displayOrder: number;
}

export const TOURNAMENT_TEAMS: readonly TournamentTeam[] = [
  {
    id: "bursters",
    name: "The Bursters",
    shortName: "BURSTERS",
    members: ["Will", "Archie"],
    accent: "#a86cff",
    accentRgb: "168,108,255",
    monogram: "B!",
    logoType: "burst",
    marketLabel: "BURST PRESSURE",
    flavourLine: "Built to break brackets.",
    displayOrder: 1,
  },
  {
    id: "team-charise",
    name: "Team Charise",
    shortName: "CHARISE",
    members: ["Ing", "Joseph"],
    accent: "#3da9ff",
    accentRgb: "61,169,255",
    monogram: "CH",
    logoType: "blade",
    marketLabel: "TECHNICAL EDGE",
    flavourLine: "Quietly dangerous.",
    displayOrder: 2,
  },
  {
    id: "executors-of-doom",
    name: "The Executors of Doom",
    shortName: "DOOM",
    members: ["Ari", "Matt"],
    accent: "#83ff5a",
    accentRgb: "131,255,90",
    monogram: "XD",
    logoType: "doom",
    marketLabel: "HEAVY PRESSURE",
    flavourLine: "Heavy favourite energy.",
    displayOrder: 3,
  },
  {
    id: "nate-ethan",
    name: "Nate & Ethan",
    shortName: "NATE + ETHAN",
    members: ["Nate", "Ethan"],
    accent: "#ffad3d",
    accentRgb: "255,173,61",
    monogram: "N+E",
    logoType: "duo",
    marketLabel: "DUAL THREAT",
    flavourLine: "Twice the trouble.",
    displayOrder: 4,
  },
  {
    id: "jack-roy",
    name: "Jack & Roy",
    shortName: "JACK + ROY",
    members: ["Jack", "Roy"],
    accent: "#8eeeff",
    accentRgb: "142,238,255",
    monogram: "JR",
    logoType: "link",
    marketLabel: "COLD LINK",
    flavourLine: "Market sleeping on them.",
    displayOrder: 5,
  },
  {
    id: "vanillas-in-paris",
    name: "Vanillas in Paris",
    shortName: "VANILLAS",
    members: ["Lewis", "Zander"],
    accent: "#ff4fc8",
    accentRgb: "255,79,200",
    monogram: "VP",
    logoType: "luxury",
    marketLabel: "LUXURY CHAOS",
    flavourLine: "Maximum chaos potential.",
    displayOrder: 6,
  },
  {
    id: "cristian-theo",
    name: "Cristian & Theo",
    shortName: "CRISTIAN + THEO",
    members: ["Cristian", "Theo"],
    accent: "#ffd35a",
    accentRgb: "255,211,90",
    monogram: "CT",
    logoType: "crown",
    marketLabel: "CROWN PRESSURE",
    flavourLine: "Built for the spotlight.",
    displayOrder: 7,
  },
] as const;

export const TEAM_BY_ID = Object.fromEntries(
  TOURNAMENT_TEAMS.map((team) => [team.id, team]),
) as Record<string, TournamentTeam>;
