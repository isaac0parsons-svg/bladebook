"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatMoney, marketPercent, projectReturn, teamTotals } from "@/lib/market";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { MarketSnapshot, PublicActivity, Team } from "@/lib/types";

const demoSnapshot: MarketSnapshot = {
  id: 1,
  storm_total: 40,
  blaze_total: 80,
  storm_entries: 8,
  blaze_entries: 13,
  recent_activity: [
    { id: "demo-1", team: "storm", amount: 5, created_at: "2026-09-03T00:00:00.000Z" },
    { id: "demo-2", team: "blaze", amount: 5, created_at: "2026-09-02T23:58:00.000Z" },
    { id: "demo-3", team: "storm", amount: 10, created_at: "2026-09-02T23:56:00.000Z" },
    { id: "demo-4", team: "blaze", amount: 20, created_at: "2026-09-02T23:53:00.000Z" },
  ],
  market_open: true,
  event_status: "open",
  winning_team: null,
  updated_at: "2026-09-03T00:00:00.000Z",
};

const subscribeToHydration = () => () => undefined;

function useHasMounted(): boolean {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

function relativeTime(timestamp: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function teamName(team: Team): string {
  return team === "storm" ? "Storm Strikers" : "Blaze Brothers";
}

function AnimatedValue({ children }: { children: React.ReactNode }) {
  return <span className="number-pop" key={String(children)}>{children}</span>;
}

interface TeamPanelProps {
  team: Team;
  totalCents: number;
  entries: number;
  percent: number;
  opposingCents: number;
  winner: Team | null;
}

function TeamPanel({ team, totalCents, entries, percent, opposingCents, winner }: TeamPanelProps) {
  const projection = projectReturn(totalCents, opposingCents);
  const isStorm = team === "storm";
  const won = winner === team;
  const lost = Boolean(winner && !won);

  return (
    <article className={`team-panel ${team} ${won ? "team-winner" : ""} ${lost ? "team-loser" : ""}`}>
      <div className="team-energy" aria-hidden="true" />
      <div className="team-heading">
        <span className="team-mark" aria-hidden="true">{isStorm ? "ϟ" : "✦"}</span>
        <div>
          <p className="eyebrow">{isStorm ? "COLD FRONT" : "HEAT WAVE"}</p>
          <h2>{teamName(team)}</h2>
        </div>
      </div>
      {won && <div className="winner-stamp">WINNER</div>}
      <div className="backed-block">
        <span className="metric-label">TOTAL BACKED</span>
        <strong><AnimatedValue>{formatMoney(totalCents)}</AnimatedValue></strong>
        <span className="backer-line"><AnimatedValue>{entries}</AnimatedValue> {entries === 1 ? "BACKER" : "BACKERS"}</span>
      </div>
      <div className="team-stat-row">
        <div>
          <span className="metric-label">MARKET SHARE</span>
          <strong><AnimatedValue>{percent.toFixed(0)}%</AnimatedValue></strong>
        </div>
        <div className="return-stat">
          <span className="metric-label">{winner ? "FINAL $5 RETURN" : "CURRENT $5 RETURN"}</span>
          <strong><AnimatedValue>{projection ? formatMoney(projection.payoutCents) : "—"}</AnimatedValue></strong>
          <small>{projection ? `${formatMoney(projection.profitCents, true)} PROFIT` : "AWAITING BACKING"}</small>
        </div>
      </div>
    </article>
  );
}

function ActivityItem({ item, showRelativeTime }: { item: PublicActivity; showRelativeTime: boolean }) {
  return (
    <li className={`activity-item ${item.team}`}>
      <span className="activity-pulse" aria-hidden="true" />
      <span className="activity-amount">+{formatMoney(Math.round(Number(item.amount) * 100))}</span>
      <span className="activity-team">{teamName(item.team)}</span>
      <time dateTime={item.created_at}>{showRelativeTime ? relativeTime(item.created_at) : "—"}</time>
    </li>
  );
}

export function PublicDashboard() {
  const hasMounted = useHasMounted();
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(demoSnapshot);
  const [connection, setConnection] = useState<"live" | "syncing" | "preview" | "offline">(
    isSupabaseConfigured() ? "syncing" : "preview",
  );
  const [, refreshClock] = useState(0);

  const loadSnapshot = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase.from("market_public").select("*").eq("id", 1).single();
    if (error) {
      setConnection("offline");
      return;
    }
    setSnapshot(data as MarketSnapshot);
    setConnection("live");
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => refreshClock((value) => value + 1), 30_000);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return () => window.clearInterval(timer);
    void Promise.resolve().then(loadSnapshot);
    const channel = supabase
      .channel("bladebook-public-market")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_public", filter: "id=eq.1" },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            setSnapshot(payload.new as unknown as MarketSnapshot);
            setConnection("live");
          } else {
            void loadSnapshot();
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("live");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("offline");
      });
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadSnapshot]);

  const totals = useMemo(() => teamTotals(snapshot), [snapshot]);
  const stormPercent = marketPercent(totals.stormCents, totals.totalCents);
  const blazePercent = marketPercent(totals.blazeCents, totals.totalCents);
  const barStormPercent = totals.totalCents > 0 ? stormPercent : 50;
  const winner = snapshot.winning_team;
  const statusLabel = winner ? "FINAL RESULT" : snapshot.market_open ? "MARKET OPEN" : "MARKET CLOSED";

  return (
    <main className={`market-shell ${winner ? `has-winner ${winner}-wins` : ""}`}>
      <div className="background-grid" aria-hidden="true" />
      <div className="storm-glow" aria-hidden="true" />
      <div className="blaze-glow" aria-hidden="true" />
      <header className="broadcast-header">
        <Link className="wordmark" href="/" aria-label="BladeBook home">
          <span className="blade-icon" aria-hidden="true"><i /><b /></span>
          BLADE<span>BOOK</span>
        </Link>
        <div className="header-statuses">
          <span className={`live-chip ${connection}`}><i />{connection === "preview" ? "DEMO FEED" : connection.toUpperCase()}</span>
          <span className={`market-chip ${snapshot.market_open ? "open" : "closed"}`}>{statusLabel}</span>
        </div>
      </header>
      <section className="hero-copy">
        <div>
          <p className="kicker"><span /> LIVE BEYBLADE MARKET <span /></p>
          <h1>{winner ? `${teamName(winner)} take the arena.` : "Back your blade."}<br />
            <em>{winner ? "The market has settled." : "Watch the market move."}</em>
          </h1>
        </div>
        <div className="pool-lockup">
          <span>{winner ? "FINAL POOL" : "TOTAL POOL"}</span>
          <strong><AnimatedValue>{formatMoney(totals.totalCents)}</AnimatedValue></strong>
          <small>{snapshot.storm_entries + snapshot.blaze_entries} ENTRIES</small>
        </div>
      </section>
      {connection === "preview" && <div className="preview-note">Preview data is showing. Connect Supabase to switch this board live.</div>}
      {winner && (
        <section className={`result-banner ${winner}`} aria-live="polite">
          <span className="result-burst" aria-hidden="true" />
          <p>ARENA RESULT · MARKET SETTLED</p>
          <h2>{teamName(winner)} win <span>{winner === "storm" ? "ϟ" : "✦"}</span></h2>
        </section>
      )}
      <section className="arena" aria-label="Storm Strikers versus Blaze Brothers">
        <TeamPanel team="storm" totalCents={totals.stormCents} opposingCents={totals.blazeCents} entries={snapshot.storm_entries} percent={stormPercent} winner={winner} />
        <div className="versus" aria-hidden="true"><span>V</span><span>S</span></div>
        <TeamPanel team="blaze" totalCents={totals.blazeCents} opposingCents={totals.stormCents} entries={snapshot.blaze_entries} percent={blazePercent} winner={winner} />
      </section>
      <section className="market-share" aria-label="Market share">
        <div className="share-labels">
          <span className="storm"><b>STORM</b> <AnimatedValue>{stormPercent.toFixed(0)}%</AnimatedValue></span>
          <span className="center-label">MARKET PRESSURE</span>
          <span className="blaze"><AnimatedValue>{blazePercent.toFixed(0)}%</AnimatedValue> <b>BLAZE</b></span>
        </div>
        <div className="share-track">
          <div className="storm-fill" style={{ width: `${barStormPercent}%` }}><span /></div>
          <div className="blaze-fill" style={{ width: `${100 - barStormPercent}%` }}><span /></div>
          <i className="share-clash" style={{ left: `${barStormPercent}%` }} />
        </div>
        <p>{winner ? "Final market split at settlement." : "Returns move whenever the market changes."}</p>
      </section>
      <section className="lower-grid">
        <div className="activity-panel">
          <div className="section-heading">
            <div><p>MARKET TICKER</p><h2>Live activity</h2></div>
            <span><i /> ANONYMISED</span>
          </div>
          {snapshot.recent_activity.length > 0 ? (
            <ul className="activity-list">{snapshot.recent_activity.slice(0, 6).map((item) => <ActivityItem key={item.id} item={item} showRelativeTime={hasMounted} />)}</ul>
          ) : <p className="empty-activity">The arena is quiet. The first entry will appear here.</p>}
        </div>
        <aside className="rules-panel">
          <p className="rules-number">01 / POOL MECHANIC</p>
          <h2>Your stake owns a share of your team.</h2>
          <div className="formula"><span>YOUR STAKE</span><b>÷</b><span>TEAM POOL</span><b>×</b><span>RIVAL POOL</span></div>
          <p>Winners get their stake back, plus their proportional share of the rival pool. All figures shown are live estimates.</p>
        </aside>
      </section>
      <footer className="site-footer">
        <span>BLADEBOOK // LIVE POOL MARKET</span>
        <span>LAST SYNC {hasMounted ? relativeTime(snapshot.updated_at).toUpperCase() : "—"}</span>
        <Link href="/admin">ADMIN ACCESS →</Link>
      </footer>
    </main>
  );
}
