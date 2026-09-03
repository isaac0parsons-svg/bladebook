"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FIVE_DOLLARS_CENTS, formatMoney, marketPercent, projectReturn, toCents } from "@/lib/market";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { TEAM_BY_ID, TOURNAMENT_TEAMS, type TournamentTeam } from "@/lib/teams";
import type { MarketSnapshot, PublicActivity, Team, TeamMarketTotal } from "@/lib/types";

const demoSnapshot: MarketSnapshot = {
  id: 1,
  team_totals: TOURNAMENT_TEAMS.map((team) => ({
    team_id: team.id,
    total: team.id === "team-charise" ? 10 : 0,
    entries: team.id === "team-charise" ? 2 : 0,
  })),
  recent_activity: [
    { id: "demo-1", team_id: "team-charise", amount: 5, created_at: "2026-09-03T00:00:00.000Z" },
    { id: "demo-2", team_id: "team-charise", amount: 5, created_at: "2026-09-02T23:58:00.000Z" },
  ],
  market_open: true,
  event_status: "open",
  winning_team_id: null,
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

function teamName(teamId: string): string {
  return TEAM_BY_ID[teamId]?.name ?? "Unknown team";
}

function teamStyle(team: TournamentTeam): React.CSSProperties {
  return {
    "--team-accent": team.accent,
    "--team-rgb": team.accentRgb,
  } as React.CSSProperties;
}

function TeamBadge({ team, compact = false }: { team: TournamentTeam; compact?: boolean }) {
  return (
    <span className={`team-badge logo-${team.logoType} ${compact ? "compact" : ""}`} style={teamStyle(team)} aria-hidden="true">
      <i />
      <b>{team.monogram}</b>
    </span>
  );
}

interface RankedTeam {
  team: TournamentTeam;
  totalCents: number;
  entries: number;
  percent: number;
  newFiveDollarReturn: ReturnType<typeof projectReturn>;
}

function EditorialPick({ pick }: { pick: RankedTeam }) {
  const { team, newFiveDollarReturn: projection } = pick;

  return (
    <section className="editorial-pick" style={teamStyle(team)} aria-labelledby="editorial-pick-title" data-reveal>
      <div className="editorial-pick-copy">
        <p>OUR PICK <span>{"// VALUE WATCH"}</span></p>
        <h2 id="editorial-pick-title">{team.name}</h2>
        <small>{team.members.join(" + ")} · Based on the current tournament pool</small>
      </div>
      <div className="editorial-pick-return">
        <div>
          <span>EST. NEW $5 RETURN</span>
          <strong>{projection ? formatMoney(projection.payoutCents) : "—"}</strong>
          <small>{projection ? `${formatMoney(projection.profitCents, true)} potential profit` : "Awaiting backing"}</small>
        </div>
        <TeamBadge team={team} compact />
      </div>
      <p className="editorial-pick-note">Editorial lean only · returns move with every bet</p>
    </section>
  );
}

function TournamentField({ rankings, featuredIds }: { rankings: RankedTeam[]; featuredIds: Set<string> }) {
  const remainingTeams = rankings.filter(({ team }) => !featuredIds.has(team.id));

  return (
    <section className="tournament-field" aria-labelledby="tournament-field-title" data-reveal>
      <div className="field-heading">
        <div>
          <p>TOURNAMENT WINNER MARKET // {TOURNAMENT_TEAMS.length.toString().padStart(2, "0")} TEAMS</p>
          <h2 id="tournament-field-title">Rest of the field</h2>
        </div>
        <span>LIVE POOL DATA · UPDATES WITH EVERY BET</span>
      </div>
      <div className="field-layout">
        <div className="team-card-grid">
          {remainingTeams.map(({ team, totalCents, entries, percent }, index) => (
            <article className={`roster-card logo-${team.logoType}`} style={teamStyle(team)} data-rank={String(index + 3).padStart(2, "0")} key={team.id}>
              <div className="roster-card-top">
                <TeamBadge team={team} />
                <div className="roster-status"><i />#{index + 3} MARKET</div>
              </div>
              <p className="roster-label">{team.marketLabel}</p>
              <h3>{team.name}</h3>
              <p className="roster-members">{team.members.join(" & ")}</p>
              <div className="roster-meta">
                <span>{formatMoney(totalCents)} · {entries} {entries === 1 ? "BACKER" : "BACKERS"}</span>
                <b>{Math.round(percent)}% SHARE</b>
              </div>
              <blockquote>“{team.flavourLine}”</blockquote>
            </article>
          ))}
        </div>
        <aside className="power-board" aria-labelledby="power-board-title">
          <div className="power-board-head">
            <span>LIVE MARKET RANKING</span>
            <h3 id="power-board-title">BladeBook<br />Power Board</h3>
            <p>Ranked by money backed, with market share and backer count shown live.</p>
          </div>
          <ol>
            {rankings.map(({ team, totalCents, entries, percent }, index) => (
              <li key={team.id} style={teamStyle(team)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{team.name}</strong><small>{formatMoney(totalCents)} · {entries} {entries === 1 ? "BACKER" : "BACKERS"}</small></div>
                <b className="power-share">{Math.round(percent)}%</b>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  showGain?: boolean;
}

function AnimatedNumber({ value, format, showGain = false }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const displayRef = useRef(value);
  const isGaining = value > displayValue;

  useEffect(() => {
    const startValue = displayRef.current;
    if (startValue === value) return;

    let frame = 0;
    let startedAt = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : 680;
    const animate = (time: number) => {
      if (!startedAt) startedAt = time;
      const progress = duration === 0 ? 1 : Math.min((time - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + (value - startValue) * eased;
      displayRef.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className={`animated-number ${isGaining ? "is-gaining" : ""}`}>
      {format(displayValue)}
      {showGain && isGaining && <i aria-hidden="true">▲</i>}
    </span>
  );
}

function playMetallicSlash() {
  const audioContext = new AudioContext();
  const now = audioContext.currentTime;
  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.055, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  master.connect(audioContext.destination);

  [620, 1040].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = index === 0 ? "sawtooth" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.35, now + 0.2);
    oscillator.connect(master);
    oscillator.start(now + index * 0.012);
    oscillator.stop(now + 0.23);
  });

  window.setTimeout(() => void audioContext.close(), 280);
}

function moveMagneticButton(event: React.PointerEvent<HTMLButtonElement>) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
  const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
  event.currentTarget.style.setProperty("--magnet-x", `${horizontal * 6}px`);
  event.currentTarget.style.setProperty("--magnet-y", `${vertical * 5}px`);
}

function resetMagneticButton(event: React.PointerEvent<HTMLButtonElement>) {
  event.currentTarget.style.removeProperty("--magnet-x");
  event.currentTarget.style.removeProperty("--magnet-y");
}

function BeybladeVisual({ team, className = "" }: { team: Team; className?: string }) {
  return (
    <div className={`beyblade-visual ${team} ${className}`} aria-hidden="true">
      <span className="blade-orbit orbit-outer" />
      <span className="blade-orbit orbit-inner" />
      <span className="blade-disc">
        <i className="blade-cut cut-one" />
        <i className="blade-cut cut-two" />
        <i className="blade-cut cut-three" />
        <i className="blade-cut cut-four" />
        <b className="blade-hub"><i /></b>
      </span>
      <span className="blade-trail trail-one" />
      <span className="blade-trail trail-two" />
      <span className="blade-spark spark-one" />
      <span className="blade-spark spark-two" />
      <span className="blade-spark spark-three" />
    </div>
  );
}

interface TeamPanelProps {
  side: Team;
  identity: TournamentTeam;
  totalCents: number;
  entries: number;
  percent: number;
  opposingCents: number;
  winnerTeamId: string | null;
  pulse: boolean;
}

function TeamPanel({ side, identity, totalCents, entries, percent, opposingCents, winnerTeamId, pulse }: TeamPanelProps) {
  const projection = projectReturn(totalCents, opposingCents);
  const won = winnerTeamId === identity.id;
  const lost = Boolean(winnerTeamId && !won);

  return (
    <article
      className={`team-panel ${side} ${pulse ? "team-pulse" : ""} ${won ? "team-winner" : ""} ${lost ? "team-loser" : ""}`}
      style={{ ...teamStyle(identity), "--panel-accent": identity.accent } as React.CSSProperties}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
        const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
        event.currentTarget.style.setProperty("--pointer-x", `${(horizontal + 0.5) * 100}%`);
        event.currentTarget.style.setProperty("--pointer-y", `${(vertical + 0.5) * 100}%`);
        event.currentTarget.style.setProperty("--tilt-x", `${vertical * -1.8}deg`);
        event.currentTarget.style.setProperty("--tilt-y", `${horizontal * 2.2}deg`);
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.removeProperty("--tilt-x");
        event.currentTarget.style.removeProperty("--tilt-y");
      }}
    >
      <div className="team-energy" aria-hidden="true" />
      <span className="panel-scan" aria-hidden="true" />
      <span className="panel-corner corner-top" aria-hidden="true" />
      <span className="panel-corner corner-bottom" aria-hidden="true" />
      <BeybladeVisual team={side} />
      <div className="team-heading">
        <TeamBadge team={identity} compact />
        <div>
          <p className="eyebrow">{identity.marketLabel}</p>
          <h2>{identity.name}</h2>
        </div>
      </div>
      {won && <div className="winner-stamp">WINNER</div>}
      <div className="backed-block">
        <span className="metric-label">TOTAL BACKED</span>
        <strong><AnimatedNumber value={totalCents} format={(amount) => formatMoney(Math.round(amount))} showGain /></strong>
        <span className="backer-line"><AnimatedNumber value={entries} format={(count) => Math.round(count).toString()} showGain /> {entries === 1 ? "BACKER" : "BACKERS"}</span>
      </div>
      <div className="team-stat-row">
        <div>
          <span className="metric-label">MARKET SHARE</span>
          <strong><AnimatedNumber value={percent} format={(share) => `${Math.round(share)}%`} showGain /></strong>
        </div>
        <div className="return-stat">
          <span className="metric-label">{winnerTeamId ? "FINAL $5 RETURN" : "CURRENT $5 RETURN"}</span>
          <strong>{projection ? <AnimatedNumber value={projection.payoutCents} format={(amount) => formatMoney(Math.round(amount))} /> : "—"}</strong>
          <small>{projection ? <><AnimatedNumber value={projection.profitCents} format={(amount) => formatMoney(Math.round(amount), true)} /> PROFIT</> : "AWAITING BACKING"}</small>
        </div>
      </div>
    </article>
  );
}

function ActivityItem({ item, showRelativeTime }: { item: PublicActivity; showRelativeTime: boolean }) {
  const officialTeam = TEAM_BY_ID[item.team_id];
  return (
    <li className="activity-item official-activity" style={officialTeam ? teamStyle(officialTeam) : undefined}>
      <span className="activity-pulse" aria-hidden="true" />
      <span className="activity-amount">+{formatMoney(Math.round(Number(item.amount) * 100))}</span>
      <span className="activity-team">
        {officialTeam ? `${officialTeam.name} · ${officialTeam.members.join(" + ")}` : teamName(item.team_id)}
      </span>
      <time dateTime={item.created_at}>{showRelativeTime ? relativeTime(item.created_at) : "—"}</time>
    </li>
  );
}

export function PublicDashboard() {
  const hasMounted = useHasMounted();
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(demoSnapshot);
  const [betInstructionsOpen, setBetInstructionsOpen] = useState(false);
  const [payIdCopied, setPayIdCopied] = useState(false);
  const [introActive, setIntroActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [arenaSurge, setArenaSurge] = useState<Team | null>(null);
  const liveFeedReady = useRef(false);
  const latestActivityId = useRef<string | null>(null);
  const [connection, setConnection] = useState<"live" | "syncing" | "preview" | "offline">(
    isSupabaseConfigured() ? "syncing" : "preview",
  );
  const [, refreshClock] = useState(0);
  const teamTotalsMap = useMemo(() => new Map<string, TeamMarketTotal>(
    (Array.isArray(snapshot.team_totals) ? snapshot.team_totals : []).map((total) => [total.team_id, total]),
  ), [snapshot.team_totals]);
  const totalCents = useMemo(() => TOURNAMENT_TEAMS.reduce(
    (sum, team) => sum + toCents(teamTotalsMap.get(team.id)?.total ?? 0),
    0,
  ), [teamTotalsMap]);
  const rankings = useMemo<RankedTeam[]>(() => TOURNAMENT_TEAMS.map((team) => {
    const market = teamTotalsMap.get(team.id);
    const teamCents = toCents(market?.total ?? 0);
    return {
      team,
      totalCents: teamCents,
      entries: market?.entries ?? 0,
      percent: marketPercent(teamCents, totalCents),
      newFiveDollarReturn: projectReturn(teamCents + FIVE_DOLLARS_CENTS, totalCents - teamCents),
    };
  }).sort((a, b) => b.totalCents - a.totalCents || b.entries - a.entries || a.team.displayOrder - b.team.displayOrder), [teamTotalsMap, totalCents]);
  const featuredA = rankings[0];
  const featuredB = rankings[1];
  const featuredIds = useMemo(() => new Set([featuredA.team.id, featuredB.team.id]), [featuredA.team.id, featuredB.team.id]);
  const totalEntries = rankings.reduce((sum, item) => sum + item.entries, 0);
  const featuredPoolCents = featuredA.totalCents + featuredB.totalCents;
  const stormPercent = marketPercent(featuredA.totalCents, featuredPoolCents);
  const blazePercent = marketPercent(featuredB.totalCents, featuredPoolCents);
  const barStormPercent = featuredPoolCents > 0 ? stormPercent : 50;
  const dominantTeam = stormPercent === blazePercent ? "even" : stormPercent > blazePercent ? "storm" : "blaze";
  const isContested = Math.abs(stormPercent - blazePercent) <= 10;
  const valuePick = useMemo(() => [...rankings].sort((a, b) =>
    (b.newFiveDollarReturn?.payoutCents ?? 0) - (a.newFiveDollarReturn?.payoutCents ?? 0)
      || a.team.displayOrder - b.team.displayOrder,
  )[0], [rankings]);

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

  useEffect(() => {
    if (!betInstructionsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBetInstructionsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [betInstructionsOpen]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let alreadyPlayed = false;
    try {
      alreadyPlayed = window.sessionStorage.getItem("bladebook-intro-played") === "true";
    } catch {
      // The intro can still play when private browsing blocks session storage.
    }
    if (reducedMotion || alreadyPlayed) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        window.sessionStorage.setItem("bladebook-intro-played", "true");
      } catch {
        // Session persistence is an enhancement, not a requirement.
      }
      setIntroActive(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!introActive) return;
    const timer = window.setTimeout(() => setIntroActive(false), 1650);
    return () => window.clearTimeout(timer);
  }, [introActive]);

  useEffect(() => {
    if (connection !== "live") return;
    if (snapshot === demoSnapshot) return;
    const latestActivity = snapshot.recent_activity[0];
    if (!liveFeedReady.current) {
      liveFeedReady.current = true;
      latestActivityId.current = latestActivity?.id ?? null;
      return;
    }
    if (!latestActivity || latestActivity.id === latestActivityId.current) return;

    latestActivityId.current = latestActivity.id;
    setArenaSurge(latestActivity.team_id === featuredA.team.id ? "storm" : latestActivity.team_id === featuredB.team.id ? "blaze" : null);
    if (soundEnabled) playMetallicSlash();
    const timer = window.setTimeout(() => setArenaSurge(null), 900);
    return () => window.clearTimeout(timer);
  }, [connection, featuredA.team.id, featuredB.team.id, snapshot, soundEnabled]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    root.classList.add("reveal-ready");
    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return () => root.classList.remove("reveal-ready");
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -5%" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);

  async function copyPayId() {
    try {
      await navigator.clipboard.writeText("0493 068 792");
      setPayIdCopied(true);
      window.setTimeout(() => setPayIdCopied(false), 1800);
    } catch {
      setPayIdCopied(false);
    }
  }

  const winnerTeamId = snapshot.winning_team_id;
  const statusLabel = winnerTeamId ? "FINAL RESULT" : snapshot.market_open ? "MARKET OPEN" : "MARKET CLOSED";

  return (
    <main className={`market-shell ${introActive ? "intro-running" : ""} ${winnerTeamId ? "has-winner" : ""}`}>
      <div className="background-grid" aria-hidden="true" />
      <div className="storm-glow" aria-hidden="true" />
      <div className="blaze-glow" aria-hidden="true" />
      <div className="ambient-field" aria-hidden="true">
        <i className="ambient-particle particle-one" />
        <i className="ambient-particle particle-two" />
        <i className="ambient-particle particle-three" />
        <i className="ambient-particle particle-four" />
        <span className="ambient-streak streak-storm" />
        <span className="ambient-streak streak-blaze" />
        <b className="ambient-flare flare-storm" />
        <b className="ambient-flare flare-blaze" />
      </div>
      <header className="broadcast-header">
        <Link className="wordmark" href="/" aria-label="BladeBook home">
          <span className="blade-icon" aria-hidden="true"><i /><b /></span>
          BLADE<span>BOOK</span>
        </Link>
        <div className="header-statuses">
          <span className="sync-chip"><i /> SYNCED</span>
          <span className={`live-chip ${connection}`}><i />{connection === "preview" ? "DEMO FEED" : connection.toUpperCase()}</span>
          <span className={`market-chip ${snapshot.market_open ? "open" : "closed"}`}>{statusLabel}</span>
        </div>
      </header>
      <section className="hero-copy">
        <div>
          <p className="kicker"><span /> LIVE BEYBLADE MARKET <span /></p>
          <h1>{winnerTeamId ? `${teamName(winnerTeamId)} take the arena.` : "Back the champion."}<br />
            <em>{winnerTeamId ? "The tournament market has settled." : "Watch the field move."}</em>
          </h1>
          <div className="hero-actions">
            {!winnerTeamId && (
              <button
                className="bet-cta"
                type="button"
                disabled={!snapshot.market_open}
                onClick={() => setBetInstructionsOpen(true)}
                onPointerMove={moveMagneticButton}
                onPointerLeave={resetMagneticButton}
              >
                {snapshot.market_open ? "MAKE YOUR BET" : "BETTING CLOSED"}<span aria-hidden="true">→</span>
              </button>
            )}
            <button
              className={`sound-toggle ${soundEnabled ? "enabled" : ""}`}
              type="button"
              aria-pressed={soundEnabled}
              onPointerMove={moveMagneticButton}
              onPointerLeave={resetMagneticButton}
              onClick={() => {
                const nextSoundState = !soundEnabled;
                setSoundEnabled(nextSoundState);
                if (nextSoundState) playMetallicSlash();
              }}
            >
              <span className="sound-wave" aria-hidden="true"><i /><i /><i /><i /></span>
              ARENA FX {soundEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>
        <div className="pool-lockup">
          <span>{winnerTeamId ? "FINAL POOL" : "TOURNAMENT POOL"}</span>
          <strong><AnimatedNumber value={totalCents} format={(amount) => formatMoney(Math.round(amount))} showGain /></strong>
          <small><AnimatedNumber value={totalEntries} format={(count) => Math.round(count).toString()} showGain /> ENTRIES</small>
          <i className="pool-scan" aria-hidden="true" />
        </div>
      </section>
      {connection === "preview" && <div className="preview-note">Preview data is showing. Connect Supabase to switch this board live.</div>}
      <EditorialPick pick={valuePick} />
      {winnerTeamId && (
        <section className="result-banner storm" style={teamStyle(TEAM_BY_ID[winnerTeamId])} aria-live="polite">
          <span className="result-burst" aria-hidden="true" />
          <p>TOURNAMENT RESULT · MARKET SETTLED</p>
          <h2>{teamName(winnerTeamId)} win <span>ϟ</span></h2>
        </section>
      )}
      <section className="arena" aria-label={`${featuredA.team.name} and ${featuredB.team.name}, the two most-backed teams`}>
        <div className="arena-match-label">
          <strong>MOST BACKED</strong>
          <span>{featuredA.team.name} <i>VS</i> {featuredB.team.name}</span>
          <small>TOP TWO // LIVE TOURNAMENT POOL</small>
        </div>
        <span className="arena-telemetry telemetry-bottom" aria-hidden="true">POOL PRESSURE // LIVE</span>
        <TeamPanel side="storm" identity={featuredA.team} totalCents={featuredA.totalCents} opposingCents={totalCents - featuredA.totalCents} entries={featuredA.entries} percent={featuredA.percent} winnerTeamId={winnerTeamId} pulse={arenaSurge === "storm"} />
        <div
          className={`arena-core dominant-${dominantTeam} ${isContested ? "contested" : ""} ${arenaSurge ? `surge-${arenaSurge}` : ""}`}
          style={{ "--storm-share": `${barStormPercent}%` } as React.CSSProperties}
          aria-hidden="true"
        >
          <span className="core-rim rim-outer" />
          <span className="core-rim rim-middle" />
          <span className="core-rim rim-inner" />
          <i className="core-reactor" />
          <b className="core-surge" />
        </div>
        <div className="clash-field" aria-hidden="true">
          <span className="clash-ring ring-one" />
          <span className="clash-ring ring-two" />
          <i className="clash-bolt bolt-one" />
          <i className="clash-bolt bolt-two" />
          <i className="clash-bolt bolt-three" />
          <b className="impact-spark impact-one" />
          <b className="impact-spark impact-two" />
          <b className="impact-spark impact-three" />
          <b className="impact-spark impact-four" />
        </div>
        <div className="versus" aria-hidden="true"><span>V</span><span>S</span></div>
        <TeamPanel side="blaze" identity={featuredB.team} totalCents={featuredB.totalCents} opposingCents={totalCents - featuredB.totalCents} entries={featuredB.entries} percent={featuredB.percent} winnerTeamId={winnerTeamId} pulse={arenaSurge === "blaze"} />
        {introActive && (
          <div className="intro-clash" aria-hidden="true">
            <BeybladeVisual team="storm" className="intro-blade intro-storm" />
            <BeybladeVisual team="blaze" className="intro-blade intro-blaze" />
            <span className="intro-flash" />
            <span className="intro-shockwave" />
            <i className="intro-spark intro-spark-one" />
            <i className="intro-spark intro-spark-two" />
            <i className="intro-spark intro-spark-three" />
            <i className="intro-spark intro-spark-four" />
          </div>
        )}
      </section>
      <section className={`market-share ${arenaSurge ? `gaining-${arenaSurge}` : ""}`} aria-label="Market share" data-reveal>
        <div className="share-labels">
          <span className="storm"><b>{featuredA.team.shortName}</b> <AnimatedNumber value={featuredA.percent} format={(share) => `${Math.round(share)}%`} showGain /></span>
          <span className="center-label">MARKET PRESSURE</span>
          <span className="blaze"><AnimatedNumber value={featuredB.percent} format={(share) => `${Math.round(share)}%`} showGain /> <b>{featuredB.team.shortName}</b></span>
        </div>
        <div className="share-track">
          <div className="storm-fill" style={{ width: `${barStormPercent}%` }}><span /></div>
          <div className="blaze-fill" style={{ width: `${100 - barStormPercent}%` }}><span /></div>
          <i className="share-clash" style={{ left: `${barStormPercent}%` }} />
        </div>
        <p>{winnerTeamId ? "Final market split at settlement." : "Top two teams update automatically as backing changes."}</p>
      </section>
      <TournamentField rankings={rankings} featuredIds={featuredIds} />
      <section className="lower-grid" data-reveal>
        <div className="activity-panel">
          <div className="section-heading">
            <div><p>MARKET TICKER</p><h2>Live activity</h2></div>
            <span><i /> ANONYMISED</span>
          </div>
          {snapshot.recent_activity.length > 0 ? (
            <ul className={`activity-list ${arenaSurge ? `new-${arenaSurge}` : ""}`} key={snapshot.recent_activity[0]?.id}>{snapshot.recent_activity.slice(0, 6).map((item) => <ActivityItem key={item.id} item={item} showRelativeTime={hasMounted} />)}</ul>
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
      {betInstructionsOpen && (
        <div className="bet-modal-layer">
          <section className="bet-modal" role="dialog" aria-modal="true" aria-labelledby="bet-modal-title">
            <button className="bet-modal-close" type="button" aria-label="Close betting instructions" onClick={() => setBetInstructionsOpen(false)}>×</button>
            <p className="bet-modal-kicker">PLACE YOUR BACKING // MARKET OPEN</p>
            <h2 id="bet-modal-title">Make your bet.</h2>
            <p className="bet-modal-intro">Choose any team to win the tournament, then use one of the payment options below. Isaac will add your bet to the live market.</p>
            <div className="bet-methods">
              <article>
                <span>01 / PAYID</span>
                <h3>Pay by phone</h3>
                <button className="payid-copy" type="button" onClick={() => void copyPayId()}>
                  <b>0493 068 792</b>
                  <small>{payIdCopied ? "COPIED" : "COPY PAYID"}</small>
                </button>
                <p>Include your name, team and bet amount with your payment so your backing can be matched.</p>
              </article>
              <article>
                <span>02 / CASH</span>
                <h3>Bring cash</h3>
                <strong>SEE ISAAC</strong>
                <p>Tell Isaac your team and bet amount when you hand over the cash. You will be added to the live pool.</p>
              </article>
            </div>
            <p className="bet-confirmation"><i /> Your bet appears once payment has been received and Isaac has added it.</p>
          </section>
        </div>
      )}
    </main>
  );
}
