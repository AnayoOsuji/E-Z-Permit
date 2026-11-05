-- Save-and-track progress, "how long did it take?" reports, and email opt-in consent.
-- Run in the Supabase SQL editor after the three earlier migrations.
--
-- Checklist ids are the guide paths from lib/guides.ts ("tx/austin/food-truck"); step ids are
-- slugs of the step titles. The checklist content itself lives in the app (lib/seed), not here.

-- ------------------------------------------------------------ saved checklists ---

create table public.user_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checklist_id text not null check (checklist_id ~ '^[a-z]{2}/[a-z0-9-]{1,60}/[a-z0-9-]{1,60}$'),
  created_at timestamptz not null default now(),
  unique (user_id, checklist_id)
);

alter table public.user_checklists enable row level security;

create policy "Users read their own saved checklists"
  on public.user_checklists for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users save checklists for themselves"
  on public.user_checklists for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users remove their own saved checklists"
  on public.user_checklists for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------- progress ---

-- A row means "this step is done"; unticking deletes the row.
create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checklist_id text not null,
  step_id text not null check (char_length(step_id) between 1 and 100),
  completed_at timestamptz not null default now(),
  unique (user_id, checklist_id, step_id),
  -- Progress only exists for a checklist the user saved; removing the checklist removes its progress.
  foreign key (user_id, checklist_id) references public.user_checklists (user_id, checklist_id) on delete cascade
);

alter table public.user_progress enable row level security;

create policy "Users read their own progress"
  on public.user_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users record their own progress"
  on public.user_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users change their own progress"
  on public.user_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users clear their own progress"
  on public.user_progress for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------- duration reports ---

-- `city` is the guide's city key ("tx/austin"), so a step shared by several business types
-- (like getting an EIN) pools its reports for that city.
create table public.step_duration_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  step_id text not null check (char_length(step_id) between 1 and 100),
  city text not null check (city ~ '^[a-z]{2}/[a-z0-9-]{1,60}$'),
  days smallint not null check (days between 0 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One report per person per step; they can edit it.
  unique (user_id, city, step_id)
);

alter table public.step_duration_reports enable row level security;

create policy "Users read their own reports"
  on public.step_duration_reports for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users file their own reports"
  on public.step_duration_reports for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users edit their own reports"
  on public.step_duration_reports for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own reports"
  on public.step_duration_reports for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Everyone (signed out too) may see the community number, but never individual reports: RLS keeps
-- the table private and this function exposes only the median per step, and only for steps with
-- at least 3 reports. The median keeps one wild answer from skewing the result.
create function public.step_duration_stats(p_city text)
returns table (step_id text, median_days numeric, report_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.step_id,
         (percentile_cont(0.5) within group (order by r.days))::numeric as median_days,
         count(*) as report_count
  from public.step_duration_reports r
  where r.city = p_city
  group by r.step_id
  having count(*) >= 3;
$$;

revoke all on function public.step_duration_stats(text) from public;
grant execute on function public.step_duration_stats(text) to anon, authenticated;

-- ------------------------------------------------------------ email consent ---

-- Whether the user agreed to future reminder emails, and when. Nothing sends email yet:
-- TODO(reminders): a scheduled job (Vercel Cron or Supabase) should read opted_in = true rows
-- with the service role, join profiles.email, and send reminders about unfinished steps.
create table public.email_consents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  opted_in boolean not null default false,
  consented_at timestamptz,
  updated_at timestamptz not null default now(),
  check (not opted_in or consented_at is not null)
);

alter table public.email_consents enable row level security;

create policy "Users read their own consent"
  on public.email_consents for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users give their own consent"
  on public.email_consents for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users change their own consent"
  on public.email_consents for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
