-- Extend the existing global game-speed setting for databases that already ran 055.
alter table public.game_settings
  drop constraint if exists game_settings_multiplier_check;

alter table public.game_settings
  add constraint game_settings_multiplier_check
  check (multiplier in (1, 2, 4, 8, 16));

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
