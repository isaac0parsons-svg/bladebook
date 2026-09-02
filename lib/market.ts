import type { Bet, MarketSnapshot, PayoutRow, Team } from "./types";

export const FIVE_DOLLARS_CENTS = 500;

export function toCents(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round((parsed + Number.EPSILON) * 100));
}

export function formatMoney(cents: number, sign = false): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  const absolute = Math.abs(safe) / 100;
  const prefix = safe < 0 ? "−" : sign && safe > 0 ? "+" : "";
  return `${prefix}$${absolute.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function teamTotals(snapshot: MarketSnapshot) {
  const stormCents = toCents(snapshot.storm_total);
  const blazeCents = toCents(snapshot.blaze_total);
  const totalCents = stormCents + blazeCents;
  return { stormCents, blazeCents, totalCents };
}

export function marketPercent(teamCents: number, totalCents: number): number {
  if (totalCents <= 0 || teamCents <= 0) return 0;
  return (teamCents / totalCents) * 100;
}

export function projectReturn(
  winningPoolCents: number,
  losingPoolCents: number,
  stakeCents = FIVE_DOLLARS_CENTS,
): { profitCents: number; payoutCents: number } | null {
  if (winningPoolCents <= 0 || stakeCents <= 0) return null;
  const profitCents = Math.round((stakeCents * losingPoolCents) / winningPoolCents);
  return { profitCents, payoutCents: stakeCents + profitCents };
}

export function calculatePayouts(bets: Bet[], winner: Team): PayoutRow[] {
  const normalized = bets.map((bet) => ({ ...bet, stakeCents: toCents(bet.amount) }));
  const winners = normalized.filter((bet) => bet.team === winner && bet.stakeCents > 0);
  const losers = normalized.filter((bet) => bet.team !== winner);
  const winningPool = winners.reduce((sum, bet) => sum + bet.stakeCents, 0);
  const losingPool = losers.reduce((sum, bet) => sum + bet.stakeCents, 0);

  const allocated = new Map<string, number>();
  if (winningPool > 0 && losingPool > 0) {
    const shares = winners.map((bet) => {
      const numerator = bet.stakeCents * losingPool;
      const base = Math.floor(numerator / winningPool);
      return { id: bet.id, base, remainder: numerator % winningPool };
    });
    const baseTotal = shares.reduce((sum, share) => sum + share.base, 0);
    const pennies = losingPool - baseTotal;
    shares
      .sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id))
      .forEach((share, index) => allocated.set(share.id, share.base + (index < pennies ? 1 : 0)));
  }

  return normalized.map((bet) => {
    if (bet.team !== winner) {
      return {
        id: bet.id,
        name: bet.name,
        team: bet.team,
        stakeCents: bet.stakeCents,
        profitCents: -bet.stakeCents,
        payoutCents: 0,
        result: "loss" as const,
      };
    }

    const profitCents = allocated.get(bet.id) ?? 0;
    return {
      id: bet.id,
      name: bet.name,
      team: bet.team,
      stakeCents: bet.stakeCents,
      profitCents,
      payoutCents: bet.stakeCents + profitCents,
      result: "winner" as const,
    };
  });
}
