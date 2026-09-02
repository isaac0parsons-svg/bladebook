import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayouts, projectReturn, toCents } from "./market";
import type { Bet } from "./types";

const bet = (id: string, team: "storm" | "blaze", amount: number): Bet => ({
  id,
  team,
  amount,
  name: `Bettor ${id}`,
  created_at: "2026-09-02T00:00:00.000Z",
});

test("projects the brief's $20/$80 example", () => {
  assert.deepEqual(projectReturn(2_000, 8_000), { profitCents: 2_000, payoutCents: 2_500 });
});

test("returns null when nobody backs the prospective winner", () => {
  assert.equal(projectReturn(0, 8_000), null);
});

test("returns stake only when the losing pool is empty", () => {
  assert.deepEqual(projectReturn(4_000, 0), { profitCents: 0, payoutCents: 500 });
});

test("allocates every cent deterministically across winners", () => {
  const rows = calculatePayouts(
    [bet("a", "storm", 5), bet("b", "storm", 10), bet("c", "blaze", 10)],
    "storm",
  );
  const winners = rows.filter((row) => row.result === "winner");
  assert.deepEqual(winners.map((row) => row.profitCents), [333, 667]);
  assert.equal(rows.reduce((sum, row) => sum + row.payoutCents, 0), 2_500);
});

test("normalizes currency safely", () => {
  assert.equal(toCents("5.005"), 501);
  assert.equal(toCents("not money"), 0);
});
