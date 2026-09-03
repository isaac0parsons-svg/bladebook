import type { Team } from "./types";

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
  openingGame?: number;
  status: "READY" | "NEXT UP";
  editorialTag: string;
  marketLabel: string;
  flavourLine: string;
  powerRank: number;
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
    openingGame: 2,
    status: "READY",
    editorialTag: "ONE TO WATCH",
    marketLabel: "BURST PRESSURE",
    flavourLine: "Built to break brackets.",
    powerRank: 2,
  },
  {
    id: "team-charise",
    name: "Team Charise",
    shortName: "CHARISE",
    members: ["Ing", "Jo"],
    accent: "#3da9ff",
    accentRgb: "61,169,255",
    monogram: "CH",
    logoType: "blade",
    openingGame: 4,
    status: "READY",
    editorialTag: "DARK HORSE",
    marketLabel: "TECHNICAL EDGE",
    flavourLine: "Quietly dangerous.",
    powerRank: 3,
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
    openingGame: 1,
    status: "NEXT UP",
    editorialTag: "FAVOURITE",
    marketLabel: "HEAVY PRESSURE",
    flavourLine: "Heavy favourite energy.",
    powerRank: 1,
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
    openingGame: 3,
    status: "NEXT UP",
    editorialTag: "SLEEPER PICK",
    marketLabel: "DUAL THREAT",
    flavourLine: "Twice the trouble.",
    powerRank: 5,
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
    status: "READY",
    editorialTag: "UNDERDOG",
    marketLabel: "COLD LINK",
    flavourLine: "Market sleeping on them.",
    powerRank: 7,
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
    status: "READY",
    editorialTag: "WILD CARD",
    marketLabel: "LUXURY CHAOS",
    flavourLine: "Maximum chaos potential.",
    powerRank: 6,
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
    status: "READY",
    editorialTag: "HIGH UPSIDE",
    marketLabel: "CROWN PRESSURE",
    flavourLine: "Built for the spotlight.",
    powerRank: 4,
  },
] as const;

export const TEAM_BY_ID = Object.fromEntries(
  TOURNAMENT_TEAMS.map((team) => [team.id, team]),
) as Record<string, TournamentTeam>;

export const ACTIVE_MATCHUP = {
  label: "NEXT UP",
  teamAId: "executors-of-doom",
  teamBId: "nate-ethan",
} as const;

export const POWER_BOARD = [...TOURNAMENT_TEAMS].sort((a, b) => a.powerRank - b.powerRank);

export function teamForMarketSide(side: Team): TournamentTeam {
  return TEAM_BY_ID[side === "storm" ? ACTIVE_MATCHUP.teamAId : ACTIVE_MATCHUP.teamBId];
}
