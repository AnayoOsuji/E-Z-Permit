-- One profile per user. `is_premium` is only ever changed by the server (the Stripe
-- webhook, using the service role key), so users get no insert or update policy.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Create the profile automatically when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed up before this migration ran.
insert into public.profiles (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;
