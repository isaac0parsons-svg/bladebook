-- Run ONCE on an existing BladeBook database that used storm/blaze teams.
-- Existing rows are preserved: storm maps to Team Charise; blaze maps to Nate & Ethan.
begin;
drop trigger if exists refresh_public_after_bet on public.bets;
drop trigger if exists refresh_public_after_state on public.market_state;
drop trigger if exists guard_market_transition on public.market_state;
drop trigger if exists require_open_market on public.bets;
drop function if exists private.refresh_public_market();
drop function if exists private.guard_market_transition();
drop function if exists private.require_open_market();

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

alter table public.bets add column if not exists team_id text;
update public.bets set team_id = case team::text when 'storm' then 'team-charise' when 'blaze' then 'nate-ethan' end where team_id is null;
alter table public.bets alter column team_id set not null;
alter table public.bets drop constraint if exists bets_team_id_fkey;
alter table public.bets add constraint bets_team_id_fkey foreign key (team_id) references public.tournament_teams(id);
alter table public.bets drop column if exists team;

alter table public.market_state drop constraint if exists settled_requires_winner;
alter table public.market_state add column if not exists winning_team_id text;
update public.market_state set winning_team_id = case winning_team::text when 'storm' then 'team-charise' when 'blaze' then 'nate-ethan' end where winning_team_id is null and winning_team is not null;
alter table public.market_state drop column if exists winning_team;
alter table public.market_state drop constraint if exists market_state_winning_team_id_fkey;
alter table public.market_state add constraint market_state_winning_team_id_fkey foreign key (winning_team_id) references public.tournament_teams(id);
alter table public.market_state add constraint settled_requires_winner check (
  (event_status = 'settled' and winning_team_id is not null and market_open = false)
  or (event_status <> 'settled' and winning_team_id is null)
);

drop table if exists public.market_public;
create table public.market_public (
  id smallint primary key default 1 check (id = 1),
  team_totals jsonb not null default '[]'::jsonb check (jsonb_typeof(team_totals) = 'array'),
  recent_activity jsonb not null default '[]'::jsonb check (jsonb_typeof(recent_activity) = 'array'),
  market_open boolean not null default true,
  event_status public.event_status not null default 'open',
  winning_team_id text references public.tournament_teams(id),
  updated_at timestamptz not null default now()
);
insert into public.market_public (id) values (1);
create index if not exists bets_team_id_idx on public.bets (team_id);
alter table public.tournament_teams enable row level security;
alter table public.market_public enable row level security;
commit;

-- Immediately after this succeeds, run the full current schema.sql.
