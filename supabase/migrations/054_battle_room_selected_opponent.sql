-- Synchronize the host's staged opponent choice across every room member.
alter table public.battle_rooms
  add column if not exists selected_opponent_user_id uuid references public.profiles(id) on delete set null;

create or replace function public.room_select_opponent(
  p_room_id uuid,
  p_opponent_user_id uuid default null
)
returns public.battle_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  room_rec public.battle_rooms;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into room_rec
  from public.battle_rooms
  where id = p_room_id
  for update;

  if room_rec.id is null or room_rec.status <> 'open' then
    raise exception 'Room not available';
  end if;

  if room_rec.host_user_id <> uid then
    raise exception 'Only host can select an opponent';
  end if;

  if room_rec.active_session_id is not null then
    raise exception 'Room already has active duel';
  end if;

  if p_opponent_user_id is not null and not exists (
    select 1
    from public.battle_room_members member
    where member.room_id = p_room_id
      and member.user_id = p_opponent_user_id
      and member.user_id <> uid
      and member.status = 'waiting'
  ) then
    raise exception 'Opponent not ready';
  end if;

  update public.battle_rooms
  set selected_opponent_user_id = p_opponent_user_id
  where id = p_room_id
  returning * into room_rec;

  return room_rec;
end;
$$;

revoke all on function public.room_select_opponent(uuid, uuid) from public;
revoke all on function public.room_select_opponent(uuid, uuid) from anon;
grant execute on function public.room_select_opponent(uuid, uuid) to authenticated;

create or replace function public.clear_unavailable_battle_room_opponent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status <> 'waiting' and old.status = 'waiting' then
    update public.battle_rooms
    set selected_opponent_user_id = null
    where id = new.room_id and selected_opponent_user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists battle_room_member_clear_selected_opponent on public.battle_room_members;
create trigger battle_room_member_clear_selected_opponent
after update of status on public.battle_room_members
for each row execute function public.clear_unavailable_battle_room_opponent();
