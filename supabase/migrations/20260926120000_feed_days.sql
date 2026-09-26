-- Healthy Scroll: daily watch totals per topic, for the dashboard's "Your week".
-- Apply in Supabase → SQL Editor (paste and Run), or `supabase db push` with the CLI.
--
-- Only sums leave the phone: per local day and category, how many Reels came on
-- screen, how many were skipped, and seconds spent on the rest. No Reel ids,
-- creators or captions. Written only for signed-in users, by background/sync.ts,
-- which upserts the day's absolute totals (so a retry never double-counts).

create table public.feed_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  category text not null,
  seen integer not null default 0 check (seen >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  seconds real not null default 0 check (seconds >= 0),
  -- Watched Reels per duration bucket (shared/feed.ts WATCH_BUCKETS), for the median.
  buckets integer[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, day, category)
);

alter table public.feed_days enable row level security;

create policy "Users read their own feed days"
  on public.feed_days for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create their own feed days"
  on public.feed_days for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own feed days"
  on public.feed_days for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
