-- BladeBook seven-team tournament-winner market.
-- For a NEW Supabase project, run this whole file in the SQL editor.
-- Existing two-team projects must run migrate-multi-team.sql first.
begin;
create extension if not exists pgcrypto;
create schema if not exists private;
do $$ begin create type public.event_status as enum ('open', 'closed', 'settled'); exception when duplicate_object then null; end $$;

create table if not exists public.tournament_teams (
  id text primary key, name text not null unique,
  sort_order smallint not null unique check (sort_order > 0),
  created_at timestamptz not null default now()
);
insert into public.tournament_teams (id, name, sort_order) values
  ('bursters', 'The Bursters', 1), ('team-charise', 'Team Charise', 2),
  ('executors-of-doom', 'The Executors of Doom', 3), ('nate-ethan', 'Nate & Ethan', 4),
  ('jack-roy', 'Jack & Roy', 5), ('vanillas-in-paris', 'Vanillas in Paris', 6),
  ('cristian-theo', 'Cristian & Theo', 7)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null, created_at timestamptz not null default now()
);
create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  team_id text not null references public.tournament_teams(id),
  amount numeric(10,2) not null check (amount > 0 and amount = round(amount, 2)),
  created_at timestamptz not null default now()
);
create table if not exists public.market_state (
  id smallint primary key default 1 check (id = 1),
  market_open boolean not null default true,
  event_status public.event_status not null default 'open',
  winning_team_id text references public.tournament_teams(id),
  updated_at timestamptz not null default now(),
  constraint settled_requires_winner check (
    (event_status = 'settled' and winning_team_id is not null and market_open = false)
    or (event_status <> 'settled' and winning_team_id is null)
  ),
  constraint status_matches_market_open check (
    (event_status = 'open' and market_open = true)
    or (event_status in ('closed', 'settled') and market_open = false)
  )
);
create table if not exists public.market_public (
  id smallint primary key default 1 check (id = 1),
  team_totals jsonb not null default '[]'::jsonb check (jsonb_typeof(team_totals) = 'array'),
  recent_activity jsonb not null default '[]'::jsonb check (jsonb_typeof(recent_activity) = 'array'),
  market_open boolean not null default true,
  event_status public.event_status not null default 'open',
  winning_team_id text references public.tournament_teams(id),
  updated_at timestamptz not null default now()
);

create index if not exists bets_team_id_idx on public.bets (team_id);
create index if not exists bets_created_at_idx on public.bets (created_at desc);
alter table public.bets replica identity full;
alter table public.market_state replica identity full;
alter table public.market_public replica identity full;
insert into public.market_state (id) values (1) on conflict (id) do nothing;
insert into public.market_public (id) values (1) on conflict (id) do nothing;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
create or replace function private.guard_market_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.event_status = 'settled' then raise exception 'A settled market is locked'; end if;
  if new.event_status = 'settled' and old.event_status <> 'closed' then raise exception 'Close the market before declaring a winner'; end if;
  if new.event_status = 'settled' and not exists (select 1 from public.bets where team_id = new.winning_team_id) then
    raise exception 'The winning team must have at least one entry';
  end if;
  new.updated_at := now(); return new;
end;
$$;
create or replace function private.require_open_market()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.market_state where id = 1 and market_open = true and event_status = 'open') then
    raise exception 'The market is closed';
  end if;
  if tg_op = 'DELETE' then return old; end if; return new;
end;
$$;
create or replace function private.refresh_public_market()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.market_public snapshot set
    team_totals = coalesce((
      select jsonb_agg(jsonb_build_object('team_id', teams.id, 'total', coalesce(totals.total, 0), 'entries', coalesce(totals.entries, 0)) order by teams.sort_order)
      from public.tournament_teams teams
      left join (select team_id, sum(amount) total, count(*) entries from public.bets group by team_id) totals on totals.team_id = teams.id
    ), '[]'::jsonb),
    recent_activity = coalesce((
      select jsonb_agg(jsonb_build_object('id', recent.id, 'team_id', recent.team_id, 'amount', recent.amount, 'created_at', recent.created_at) order by recent.created_at desc)
      from (select id, team_id, amount, created_at from public.bets order by created_at desc, id limit 10) recent
    ), '[]'::jsonb),
    market_open = state.market_open, event_status = state.event_status,
    winning_team_id = state.winning_team_id, updated_at = now()
  from public.market_state state where snapshot.id = 1 and state.id = 1;
  return null;
