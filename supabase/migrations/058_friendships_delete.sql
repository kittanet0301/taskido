-- Allow either party to remove an accepted friendship.
create policy "friendships delete involved"
  on public.friendships for delete
  to authenticated
  using ((select auth.uid()) = user_id or (select auth.uid()) = friend_id);
