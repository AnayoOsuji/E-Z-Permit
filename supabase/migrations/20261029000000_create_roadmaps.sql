-- Saved permit roadmaps, one row per generation, owned by the user who created it.
create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  city text not null,
  state text not null,
  business_type text not null,
  -- Array of { step_number, title, department, estimated_cost, difficulty, description }.
  steps jsonb not null check (jsonb_typeof(steps) = 'array'),
  created_at timestamptz not null default now()
);

create index roadmaps_user_id_created_at_idx on public.roadmaps (user_id, created_at desc);

alter table public.roadmaps enable row level security;

create policy "Users can read their own roadmaps"
  on public.roadmaps for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can save roadmaps for themselves"
  on public.roadmaps for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own roadmaps"
  on public.roadmaps for delete
  to authenticated
  using ((select auth.uid()) = user_id);