end;
$$;

drop trigger if exists guard_market_transition on public.market_state;
create trigger guard_market_transition before update on public.market_state for each row execute function private.guard_market_transition();
drop trigger if exists require_open_market on public.bets;
create trigger require_open_market before insert or update or delete on public.bets for each row execute function private.require_open_market();
drop trigger if exists refresh_public_after_bet on public.bets;
create trigger refresh_public_after_bet after insert or update or delete on public.bets for each statement execute function private.refresh_public_market();
drop trigger if exists refresh_public_after_state on public.market_state;
create trigger refresh_public_after_state after update on public.market_state for each statement execute function private.refresh_public_market();

alter table public.tournament_teams enable row level security;
alter table public.admins enable row level security;
alter table public.bets enable row level security;
alter table public.market_state enable row level security;
alter table public.market_public enable row level security;
revoke all on public.tournament_teams, public.admins, public.bets, public.market_state, public.market_public from anon, authenticated;
grant select on public.tournament_teams to anon, authenticated;
grant select, insert, update, delete on public.bets to authenticated;
grant select, update on public.market_state to authenticated;
grant select on public.market_public to anon, authenticated;
grant usage on schema private to authenticated;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;
revoke execute on function private.guard_market_transition() from public;
revoke execute on function private.require_open_market() from public;
revoke execute on function private.refresh_public_market() from public;

drop policy if exists "public reads teams" on public.tournament_teams;
create policy "public reads teams" on public.tournament_teams for select to anon, authenticated using (true);
drop policy if exists "admins read bets" on public.bets;
create policy "admins read bets" on public.bets for select to authenticated using ((select private.is_admin()));
drop policy if exists "admins insert bets" on public.bets;
create policy "admins insert bets" on public.bets for insert to authenticated with check ((select private.is_admin()));
drop policy if exists "admins update bets" on public.bets;
create policy "admins update bets" on public.bets for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "admins delete bets" on public.bets;
create policy "admins delete bets" on public.bets for delete to authenticated using ((select private.is_admin()));
drop policy if exists "admins read state" on public.market_state;
create policy "admins read state" on public.market_state for select to authenticated using ((select private.is_admin()));
drop policy if exists "admins update state" on public.market_state;
create policy "admins update state" on public.market_state for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "public reads safe market snapshot" on public.market_public;
create policy "public reads safe market snapshot" on public.market_public for select to anon, authenticated using (true);

do $$ declare table_name text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['market_public', 'bets', 'market_state'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
update public.market_public snapshot set
  team_totals = coalesce((
    select jsonb_agg(jsonb_build_object('team_id', teams.id, 'total', coalesce(totals.total, 0), 'entries', coalesce(totals.entries, 0)) order by teams.sort_order)
    from public.tournament_teams teams
    left join (select team_id, sum(amount) total, count(*) entries from public.bets group by team_id) totals on totals.team_id = teams.id
  ), '[]'::jsonb),
  recent_activity = coalesce((
    select jsonb_agg(jsonb_build_object('id', recent.id, 'team_id', recent.team_id, 'amount', recent.amount, 'created_at', recent.created_at) order by recent.created_at desc)
    from (select id, team_id, amount, created_at from public.bets order by created_at desc, id limit 10) recent
  ), '[]'::jsonb),
  market_open = state.market_open, event_status = state.event_status,
  winning_team_id = state.winning_team_id, updated_at = now()
from public.market_state state where snapshot.id = 1 and state.id = 1;
commit;

-- Then create an Auth user and run promote-first-admin.sql with that email.
