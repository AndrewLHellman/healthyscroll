-- Healthy Scroll: per-user policy + skip log.
-- Apply in Supabase → SQL Editor (paste and Run), or `supabase db push` with the CLI.
-- Every row belongs to an auth.users row; RLS limits each user to their own rows.

-- The user's latest "skip anything that's…" prompt, so it follows them across
-- devices and the website. One row per user.
create table public.policies (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  prompt text not null default '' check (char_length(prompt) <= 2000),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.policies enable row level security;

create policy "Users read their own policy"
  on public.policies for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create their own policy"
  on public.policies for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own policy"
  on public.policies for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- One row per video the extension skipped. Only ids and the decision are stored;
-- no page text, captions, or frames.
create table public.skips (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null,
  video_id text not null,
  stage text not null check (stage in ('text', 'visual', 'monitor')),
  violates_probability real,
  skipped_at timestamptz not null default now()
);

create index skips_user_id_skipped_at_idx on public.skips (user_id, skipped_at desc);

alter table public.skips enable row level security;

create policy "Users read their own skips"
  on public.skips for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users log their own skips"
  on public.skips for insert to authenticated
  with check ((select auth.uid()) = user_id);
