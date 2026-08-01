-- Closing a hosted battle room dismisses every member instead of transferring ownership.
create or replace function public.room_leave(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  room_rec public.battle_rooms;
  member_rec public.battle_room_members;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into room_rec
  from public.battle_rooms
  where id = p_room_id
  for update;

  if room_rec.id is null then
    raise exception 'Room not found';
  end if;

  select * into member_rec
  from public.battle_room_members
  where room_id = p_room_id and user_id = uid;

  if member_rec.user_id is null or member_rec.status = 'left' then
    raise exception 'Not a room member';
  end if;

  if room_rec.host_user_id = uid then
    if member_rec.status = 'in_battle' and room_rec.active_session_id is not null then
      perform public.room_forfeit(p_room_id);
    end if;

    update public.battle_room_members
    set status = 'left'
    where room_id = p_room_id and status <> 'left';

    update public.battle_rooms
    set status = 'closed', active_session_id = null
    where id = p_room_id;
    return;
  end if;

  if member_rec.status = 'in_battle' and room_rec.active_session_id is not null then
    perform public.room_forfeit(p_room_id);
    return;
  end if;

  update public.battle_room_members
  set status = 'left'
  where room_id = p_room_id and user_id = uid;
end;
$$;

revoke all on function public.room_leave(uuid) from public;
revoke all on function public.room_leave(uuid) from anon;
grant execute on function public.room_leave(uuid) to authenticated;
