"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { calculatePayouts, formatMoney, toCents } from "@/lib/market";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { TEAM_BY_ID, TOURNAMENT_TEAMS, type TournamentTeam } from "@/lib/teams";
import type { Bet, MarketState } from "@/lib/types";

function nameFor(teamId: string) {
  return TEAM_BY_ID[teamId]?.name ?? "Unknown team";
}

function teamStyle(team: TournamentTeam): React.CSSProperties {
  return { "--team-accent": team.accent, "--team-rgb": team.accentRgb } as React.CSSProperties;
}

function downloadCsv(rows: ReturnType<typeof calculatePayouts>) {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const lines = [
    ["name", "team", "stake", "result", "profit", "payout"].map(quote).join(","),
    ...rows.map((row) => [
      row.name,
      nameFor(row.team_id),
      (row.stakeCents / 100).toFixed(2),
      row.result,
      (row.profitCents / 100).toFixed(2),
      (row.payoutCents / 100).toFixed(2),
    ].map(quote).join(",")),
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bladebook-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    setBusy(false);
  }

  return (
    <main className="admin-login-shell">
      <div className="admin-login-card">
        <Link className="wordmark" href="/"><span className="blade-icon"><i /><b /></span>BLADE<span>BOOK</span></Link>
        <p className="admin-kicker">RESTRICTED // ARENA OPERATIONS</p>
        <h1>Control<br /><em>the market.</em></h1>
        <p className="login-copy">Sign in with an approved Supabase administrator account.</p>
        <form onSubmit={signIn} className="login-form">
          <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label>
          <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /></label>
          {message && <p className="form-error" role="alert">{message}</p>}
          <button type="submit" className="primary-admin-button" disabled={busy}>{busy ? "AUTHENTICATING…" : "ENTER CONTROL ROOM →"}</button>
        </form>
        <Link className="return-link" href="/">← Return to live market</Link>
      </div>
    </main>
  );
}

interface EditRowProps {
  bet: Bet;
  onSave: (bet: Bet) => Promise<void>;
  onCancel: () => void;
}

