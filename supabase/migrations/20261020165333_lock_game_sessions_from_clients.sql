create policy "No client access to game sessions"
  on public.game_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);
