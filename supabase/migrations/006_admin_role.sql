-- Migration 006 — admin role on profiles.
--
-- Adds an `is_admin` flag so trusted operators can access the /admin dashboard
-- and manage users. Because the existing profiles RLS lets a user UPDATE their
-- own row, we add a trigger so that only the service role (server-side, behind
-- the service-role key) may ever change `is_admin`. This prevents a user from
-- self-granting admin via the public anon key.
--
-- Run once in Supabase Dashboard → SQL Editor.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Block privilege escalation: only the service role may change is_admin.
create or replace function public.prevent_admin_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role may change is_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_admin_escalation on public.profiles;
create trigger profiles_prevent_admin_escalation
  before update on public.profiles
  for each row execute function public.prevent_admin_self_escalation();

-- Promote your own account to admin (run once, replacing the email):
--   update public.profiles set is_admin = true where email = 'you@example.com';