function EditRow({ bet, onSave, onCancel }: EditRowProps) {
  const [draft, setDraft] = useState(bet);
  return (
    <tr className="editing-row">
      <td><input aria-label="Edit bettor name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></td>
      <td><select aria-label="Edit team" value={draft.team_id} onChange={(event) => setDraft({ ...draft, team_id: event.target.value })}>{TOURNAMENT_TEAMS.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></td>
      <td><input aria-label="Edit amount" type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></td>
      <td>—</td>
      <td colSpan={2}><div className="row-actions"><button onClick={() => void onSave(draft)}>SAVE</button><button onClick={onCancel}>CANCEL</button></div></td>
    </tr>
  );
}

export function AdminDashboard() {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!configured);
  const [bets, setBets] = useState<Bet[]>([]);
  const [market, setMarket] = useState<MarketState | null>(null);
  const [accessError, setAccessError] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("5.00");
  const [teamId, setTeamId] = useState(TOURNAMENT_TEAMS[0].id);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setLoading(true);
    const [betsResult, marketResult] = await Promise.all([
      supabase.from("bets").select("id,name,team_id,amount,created_at").order("created_at", { ascending: false }),
      supabase.from("market_state").select("*").eq("id", 1).single(),
    ]);
    if (betsResult.error || marketResult.error) {
      setAccessError("This account is signed in but is not approved for BladeBook administration.");
    } else {
      setBets((betsResult.data ?? []) as Bet[]);
      setMarket(marketResult.data as MarketState);
      setAccessError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !session) return;
    void Promise.resolve().then(loadData);
    const channel = supabase
      .channel("bladebook-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "market_state", filter: "id=eq.1" }, () => void loadData())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadData, session]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totalCents = useMemo(() => bets.reduce((sum, bet) => sum + toCents(bet.amount), 0), [bets]);
  const teamMetrics = useMemo(() => TOURNAMENT_TEAMS.map((team) => {
    const teamBets = bets.filter((bet) => bet.team_id === team.id);
    return {
      team,
      totalCents: teamBets.reduce((sum, bet) => sum + toCents(bet.amount), 0),
      entries: teamBets.length,
    };
  }).sort((a, b) => b.totalCents - a.totalCents || b.entries - a.entries || a.team.displayOrder - b.team.displayOrder), [bets]);

  const filteredBets = useMemo(() => bets.filter((bet) => bet.name.toLowerCase().includes(search.trim().toLowerCase())), [bets, search]);
  const payouts = useMemo(() => market?.winning_team_id ? calculatePayouts(bets, market.winning_team_id) : [], [bets, market]);
  const marketOpen = Boolean(market?.market_open && market.event_status === "open");

  useEffect(() => {
    if (!session || !marketOpen) return;
    const frame = window.requestAnimationFrame(() => nameInput.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [session, marketOpen]);

  async function addEntry(entryTeamId: string, entryAmount: number) {
    const supabase = getSupabaseBrowserClient();
    const cleanName = name.trim();
    if (!supabase || !cleanName || !marketOpen || entryAmount <= 0) return;
    setLoading(true);
    const { error } = await supabase.from("bets").insert({ name: cleanName, team_id: entryTeamId, amount: entryAmount.toFixed(2) });
    if (error) setToast(`ERROR · ${error.message}`);
    else {
      setName("");
      setToast(`${nameFor(entryTeamId).toUpperCase()} +${formatMoney(Math.round(entryAmount * 100))}`);
      await loadData();
      window.requestAnimationFrame(() => nameInput.current?.focus());
    }
    setLoading(false);
  }

  async function saveBet(draft: Bet) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !marketOpen || !draft.name.trim() || toCents(draft.amount) <= 0) return;
    const { error } = await supabase.from("bets").update({ name: draft.name.trim(), team_id: draft.team_id, amount: (toCents(draft.amount) / 100).toFixed(2) }).eq("id", draft.id);
    setToast(error ? `ERROR · ${error.message}` : "ENTRY UPDATED");
    if (!error) setEditingId(null);
    await loadData();
  }

  async function deleteBet(bet: Bet) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !marketOpen || !window.confirm(`Delete ${bet.name}'s ${formatMoney(toCents(bet.amount))} ${nameFor(bet.team_id)} entry?`)) return;
    const { error } = await supabase.from("bets").delete().eq("id", bet.id);
    setToast(error ? `ERROR · ${error.message}` : "ENTRY DELETED");
    await loadData();
  }

  async function setMarketOpen(open: boolean) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !market || market.event_status === "settled") return;
    if (!open && !window.confirm("Close the market? New entries and corrections will stop until it is reopened.")) return;
    const { error } = await supabase.from("market_state").update({ market_open: open, event_status: open ? "open" : "closed" }).eq("id", 1);
    setToast(error ? `ERROR · ${error.message}` : open ? "MARKET OPEN" : "MARKET CLOSED");
    await loadData();
  }

  async function declareWinner(winnerTeamId: string) {
    const supabase = getSupabaseBrowserClient();
    const pool = teamMetrics.find((metric) => metric.team.id === winnerTeamId)?.totalCents ?? 0;
    if (!supabase || !market || market.event_status !== "closed" || pool <= 0) return;
    if (!window.confirm(`Confirm ${nameFor(winnerTeamId)} as the tournament winner? This locks the market and calculates final payouts.`)) return;
    const { error } = await supabase.from("market_state").update({ market_open: false, event_status: "settled", winning_team_id: winnerTeamId }).eq("id", 1);
    setToast(error ? `ERROR · ${error.message}` : `${nameFor(winnerTeamId).toUpperCase()} WIN`);
    await loadData();
  }

  if (!configured) {
    return (
      <main className="admin-login-shell"><div className="admin-login-card"><Link className="wordmark" href="/">BLADE<span>BOOK</span></Link><p className="admin-kicker">SETUP REQUIRED</p><h1>Connect<br /><em>Supabase.</em></h1><p className="login-copy">Add the public Supabase URL and publishable key from <strong>.env.example</strong>, then restart the app to enable secure admin access.</p><Link className="primary-admin-button setup-link" href="/">VIEW PUBLIC PREVIEW</Link></div></main>
    );
  }
  if (!authReady) return <main className="admin-loading">CHECKING CREDENTIALS…</main>;
  if (!session) return <LoginPanel />;
  if (accessError) {
    return <main className="admin-login-shell"><div className="admin-login-card"><p className="admin-kicker">ACCESS DENIED</p><h1>Not on<br /><em>the roster.</em></h1><p className="form-error">{accessError}</p><button className="primary-admin-button" onClick={() => void getSupabaseBrowserClient()?.auth.signOut()}>SIGN OUT</button></div></main>;
  }

  return (
    <main className="admin-shell">
      {toast && <div className={`admin-toast ${toast.startsWith("ERROR") ? "error" : ""}`} role="status">{toast}</div>}
      <header className="admin-header">
        <div><Link className="wordmark" href="/"><span className="blade-icon"><i /><b /></span>BLADE<span>BOOK</span></Link><span className="control-tag">ARENA CONTROL</span></div>
        <div className="admin-user"><span>{session.user.email}</span><button onClick={() => void getSupabaseBrowserClient()?.auth.signOut()}>SIGN OUT</button></div>
      </header>

      <section className="admin-title-row">
        <div><p className="admin-kicker">TOURNAMENT OPERATIONS</p><h1>Market control</h1></div>
        <div className={`admin-market-status ${marketOpen ? "open" : "closed"}`}><i />{market?.event_status === "settled" ? `${nameFor(market.winning_team_id!)} win` : marketOpen ? "Market open" : "Market closed"}</div>
      </section>

      <section className="admin-metrics">
        {teamMetrics.map(({ team, totalCents: teamCents, entries }) => (
          <article className="metric-tile team-metric" style={teamStyle(team)} key={team.id}><span>{team.shortName} POOL</span><strong>{formatMoney(teamCents)}</strong><small>{entries} {entries === 1 ? "BACKER" : "BACKERS"}</small></article>
        ))}
        <article className="metric-tile total"><span>TOTAL TOURNAMENT POOL</span><strong>{formatMoney(totalCents)}</strong><small>{bets.length} TOTAL ENTRIES</small></article>
      </section>

      <section className="admin-main-grid">
        <div className="entry-console">
          <div className="admin-section-head"><div><span>01 / RAPID ENTRY</span><h2>Log a payment</h2></div><b>{marketOpen ? "READY" : "LOCKED"}</b></div>
          <label className="quick-name">BETTOR NAME<input ref={nameInput} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) { event.preventDefault(); void addEntry(teamId, Number(amount)); } }} disabled={!marketOpen || loading} placeholder="Type a name…" /></label>
          <div className="quick-buttons">
            {TOURNAMENT_TEAMS.map((entryTeam) => (
              <button className="quick-team" style={teamStyle(entryTeam)} disabled={!marketOpen || !name.trim() || loading} onClick={() => void addEntry(entryTeam.id, 5)} key={entryTeam.id}><span>{entryTeam.monogram}</span><b>+$5 {entryTeam.shortName}</b><small>ONE TAP ENTRY</small></button>
            ))}
          </div>
          <div className="custom-entry">
            <label>TEAM<select value={teamId} onChange={(event) => setTeamId(event.target.value)} disabled={!marketOpen}>{TOURNAMENT_TEAMS.map((entryTeam) => <option value={entryTeam.id} key={entryTeam.id}>{entryTeam.name}</option>)}</select></label>
            <label>AMOUNT<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!marketOpen} /></label>
            <button disabled={!marketOpen || !name.trim() || Number(amount) <= 0 || loading} onClick={() => void addEntry(teamId, Number(amount))}>ADD CUSTOM →</button>
          </div>
          {!marketOpen && <p className="locked-note">Quick entry and ledger changes are disabled while the market is closed.</p>}
        </div>

        <aside className="event-console">
          <div className="admin-section-head"><div><span>02 / EVENT STATE</span><h2>Arena status</h2></div></div>
          <div className="market-toggle">
            <button className={marketOpen ? "active" : ""} disabled={market?.event_status === "settled" || marketOpen} onClick={() => void setMarketOpen(true)}>OPEN MARKET</button>
            <button className={!marketOpen && market?.event_status !== "settled" ? "active" : ""} disabled={!marketOpen || market?.event_status === "settled"} onClick={() => void setMarketOpen(false)}>CLOSE MARKET</button>
          </div>
          <div className="winner-controls">
            <span>DECLARE TOURNAMENT WINNER</span>
            <p>Close the market before confirming the champion.</p>
            {teamMetrics.map(({ team, totalCents: teamCents }) => (
              <button className="team-winner-button" style={teamStyle(team)} disabled={market?.event_status !== "closed" || teamCents <= 0} onClick={() => void declareWinner(team.id)} key={team.id}>{team.monogram} {team.shortName} WIN</button>
            ))}
          </div>
        </aside>
      </section>

      <section className="ledger-section">
        <div className="ledger-toolbar"><div><span>03 / ENTRY LEDGER</span><h2>All backing</h2></div><label>SEARCH<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a bettor…" /></label></div>
        <div className="table-wrap"><table className="ledger-table"><thead><tr><th>NAME</th><th>TEAM</th><th>AMOUNT</th><th>TIME</th><th>EDIT</th><th>DELETE</th></tr></thead><tbody>
          {filteredBets.map((bet) => editingId === bet.id ? <EditRow key={bet.id} bet={bet} onSave={saveBet} onCancel={() => setEditingId(null)} /> : (() => {
            const identity = TEAM_BY_ID[bet.team_id];
            return <tr key={bet.id}><td data-label="Name"><strong>{bet.name}</strong></td><td data-label="Team"><span className="team-pill" style={identity ? teamStyle(identity) : undefined}>{identity?.monogram} {identity?.shortName ?? nameFor(bet.team_id)}</span></td><td data-label="Amount">{formatMoney(toCents(bet.amount))}</td><td data-label="Time"><time dateTime={bet.created_at}>{new Date(bet.created_at).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}</time></td><td><button className="table-action" disabled={!marketOpen} onClick={() => setEditingId(bet.id)}>EDIT</button></td><td><button className="table-action delete" disabled={!marketOpen} onClick={() => void deleteBet(bet)}>DELETE</button></td></tr>;
          })())}
          {filteredBets.length === 0 && <tr><td className="empty-ledger" colSpan={6}>{bets.length ? "No names match your search." : "No entries yet. The first payment will appear here."}</td></tr>}
        </tbody></table></div>
      </section>

      {market?.winning_team_id && (
        <section className="payout-section" style={teamStyle(TEAM_BY_ID[market.winning_team_id])}>
          <div className="payout-summary"><div><span>04 / FINAL SETTLEMENT</span><h2>{nameFor(market.winning_team_id)} win</h2><p>{formatMoney(totalCents)} TOTAL POOL · {payouts.filter((row) => row.result === "winner").length} WINNERS</p></div><button onClick={() => downloadCsv(payouts)}>EXPORT CSV ↓</button></div>
          <div className="table-wrap"><table className="ledger-table payout-table"><thead><tr><th>NAME</th><th>STAKE</th><th>TEAM</th><th>RESULT</th><th>PROFIT</th><th>TOTAL PAYOUT</th></tr></thead><tbody>{payouts.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{formatMoney(row.stakeCents)}</td><td><span className="team-pill" style={TEAM_BY_ID[row.team_id] ? teamStyle(TEAM_BY_ID[row.team_id]) : undefined}>{nameFor(row.team_id)}</span></td><td><span className={`result-pill ${row.result}`}>{row.result.toUpperCase()}</span></td><td className={row.profitCents >= 0 ? "positive" : "negative"}>{formatMoney(row.profitCents, row.profitCents > 0)}</td><td><strong>{formatMoney(row.payoutCents)}</strong></td></tr>)}</tbody></table></div>
        </section>
      )}
    </main>
  );
}
