# BladeBook

BladeBook is a live, pooled Beyblade prediction market for Storm Strikers vs Blaze Brothers. The public dashboard updates through Supabase Realtime without revealing bettor names; the authenticated admin control room handles rapid entry, corrections, market state, settlement, and CSV payouts.

## Stack

- Next.js App Router, TypeScript, and Tailwind CSS
- Supabase Postgres, Auth, Realtime, and Row Level Security
- Vercel-ready deployment

## Pooled return model

A winning entry receives its original stake plus its proportional share of the losing pool:

```text
profit = (stake / winning team pool) × losing team pool
payout = stake + profit
```

The shared calculation library uses integer cents. Final settlement distributes any rounding cents by largest remainder, with the bet ID as a deterministic tie-breaker, so winner payouts add up to the pool exactly. When a prospective winning side has no backing, the public dashboard shows an em dash instead of an invalid or misleading return.

## Local setup

Requirements: Node.js 22 LTS and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project.

3. Open **SQL Editor** in Supabase and run [`supabase/schema.sql`](supabase/schema.sql) in full. This creates the tables, market guards, public-safe aggregate snapshot, Realtime publication entries, and RLS policies.

4. In **Authentication → Users**, create the email/password account that will operate `/admin`.

5. Approve that exact user in **SQL Editor**:

   ```sql
   insert into public.admins (user_id, email)
   select id, email
   from auth.users
   where email = 'you@example.com';
   ```

6. Copy `.env.example` to `.env.local` and fill in the project URL and anon/publishable key:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   Do not place a Supabase secret or legacy service-role key in a `NEXT_PUBLIC_` variable. BladeBook does not require one.

7. Start the site:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000` for the public market and `http://localhost:3000/admin` for arena control.

Without Supabase environment variables, the homepage intentionally shows labelled preview data and the admin page shows setup guidance.

## Supabase security model

- Anonymous visitors can select only `market_public`, a trigger-maintained single-row snapshot containing totals, counts, status, winner, and anonymised recent activity.
- Anonymous visitors cannot select `bets`, `market_state`, or `admins`.
- Signed-in users still cannot administer the market unless their Auth user ID is in `public.admins`.
- Approved admins can read and mutate `bets` and update `market_state` through RLS.
- Database triggers reject bet inserts, edits, and deletes while the market is closed.
- A result can only be declared after closing the market, for a team with at least one entry. A settled market is locked.

If Realtime was disabled at project level, open **Database → Replication** and confirm `market_public`, `bets`, and `market_state` are included in `supabase_realtime`. The schema attempts to add them automatically when that publication exists.

## Operator workflow

1. Keep the market open while accepting payments.
2. Type a bettor name and use **+$5 Storm** or **+$5 Blaze** for rapid entry. The field clears and keeps focus after success.
3. Use the custom controls for non-$5 entries. Corrections and deletions remain available only while the market is open.
4. Close the market.
5. Confirm Storm or Blaze as the winner. BladeBook calculates every payout to the cent and switches the public dashboard into its winner state.
6. Export the final payout ledger as CSV.

## Verification

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

The calculation tests cover the brief's $20/$80 example, zero-pool states, stake-only returns, currency normalisation, deterministic rounding, and pool conservation.

## Deploy to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket and import it into Vercel.
2. Keep the detected framework as **Next.js**.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` to the Vercel project environment variables. Set `NEXT_PUBLIC_SITE_URL` to the final `https://…vercel.app` or custom-domain URL.
4. Deploy. No service-role credential is required.
5. In Supabase **Authentication → URL Configuration**, add the deployed URL to the allowed redirect URLs if you later enable magic links or OAuth. Email/password sign-in works with the current build.

The included `vercel.json` explicitly identifies the project as Next.js; Vercel otherwise needs no custom build settings.
