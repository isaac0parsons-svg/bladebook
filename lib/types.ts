export type Team = "storm" | "blaze";
export type EventStatus = "open" | "closed" | "settled";

export interface Bet {
  id: string;
  name: string;
  team: Team;
  amount: number | string;
  created_at: string;
}

export interface PublicActivity {
  id: string;
  team: Team;
  team_id?: string;
  amount: number;
  created_at: string;
}

export interface MarketSnapshot {
  id: number;
  storm_total: number | string;
  blaze_total: number | string;
  storm_entries: number;
  blaze_entries: number;
  recent_activity: PublicActivity[];
  market_open: boolean;
  event_status: EventStatus;
  winning_team: Team | null;
  updated_at: string;
}

export interface MarketState {
  id: number;
  market_open: boolean;
  event_status: EventStatus;
  winning_team: Team | null;
  updated_at: string;
}

export interface PayoutRow {
  id: string;
  name: string;
  team: Team;
  stakeCents: number;
  profitCents: number;
  payoutCents: number;
  result: "winner" | "loss";
}
