alter table public.game_sessions
  drop constraint if exists game_sessions_game_id_check,
  add constraint game_sessions_game_id_check
    check (game_id in ('snack-snake', 'mini-tetris', 'flappy-rat'));

create or replace function public.submit_verified_game_score(
  p_session_id uuid,
  p_game_id text,
  p_player_name text,
  p_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions%rowtype;
  v_cutoff integer;
  v_result jsonb;
begin
  if p_game_id not in ('snack-snake', 'mini-tetris', 'flappy-rat')
    or p_player_name !~ '^[A-Z]{5}$'
    or p_score < 0 then
    raise exception using errcode = '22023', message = 'invalid_score_submission';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_game_id, 0));

  select * into v_session
  from public.game_sessions
  where id = p_session_id
  for update;

  if not found
    or v_session.game_id <> p_game_id
    or v_session.used_at is not null
    or v_session.created_at < now() - interval '4 hours' then
    raise exception using errcode = '22023', message = 'invalid_or_expired_game_session';
  end if;

  select score into v_cutoff
  from (
    select scores.score
    from public.game_scores as scores
    where scores.game_id = p_game_id
    order by scores.score desc, scores.created_at desc
    limit 5
  ) as top_five
  order by score asc
  limit 1;

  if v_cutoff is not null and p_score < v_cutoff then
    raise exception using errcode = 'P0001', message = 'score_did_not_make_top_five';
  end if;

  insert into public.game_scores (game_id, player_name, score)
  values (p_game_id, p_player_name, p_score)
  returning pg_catalog.jsonb_build_object(
    'id', id,
    'game_id', game_id,
    'player_name', player_name,
    'score', score,
    'created_at', created_at
  ) into v_result;

  update public.game_sessions
  set used_at = now()
  where id = p_session_id;

  return v_result;
end;
$$;
