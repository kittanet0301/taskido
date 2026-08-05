-- Global progress multiplier. Only admins may change it; all clients may read it.
create table if not exists public.game_settings (
  id text primary key,
  multiplier smallint not null default 1 check (multiplier in (1, 2, 4, 8, 16)),
  updated_at timestamptz not null default now()
);

insert into public.game_settings (id, multiplier)
values ('global', 1)
on conflict (id) do nothing;

alter table public.game_settings enable row level security;

drop policy if exists "game settings readable" on public.game_settings;
create policy "game settings readable"
  on public.game_settings for select
  to anon, authenticated
  using (id = 'global');

revoke all on table public.game_settings from public;
grant select on table public.game_settings to anon, authenticated;

create or replace function public.get_game_speed_multiplier()
returns smallint
language sql
stable
security invoker
set search_path = public
as $$
  select multiplier from public.game_settings where id = 'global';
$$;

revoke all on function public.get_game_speed_multiplier() from public;
grant execute on function public.get_game_speed_multiplier() to anon, authenticated;

create or replace function public.admin_set_game_speed_multiplier(p_multiplier smallint)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_multiplier smallint;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if p_multiplier not in (1, 2, 4, 8, 16) then
    raise exception 'invalid game speed multiplier';
  end if;
  update public.game_settings
  set multiplier = p_multiplier, updated_at = now()
  where id = 'global'
  returning multiplier into next_multiplier;
  return next_multiplier;
end;
$$;

revoke all on function public.admin_set_game_speed_multiplier(smallint) from public;
grant execute on function public.admin_set_game_speed_multiplier(smallint) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.game_settings;
exception when duplicate_object then null;
end;
$$;
