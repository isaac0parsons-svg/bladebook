export type Team = "storm" | "blaze";
export type EventStatus = "open" | "closed" | "settled";

export interface Bet {
  id: string;
  name: string;
  team_id: string;
  amount: number | string;
  created_at: string;
}

export interface PublicActivity {
  id: string;
  team_id: string;
  amount: number;
  created_at: string;
}

export interface TeamMarketTotal {
  team_id: string;
  total: number | string;
  entries: number;
}

export interface MarketSnapshot {
  id: number;
  team_totals: TeamMarketTotal[];
  recent_activity: PublicActivity[];
  market_open: boolean;
  event_status: EventStatus;
  winning_team_id: string | null;
  updated_at: string;
}

export interface MarketState {
  id: number;
  market_open: boolean;
  event_status: EventStatus;
  winning_team_id: string | null;
  updated_at: string;
}

export interface PayoutRow {
  id: string;
  name: string;
  team_id: string;
  stakeCents: number;
  profitCents: number;
  payoutCents: number;
  result: "winner" | "loss";
}
