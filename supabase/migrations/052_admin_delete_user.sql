-- Replace the admin game-data reset with permanent Auth user deletion.
-- Deleting auth.users cascades through profiles and all profile-owned game data.

drop function if exists public.admin_clear_user_data(uuid);

create or replace function public.admin_delete_user(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  ) then
    raise exception 'admin only';
  end if;

  if p_target_id is null then
    raise exception 'target required';
  end if;

  if p_target_id = (select auth.uid()) then
    raise exception 'cannot delete your own admin account';
  end if;

  delete from auth.users
  where id = p_target_id;

  if not found then
    raise exception 'user not found';
  end if;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
revoke all on function public.admin_delete_user(uuid) from anon;
revoke all on function public.admin_delete_user(uuid) from authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
