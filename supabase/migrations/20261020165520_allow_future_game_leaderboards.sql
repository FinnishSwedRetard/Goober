alter table public.game_scores
  drop constraint if exists game_scores_game_id_check,
  add constraint game_scores_game_id_format_check
    check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
